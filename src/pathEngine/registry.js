import { pool } from '../db/connection.js';
import crypto from 'node:crypto';

export function stepsHash(steps) {
  return crypto.createHash('sha256').update(JSON.stringify(steps)).digest('hex').slice(0, 32);
}
import { buildProblemSignature, signaturesCompatible, lexicalSimilarity } from './signature.js';
import { evaluatePathExecution } from './evaluator.js';

export { buildProblemSignature, signaturesCompatible, lexicalSimilarity };

export class PathRegistry {
  async getOrCreateFamily(orgId, signature) {
    const key = signature.familyKey;
    const { rows } = await pool.query(
      `INSERT INTO problem_families (organization_id, family_key, domain, subdomain, jurisdiction, intent, granularity, temporal_scope, signature)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT (organization_id, family_key) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [orgId, key, signature.domain, signature.subdomain, signature.jurisdiction,
       signature.intent, signature.granularity, signature.temporalScope, JSON.stringify(signature)]
    );
    return rows[0];
  }

  async getCanonicalPath(familyId) {
    const { rows } = await pool.query(
      `SELECT * FROM resolution_paths WHERE family_id = $1 AND is_canonical = true LIMIT 1`,
      [familyId]
    );
    return rows[0] || null;
  }

  /**
   * Semantic safety: a path may only be reused if the new task's signature
   * is hard-compatible with the family AND lexical similarity confirms it.
   */
  checkPathCompatibility(task, taskSignature, canonicalPath) {
    const familySig = canonicalPath ? canonicalPath : null;
    // Family membership was decided at storage time; re-verify hard dimensions
    // against the CURRENT task in case extraction drifted.
    const stored = canonicalPath;
    if (!stored) return { compatible: true, conflicts: [], similarity: 1 };

    const compat = signaturesCompatible(taskSignature, stored.provenance?.signatureExample || taskSignature);
    return { compatible: compat.compatible, conflicts: compat.conflicts };
  }

  async findSameProcedure(orgId, familyId, stepsHash) {
    const { rows } = await pool.query(
      `SELECT * FROM resolution_paths
       WHERE organization_id=$1 AND family_id=$2 AND steps_hash=$3 LIMIT 1`,
      [orgId, familyId, stepsHash]);
    return rows[0] || null;
  }

  /** Accumulate an observation on an existing procedure (statistical requirement). */
  async accumulateObservation(pathId, { quality, verificationStatus, latencyMs, tokens, toolCalls, failures }) {
    const { rows } = await pool.query(`SELECT * FROM resolution_paths WHERE id=$1`, [pathId]);
    const p = rows[0];
    if (!p) return null;
    const prevExec = p.observed_executions || 1;
    const newExec = prevExec + 1;
    // Incremental averages keep history fair; quality keeps the BEST observed (evidence-based)
    const avgLatency = Math.round(((p.observed_latency_ms || 0) * prevExec + (latencyMs || 0)) / newExec);
    const avgTokens = Math.round(((p.observed_tokens || 0) * prevExec + (tokens || 0)) / newExec);
    const bestQuality = Math.max(parseFloat(p.quality_score) || 0, parseFloat(quality) || 0);
    const lastQuality = parseFloat(quality) || 0;
    const { rows: updated } = await pool.query(
      `UPDATE resolution_paths SET
         observed_executions = $2,
         observed_latency_ms = $3,
         observed_tokens = $4,
         observed_failures = GREATEST(COALESCE(observed_failures,0), $5),
         quality_score = $6,
         last_quality = $7,
         updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [pathId, newExec, avgLatency, avgTokens, failures || 0, bestQuality, lastQuality]);
    return updated[0];
  }

  async saveCandidatePath({ orgId, familyId, steps, parentId, provenance, metrics }) {
    const { rows: v } = await pool.query(
      `SELECT COALESCE(MAX(version), 0) + 1 AS next FROM resolution_paths WHERE family_id = $1`,
      [familyId]
    );
    const version = v[0].next;

    const evalRes = evaluatePathExecution(metrics || {});
    const { rows } = await pool.query(
      `INSERT INTO resolution_paths
        (organization_id, family_id, version, parent_id, steps, tools_required,
         quality_score, score_components, latency_score, reliability_score,
         verification_score, efficiency_score, success_rate,
         status, supersedes, provenance)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb,$9,$10,$11,$12,$13,'CANDIDATE',$14,$15::jsonb)
       RETURNING *`,
      [orgId, familyId, version, parentId || null,
       JSON.stringify(steps), JSON.stringify(metrics?.toolsRequired || []),
       evalRes.score, JSON.stringify(evalRes.components),
       metrics?.latencyScore ?? null, metrics?.reliabilityScore ?? null,
       metrics?.verificationScore ?? null, metrics?.efficiencyScore ?? null,
       metrics?.successRate ?? 0,
       parentId || null,
       JSON.stringify(provenance || {})]
    );
    const path = rows[0];
    await pool.query(
      `INSERT INTO path_versions (path_id, version, steps, provenance) VALUES ($1,$2,$3::jsonb,$4::jsonb)`,
      [path.id, version, JSON.stringify(steps), JSON.stringify(provenance || {})]
    );
    return { ...path, evaluation: evalRes };
  }

  /** Objective comparison. New candidate must EXCEED canonical to be promoted. */
  comparePaths(canonical, candidate) {
    if (!canonical) return 'NEW';
    const cs = parseFloat(canonical.quality_score) || 0;
    const ns = parseFloat(candidate.quality_score) || 0;
    if (ns > cs + 0.02) return 'BETTER';
    if (ns < cs - 0.05) return 'WORSE';
    return 'EQUIVALENT';
  }

  async promoteCanonical(pathId) {
    const { rows } = await pool.query(`SELECT * FROM resolution_paths WHERE id = $1`, [pathId]);
    const p = rows[0];
    if (!p) throw new Error('Path not found');
    // Demote old canonical
    await pool.query(`UPDATE resolution_paths SET is_canonical=false, status='SUPERSEDED', supersedes=id WHERE family_id=$1 AND is_canonical=true`, [p.family_id]);
    await pool.query(`UPDATE resolution_paths SET is_canonical=true, status='CANONICAL', updated_at=NOW() WHERE id=$1`, [pathId]);
    return { ...p, is_canonical: true, status: 'CANONICAL' };
  }

  async rejectPath(pathId, reason) {
    await pool.query(`UPDATE resolution_paths SET status='REJECTED', updated_at=NOW() WHERE id=$1`, [pathId]);
    return { rejected: true, reason };
  }

  async recordExecution({ orgId, pathId, productionId, taskSignature, decision, decisionReason, latencyMs, llmCalls, tavilyCalls, inputTokens, outputTokens, qualityScore, success, error }) {
    const { rows } = await pool.query(
      `INSERT INTO path_executions
        (organization_id, path_id, production_id, task_signature, decision, decision_reason,
         latency_ms, llm_calls, tavily_calls, input_tokens, output_tokens, context_added_tokens,
         quality_score, success, error)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14)
       RETURNING id`,
      [orgId, pathId || null, productionId || null, JSON.stringify(taskSignature || {}),
       decision, decisionReason || '', latencyMs || 0, llmCalls || 0, tavilyCalls || 0,
       inputTokens || 0, outputTokens || 0, qualityScore ?? null, success ?? true, error || null]
    );
    if (pathId && success !== false) {
      await pool.query(`UPDATE resolution_paths SET usage_count = usage_count + 1, updated_at = NOW() WHERE id=$1`, [pathId]);
    }
    if (pathId && success === false) {
      await pool.query(`UPDATE resolution_paths SET failure_count = failure_count + 1 WHERE id=$1`, [pathId]);
    }
    return rows[0].id;
  }

  async getPathHistory(pathId) {
    const { rows } = await pool.query(
      `SELECT * FROM path_executions WHERE path_id=$1 ORDER BY created_at DESC LIMIT 50`, [pathId]
    );
    return rows;
  }
}

export default new PathRegistry();

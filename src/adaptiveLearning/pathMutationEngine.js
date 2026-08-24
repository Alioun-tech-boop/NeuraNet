import { pool } from '../db/connection.js';
import crypto from 'node:crypto';

/**
 * PathMutationEngine — controlled, versioned, immutable-history mutations (§8).
 * Every mutation goes through the governance guard and appends a new version.
 */
export class PathMutationEngine {
  async _guardAndLog(orgId, type, payload) {
    const g = await import('../governance/governanceEngine.js');
    return g.default.decideAndLog(orgId, type, payload);
  }

  async mutate(orgId, pathId, mutationType, { newSteps = null, reason = '', payload = {} } = {}) {
    const verdict = await this._guardAndLog(orgId, mutationType,
      { ...payload, targetType: 'path', targetId: pathId });
    if (verdict.decision === 'DENY') return { allowed: false, decision: 'DENY', reason: verdict.reason };

    const { rows } = await pool.query(`SELECT * FROM resolution_paths WHERE id=$1`, [pathId]);
    if (!rows[0]) return { allowed: false, reason: 'path not found' };
    const parent = rows[0];

    const steps = newSteps || parent.steps;
    const hash = crypto.createHash('sha256').update(JSON.stringify(steps)).digest('hex').slice(0,32);
    const { rows: v } = await pool.query(
      `SELECT COALESCE(MAX(version),0)+1 AS next FROM resolution_paths WHERE family_id=$1`,
      [parent.family_id]);
    const version = v[0].next;

    const { rows: inserted } = await pool.query(
      `INSERT INTO resolution_paths
        (organization_id, family_id, version, parent_id, steps, tools_required,
         quality_score, score_components, status, supersedes, provenance,
         observed_latency_ms, observed_tokens, observed_tool_calls,
         observed_failures, observed_executions, steps_hash)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [orgId, parent.family_id, version, parent.id,
       JSON.stringify(steps), JSON.stringify(parent.tools_required||[]),
       parent.quality_score, JSON.stringify(parent.score_components||{}),
       mutationType === 'CREATE_VARIANT' || mutationType === 'SPECIALIZE' ? 'CANDIDATE' : parent.status,
       mutationType === 'PROMOTE' ? null : parent.id,
       JSON.stringify({ createdBy:'mutation-engine', mutationType, reason,
                        evidenceProductionId: payload.evidenceProductionId ?? null }),
       parent.observed_latency_ms, parent.observed_tokens,
       parent.observed_tool_calls, parent.observed_failures,
       parent.observed_executions, hash]
    );
    const child = inserted[0];
    await pool.query(
      `INSERT INTO path_versions (path_id, version, steps, provenance) VALUES ($1,$2,$3::jsonb,$4::jsonb)`,
      [child.id, version, JSON.stringify(steps), JSON.stringify({ mutationType, reason })]);
    return { allowed: true, path: child, parent };
  }

  async rollback(orgId, pathId) {
    // Rollback = re-promote the immediate ancestor of the current canonical version
    const { rows } = await pool.query(`SELECT * FROM resolution_paths WHERE id=$1 AND organization_id=$2`, [pathId, orgId]);
    const p = rows[0];
    if (!p?.parent_id) return { rolled: false, reason: 'no ancestor' };
    // Clear ALL canonicals in family first (avoids unique constraint violation
    // even if another sibling path currently holds canonical)
    await pool.query(`UPDATE resolution_paths SET is_canonical=false, status='DOMINATED'
                      WHERE family_id=$1 AND is_canonical=true`, [p.family_id]);
    await pool.query(`UPDATE resolution_paths SET is_canonical=true, status='ACTIVE', updated_at=NOW() WHERE id=$1`, [p.parent_id]);
    return { rolled: true, restoredPathId: p.parent_id };
  }
}

export default new PathMutationEngine();

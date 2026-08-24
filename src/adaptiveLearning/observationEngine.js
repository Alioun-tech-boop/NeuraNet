import { pool } from '../db/connection.js';

/**
 * ObservationEngine — immutable LearningObservation records.
 * Append-only: observations are never updated or deleted for statistics (spec §5).
 * Privacy: learns path properties, never stores user data/secrets (§28).
 */

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{10,}/, /(api[_-]?key|password|passwd|secret|token)\s*[:=]\s*\S+/i,
  /\b\d{16}\b/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/
];

export function redact(text) {
  let out = String(text ?? '');
  for (const p of SECRET_PATTERNS) out = out.replace(new RegExp(p.source, 'gi'), '[REDACTED]');
  return out;
}

export class ObservationEngine {
  async record({ tenantId, familyId, pathId, executionId,
                 signature, quality, correctness, success, latencyMs,
                 tokenUsage, toolCalls, failureType, environment, evaluationConfidence }) {
    const { rows } = await pool.query(
      `INSERT INTO learning_observations
        (tenant_id, problem_family_id, path_id, execution_id,
         problem_signature, quality, correctness, success, latency_ms,
         token_usage, tool_calls, failure_type, environment, evaluation_confidence)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14)
       RETURNING id, created_at`,
      [tenantId, familyId, pathId || null, executionId || null,
       JSON.stringify(redact(JSON.stringify(signature || {}))),
       quality ?? null, correctness ?? null, success !== false,
       Math.round(latencyMs || 0), Math.round(tokenUsage || 0), toolCalls || 0,
       failureType ? String(failureType).slice(0,60) : null,
       JSON.stringify(redact(JSON.stringify(environment || {}))),
       evaluationConfidence ?? 0.5]
    );
    return rows[0];
  }

  async listForFamily(tenantId, familyId, limit = 200) {
    const { rows } = await pool.query(
      `SELECT * FROM learning_observations
       WHERE tenant_id=$1 AND problem_family_id=$2
       ORDER BY created_at DESC LIMIT $3`,
      [tenantId, familyId, limit]);
    return rows; // immutable history — newest first
  }
}

export default new ObservationEngine();

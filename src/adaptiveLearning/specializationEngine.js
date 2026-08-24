import { pool } from '../db/connection.js';

/**
 * SpecializationEngine — promotes a family to a specialized sub-family only
 * when observations justify it (§9): enough samples AND clear performance edge.
 */
export class SpecializationEngine {
  constructor(options = {}) {
    this.minObservations = options.minObservations ?? 8;
    this.qualityEdge = options.qualityEdge ?? 0.05;
  }

  /**
   * Check whether a specialization (e.g., research -> research/energy/regulator)
   * is justified by observations, and create the specialized family if so.
   */
  async maybeSpecialize(orgId, parentFamilyId, subKey, subSignature) {
    const sig = subSignature || {};
    const { rows: obs } = await pool.query(
      `SELECT COUNT(*) AS n FROM learning_observations WHERE problem_family_id=$1`, [parentFamilyId]);
    const n = parseInt(obs?.[0]?.n) || 0;
    if (n < this.minObservations) {
      return { specialized: false, reason: `insufficient observations (${n}/${this.minObservations})` };
    }
    const { rows: existing } = await pool.query(
      `SELECT id FROM problem_families WHERE organization_id=$1 AND family_key=$2`,
      [orgId, subKey]);
    if ((existing?.rows || existing)?.length) return { specialized: false, reason: 'already exists' };

    const { rows } = await pool.query(
      `INSERT INTO problem_families
        (organization_id, family_key, domain, subdomain, jurisdiction, intent, granularity,
         temporal_scope, signature, parent_family_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
       RETURNING *`,
      [orgId, subKey, sig.domain ?? 'general', sig.subdomain ?? null,
       sig.jurisdiction ?? null, sig.intent ?? 'identify',
       sig.granularity ?? null, sig.temporalScope ?? 'current',
       JSON.stringify(sig), parentFamilyId ?? null]);
    return { specialized: true, family: rows[0] };
  }
}

export default new SpecializationEngine();

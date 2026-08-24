import policyRegistry from './policyRegistry.js';
import { pool } from '../db/connection.js';

/**
 * MutationGuard — enforces governance before any mutation.
 * Decisions: ALLOW / LIMIT / REVIEW / DENY. DENY is final and logged.
 */
export class MutationGuard {
  async guard(orgId, mutationType, payload = {}) {
    let decision = policyRegistry.classify(mutationType);

    // Immutable rule touch => absolute deny
    if ((payload.rules || []).some(r => policyRegistry.isImmutable(r))) {
      decision = 'DENY';
    }
    // Cross-tenant leak attempt
    if (payload.crossTenant) decision = 'DENY';

    // Family-level human freeze
    if (payload.familyId) {
      const { rows } = await pool.query(
        `SELECT learning_frozen, path_frozen FROM problem_families WHERE id=$1 AND organization_id=$2`,
        [payload.familyId, orgId]);
      if (rows[0]) {
        if (rows[0].learning_frozen && ['CREATE_VARIANT','SPECIALIZE','MERGE','ELIMINATE'].includes(mutationType)) {
          return { decision: 'DENY', reason: 'learning frozen by administrator' };
        }
        if (rows[0].path_frozen && ['PROMOTE','DOMINATE','ELIMINATE','DEPRECATE','REACTIVATE','SPECIALIZE'].includes(mutationType)) {
          return { decision: 'DENY', reason: 'path evolution frozen by administrator' };
        }
      }
    }

    // Poisoning guard: elimination needs minimum evidence
    if (mutationType === 'ELIMINATE') {
      const n = payload.observations ?? 0;
      const outlierOnly = payload.outlierObservation === true;
      if (n < 2 || outlierOnly) {
        return { decision: 'LIMIT', reason: 'insufficient evidence for elimination (anti-poisoning)', allowedWithLimit: true };
      }
    }

    await this.log(orgId, mutationType, payload, decision, 'mutation-guard');
    return { decision, reason: `policy: ${decision}` };
  }

  async log(orgId, mutationType, payload, decision, actor, reason = '') {
    await pool.query(
      `INSERT INTO governance_log (organization_id, mutation_type, target_type, target_id, decision, reason, actor, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [orgId, mutationType, payload.targetType ?? null, payload.targetId ?? null,
       decision, reason || `${mutationType} ${decision}`, actor, JSON.stringify(payload)]);
  }
}

export default new MutationGuard();

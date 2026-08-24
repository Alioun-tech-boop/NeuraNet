import policyRegistry from './policyRegistry.js';
import guard from './mutationGuard.js';

/**
 * GovernanceEngine — wraps every learning mutation with policy control,
 * audit logging, and human override support.
 */
export class GovernanceEngine {
  constructor() {
    this.policies = policyRegistry;
    this.guard = guard;
  }

  async decideAndLog(orgId, mutationType, payload) {
    const verdict = await this.guard.guard(orgId, mutationType, payload);
    await this.guard.log(orgId, mutationType, payload, verdict.decision,
      'governance-engine', verdict.reason || '');
    return verdict;
  }

  // ---- Human overrides (§24) ----
  async freezeLearning(orgId, familyId, frozen = true) {
    await pool.query(`UPDATE problem_families SET learning_frozen=$2 WHERE id=$1 AND organization_id=$1`, [familyId, frozen]);
    return { frozen };
  }
  async freezePathEvolution(orgId, familyId, frozen = true) {
    await pool.query(`UPDATE problem_families SET path_frozen=$2 WHERE id=$1 AND organization_id=$1`, [familyId, frozen]);
    return { frozen };
  }
}

import { pool } from '../db/connection.js';

export default new GovernanceEngine();

/**
 * PolicyRegistry — immutable rules the learning engine can NEVER modify (§22).
 * Stored in code, not in mutable DB tables, so no learning process can touch them.
 */
export const IMMUTABLE_RULES = Object.freeze([
  'authentication', 'authorization', 'tenant_isolation', 'security_policies',
  'privacy_rules', 'audit_rules', 'data_retention', 'api_security',
  'zero_context_invariant', 'provider_ownership', 'human_override',
  'hard_semantic_safety'
]);

/** Mutation classification per §23 */
const CLASSIFICATION = {
  CREATE_VARIANT: 'ALLOW', SPECIALIZE: 'ALLOW', MERGE: 'REVIEW',
  REACTIVATE: 'ALLOW', DEPRECATE: 'ALLOW', PROMOTE: 'ALLOW',
  DOMINATE: 'ALLOW', ELIMINATE: 'LIMIT',
  // Forbidden forever:
  CHANGE_SECURITY_POLICY: 'DENY', DELETE_AUDIT_LOG: 'DENY',
  CHANGE_PROVIDER: 'DENY', MODIFY_IMMUTABLE_RULE: 'DENY',
  DISABLE_ZERO_CONTEXT: 'DENY', CROSS_TENANT_SHARE: 'DENY',
  DELETE_OBSERVATIONS: 'DENY'
};

export class PolicyRegistry {
  isImmutable(rule) { return IMMUTABLE_RULES.includes(rule); }
  classify(mutationType) { return CLASSIFICATION[mutationType] ?? 'REVIEW'; }
  listPolicies() {
    return { immutableRules: IMMUTABLE_RULES,
             classifications: JSON.parse(JSON.stringify(CLASSIFICATION)) };
  }
}

export default new PolicyRegistry();

import registry, { buildProblemSignature } from './registry.js';
import eliminator from './eliminator.js';
import comparatorSingleton from './comparator.js';
import { pool } from '../db/connection.js';

/**
 * PathEvolutionEngine — orchestrates observe → compare → eliminate → best-known.
 * All deterministic (SQL/hash/rules/statistics). No LLM. Async-capable.
 */
export class PathEvolutionEngine {
  constructor(opts = {}) {
    this.comparator = comparatorSingleton;
    this.eliminator = eliminator;
    // Exploration rate: controlled, default 10% of eligible requests explore a candidate path
    this.explorationRate = opts.explorationRate ?? 0.1;
  }

  /**
   * Observe an execution and converge the family.
   * @param {object} o - { orgId, task, domainOverride, steps, metrics{quality,verificationStatus,latencyMs,tokens,toolCalls,failures}, provenance }
   */
  async observe(o) {
    const signature = buildProblemSignature(o.task, o.domainOverride);
    const family = await registry.getOrCreateFamily(o.orgId, signature);
    const canonicalBefore = await registry.getCanonicalPath(family.id);

    const candidate = await registry.saveCandidatePath({
      orgId: o.orgId,
      familyId: family.id,
      steps: o.steps || [{ order: 1, action: 'default_execution' }],
      parentId: canonicalBefore?.id || null,
      provenance: {
        createdBy: o.createdBy || 'observer',
        reason: o.reason || 'execution observation',
        ...o.provenance
      },
      metrics: {
        quality: o.metrics?.quality ?? 0.5,
        verificationStatus: o.metrics?.verificationStatus || 'unverified',
        latencyMs: o.metrics?.latencyMs ?? 0,
        sourceCount: o.metrics?.sourceCount ?? 0,
        llmCalls: 1,
        failures: o.metrics?.failures ?? 0
      }
    });

    // Attach observed dimensions for Pareto comparison
    await pool.query(
      `UPDATE resolution_paths SET
         observed_latency_ms = $2,
         observed_tokens = $3,
         observed_tool_calls = $4,
         observed_failures = $5,
         observed_executions = 1
       WHERE id = $1`,
      [candidate.id, o.metrics?.latencyMs ?? 0, o.metrics?.tokens ?? 0,
       o.metrics?.toolCalls ?? 1, o.metrics?.failures ?? 0]
    );

    // Controlled exploration: sometimes treat the candidate as exploration probe
    const explore =
      canonicalBefore &&
      Math.random() < this.explorationRate ? candidate.id : null;

    const convergence = await eliminator.convergeFamily(o.orgId, family.id, {
      exploreCandidateId: explore
    });

    return {
      familyId: family.id,
      candidateId: candidate.id,
      canonicalBeforeId: canonicalBefore?.id ?? null,
      canonicalAfterId: convergence.bestKnownPathId,
      improved: convergence.bestKnownPathId !== canonicalBefore?.id && convergence.bestKnownPathId === candidate.id,
      eliminatedThisRound: convergence.eliminatedThisRound,
      activePaths: convergence.activePaths.length,
      dominatedPaths: convergence.dominatedPaths.length,
      candidatesReserve: convergence.candidatesReserve.length,
      explorationOutcome: convergence.explorationOutcome,
      comparatorVerdict: canonicalBefore
        ? this.comparator.compare(canonicalBefore, { ...candidate, observed_executions: 1 })
        : 'NEW'
    };
  }

  /** Full evolution snapshot for observability */
  async snapshot(orgId, familyId) {
    const paths = await pool.query(
      `SELECT id, version, parent_id, status, is_canonical, quality_score,
              observed_latency_ms, observed_tokens, observed_tool_calls,
              observed_failures, pareto_active
       FROM resolution_paths WHERE organization_id=$1 AND family_id=$2 ORDER BY version`,
      [orgId, familyId]);
    const frontier = this.comparator.frontier(paths.rows.filter(p => p.status !== 'ELIMINATED'));
    const best = this.comparator.bestKnown(frontier.frontier);
    return {
      paths: paths.rows,
      paretoFrontierIds: frontier.frontier.map(f => f.id),
      dominatedIds: frontier.dominated.map(f => f.id),
      bestKnownPathAtTimeT: best?.id ?? null
    };
  }
}

export default new PathEvolutionEngine();

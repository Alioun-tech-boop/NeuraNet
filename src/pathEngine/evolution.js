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
   * Identical procedures ACCUMULATE observations (statistical requirement);
   * genuinely new procedures create new versioned candidates.
   */
  async observe(o) {
    const signature = buildProblemSignature(o.task, o.domainOverride);
    const family = await registry.getOrCreateFamily(o.orgId, signature);
    const canonicalBefore = await registry.getCanonicalPath(family.id);

    const steps = o.steps || [{ order: 1, action: 'default_execution' }];
    const sHash = registry.stepsHash ? registry.stepsHash(steps) : null;

    // Statistical accumulation: same procedure -> same path, observations++
    let candidate = sHash ? await pool.query(
      `SELECT * FROM resolution_paths WHERE family_id=$1 AND steps_hash=$2 LIMIT 1`,
      [family.id, sHash]).then(r => r.rows[0] || null) : null;

    let accumulated = false;
    if (candidate) {
      candidate = await registry.accumulateObservation(candidate.id, {
        quality: o.metrics?.quality ?? 0.5,
        latencyMs: o.metrics?.latencyMs ?? 0,
        tokens: o.metrics?.tokens ?? 0,
        failures: o.metrics?.failures ?? 0
      });
      accumulated = true;
    } else {
      candidate = await registry.saveCandidatePath({
        orgId: o.orgId,
        familyId: family.id,
        steps,
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
          toolsRequired: ['tavily'],
          successRate: o.metrics?.failures ? 0 : 1
        }
      });
      await pool.query(
        `UPDATE resolution_paths SET
           observed_latency_ms=$2, observed_tokens=$3, observed_tool_calls=$4,
           observed_failures=$5, observed_executions=1, steps_hash=$6, last_quality=$7
         WHERE id=$1`,
        [candidate.id, o.metrics?.latencyMs ?? 0, o.metrics?.tokens ?? 0,
         o.metrics?.toolCalls ?? 1, o.metrics?.failures ?? 0, sHash, o.metrics?.quality ?? 0.5]);
    }

    // Attach observed dimensions for Pareto comparison (new procedures only)
    if (!accumulated) {
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
    }

    // Controlled exploration: sometimes treat the candidate as exploration probe
    const explore =
      canonicalBefore &&
      !accumulated &&
      Math.random() < this.explorationRate ? candidate.id : null;

    const convergence = await eliminator.convergeFamily(o.orgId, family.id, {
      exploreCandidateId: explore
    });

    return {
      familyId: family.id,
      candidateId: candidate.id,
      accumulated,
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
    // familyId optional: org-wide snapshot when absent (console overview)
    const sql = `SELECT id, version, parent_id, status, is_canonical, quality_score,
              observed_latency_ms, observed_tokens, observed_tool_calls,
              observed_failures, pareto_active
       FROM resolution_paths WHERE organization_id=$1 ${familyId ? 'AND family_id=$2' : ''} ORDER BY version`;
    const params = familyId ? [orgId, familyId] : [orgId];
    const paths = await pool.query(sql, params);
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

import { pool } from '../db/connection.js';
import { computePathStats } from './stats.js';

/** Safe re-export for tests */
export const computePathStatsSafe = computePathStats;

/**
 * PathSelectionEngine V2
 *
 * Problem → compatible paths → Pareto frontier → contextual fitness
 *   → uncertainty → risk adjustment → exploration/exploitation
 *   → best path FOR THIS REQUEST.
 *
 * Invariants: zero LLM calls, zero context injection, provider-neutral,
 * bestKnownPath is never treated as optimal forever.
 */
export class PathSelectionEngine {
  constructor(options = {}) {
    // All coefficients configurable + documented (spec §10)
    this.weights = {
      expectedQuality: 0.55,
      speed: 0.15,
      tokenCost: 0.10,
      toolCost: 0.05,
      reliability: 0.15,
      ...(options.weights || {})
    };
    this.uncertaintyPenaltyCoef = options.uncertaintyPenaltyCoef ?? 0.20;  // × uncertainty(0-1)
    this.failureRiskPenaltyCoef = options.failureRiskPenaltyCoef ?? 0.30;  // × failureRate
    this.minExecutionsForDomination = options.minExecutions ?? 2;
    this.minimumQualityThreshold = options.minimumQualityThreshold ?? 0.55;
    this.maximumFailureRate = options.maximumFailureRate ?? 0.6;
    this.maximumLatencyMs = options.maximumLatency ?? 45000;
    this.explorationRateBase = options.explorationRateBase ?? 0.08;
    this.explorationRateMax = options.explorationRateMax ?? 0.30;
    this.ucbCoefficient = options.ucbCoefficient ?? 0.4;
    this.recentWindow = options.recentWindow ?? 5;
  }

  /** Batch execution statistics for candidate paths */
  async getStats(orgId, pathIds) {
    if (!pathIds.length) return new Map();
    const { rows } = await pool.query(
      `SELECT * FROM path_executions
       WHERE organization_id=$1 AND path_id = ANY($2::uuid[])
       ORDER BY created_at ASC`,
      [orgId, pathIds]);
    const byPath = new Map();
    for (const r of rows) {
      if (!byPath.has(r.path_id)) byPath.set(r.path_id, []);
      byPath.get(r.path_id).push(r);
    }
    const stats = new Map();
    for (const [pid, execs] of byPath) stats.set(pid, computePathStats(execs, { recentWindow: this.recentWindow }));
    return stats;
  }

  /** Contextual fitness: how well does this path fit THIS problem signature? */
  contextualFitness(path, problemSignature) {
    const sig = path.provenance?.signatureExample || {};
    let fitness = 0.5;
    const matches = [];
    if (!sig.subdomain || !problemSignature.subdomain) fitness += 0;
    else if (sig.subdomain === problemSignature.subdomain) { fitness += 0.2; matches.push('subdomain'); }
    if (sig.jurisdiction && sig.jurisdiction === problemSignature.jurisdiction) { fitness += 0.1; matches.push('jurisdiction'); }
    if (sig.intent && sig.intent.split('_')[0] === String(problemSignature.intent).split('_')[0]) { fitness += 0.1; matches.push('intent-family'); }
    if (sig.granularity && sig.granularity === problemSignature.granularity) { fitness += 0.1; matches.push('granularity'); }
    return { fitness: Math.min(fitness, 1), matches };
  }

  uncertainty(stats) {
    if (!stats || stats.sampleSize === 0) return 1;
    // Normal approximation: uncertainty shrinks with sqrt(n)
    return Math.min(1, 1 / Math.sqrt(stats.sampleSize));
  }

  riskAdjustedUtility(path, stats, problemSignature) {
    const unc = this.uncertainty(stats);
    const quality = stats?.qualityMean ?? parseFloat(path.quality_score) ?? 0.5;

    // Degradation: recent performance below historical reduces confidence
    let degradationPenalty = 0;
    if (stats?.degradationDetected) degradationPenalty = 0.10;

    const expectedQuality = quality - (unc * this.uncertaintyPenaltyCoef) - degradationPenalty;
    const failureRisk = stats?.failureRate ?? 0;
    const latency = stats?.latencyP90 ?? path.observed_latency_ms ?? 5000;
    const tokens = stats?.tokenMean ?? path.observed_tokens ?? 800;
    const tools = stats?.toolCallMean ?? path.observed_tool_calls ?? 1;

    const w = this.weights;
    const utility =
      Math.max(0, expectedQuality) * w.expectedQuality +
      (1 - Math.min(latency / 30000, 1)) * w.speed +
      (1 - Math.min(tokens / 4000, 1)) * w.tokenCost +
      (1 - Math.min(tools / 5, 1)) * w.toolCost +
      (1 - failureRisk) * w.reliability -
      failureRisk * this.failureRiskPenaltyCoef;

    return {
      utility: Math.round(Math.max(-1, utility) * 1000) / 1000,
      expectedQuality: Math.round(expectedQuality * 1000) / 1000,
      uncertainty: Math.round(unc * 1000) / 1000,
      failureRisk: Math.round(failureRisk * 1000) / 1000,
      degradationPenalty
    };
  }

  /** Adaptive exploration rate from family maturity and evidence gaps */
  adaptiveExplorationRate(candidates, statsMap, familyMaturity) {
    if (!candidates.length) return 0;
    const underexplored = candidates.filter(c => {
      const s = statsMap.get(c.id);
      return !s || s.sampleSize < 3;
    });
    const maturity = Math.min((familyMaturity || 0) / 50, 1); // mature families explore less
    const gap = candidates.length > 1 ? 1 : 0;
    const rate = Math.min(
      this.explorationRateMax,
      this.explorationRateBase + (underexplored.length ? 0.12 : 0) + gap * 0.05
    ) * (1 - maturity * 0.5);
    return Math.round(rate * 1000) / 1000;
  }

  /**
   * selectBestPath — main entry point.
   * @returns selectedPath, candidatePaths, rejectedCandidates, paretoFrontier,
   *          selectionReason, explorationDecision, confidence, estimatedRegret
   */
  async selectBestPath({ orgId, task, problemSignature, familyId, options = {} }) {
    // Candidate discovery within family
    const { rows } = await pool.query(
      `SELECT * FROM resolution_paths
       WHERE organization_id=$1 AND family_id=$2 AND status IN ('ACTIVE','CANDIDATE','CANONICAL')
       ORDER BY version DESC`,
      [orgId, familyId]);

    const hardRejected = [];
    const compatible = [];
    for (const p of rows) {
      const storedSig = p.provenance?.signatureExample;
      if (storedSig) {
        const { signaturesCompatible } = await import('./signature.js');
        const c = signaturesCompatible(problemSignature, storedSig);
        if (!c.compatible) { hardRejected.push({ pathId: p.id, conflicts: c.conflicts }); continue; }
      }
      compatible.push(p);
    }

    if (!compatible.length) {
      return { decision: 'RESEARCH', selectedPath: null, candidatePaths: [],
        rejectedCandidates: hardRejected, paretoFrontier: [], selectionReason: 'no compatible path',
        explorationDecision: null, confidence: null, estimatedRegret: null, selectionLLMCalls: 0 };
    }

    // Pareto frontier (never destroy non-dominated paths)
    const comparator = options.comparator || (await import('./comparator.js')).default;
    const { frontier } = comparator.frontier(compatible);

    // Statistics per candidate
    const statsMap = await this.getStats(orgId, frontier.map(f => f.id));

    // Constraints gate (exploitation candidates must satisfy minimums)
    const constrainedOut = [];
    const viable = [];
    for (const p of frontier) {
      const stats = statsMap.get(p.id) || null;
      const u = this.riskAdjustedUtility(p, stats, problemSignature);
      const fails =
        (u.expectedQuality < this.minimumQualityThreshold) ||
        ((stats?.failureRate ?? 0) > this.maximumFailureRate) ||
        ((stats?.latencyP90 ?? p.observed_latency_ms ?? 0) > this.maximumLatencyMs);
      if (fails) constrainedOut.push({ pathId: p.id, reason: 'constraint violation', utility: u.utility });
      else viable.push({ path: p, stats, ...u });
    }

    if (!viable.length && frontier.length) {
      // Nothing passes constraints: fall back to highest raw quality on frontier (documented rule)
      const bestQ = [...frontier].sort((a,b)=>(parseFloat(b.quality_score)||0)-(parseFloat(a.quality_score)||0))[0];
      viable.push({ path: bestQ, stats: statsMap.get(bestQ.id) || null, ...this.riskAdjustedUtility(bestQ, statsMap.get(bestQ.id) || null, problemSignature) });
      constrainedOut.push(...frontier.filter(f=>f.id!==bestQ.id).map(f=>({pathId:f.id, reason:'below thresholds'})));
    }

    viable.sort((a,b)=>b.utility-a.utility);
    const topExploit = viable[0];

    // ---- Adaptive exploration / exploitation ----
    const totalObs = rows.reduce((a,p)=>a+(p.observed_executions||p.usage_count||0),0);
    const explorationRate = this.adaptiveExplorationRate(frontier, statsMap, totalObs);
    const exploreRoll = Math.random();
    const promisingUnderexplored = frontier.filter(p => {
      const s = statsMap.get(p.id);
      const n = s?.sampleSize ?? 0;
      const q = s?.qualityMean ?? parseFloat(p.quality_score) ?? 0;
      return n < 3 && q >= this.minimumQualityThreshold;
    }).filter(p => p.id !== topExploit.path.id);

    let explorationDecision = { mode: 'exploitation', rate: explorationRate, rolled: exploreRoll };
    let selected = topExploit?.path || null;
    let selectedUtility = topExploit?.utility ?? null;
    let selectedReasonParts = topExploit ? [
      `utility ${topExploit.utility}`,
      `expectedQuality ${topExploit.expectedQuality}`,
      `uncertainty ${topExploit.uncertainty}`,
      `failureRisk ${topExploit.failureRisk}`
    ] : [];

    // UCB-style: explore the most promising underexplored candidate when roll hits
    if (promisingUnderexplored.length && exploreRoll < explorationRate) {
      const totalN = rows.reduce((a,p)=>a+(p.observed_executions||p.usage_count||0),0) || 1;
      const ucb = promisingUnderexplored.map(p => {
        const s = statsMap.get(p.id);
        const n = s?.sampleSize ?? (p.observed_executions||p.usage_count||1);
        const q = s?.qualityMean ?? parseFloat(p.quality_score) ?? 0.5;
        return { p, score: q + this.ucbCoefficient * Math.sqrt(Math.log(totalN)/n) };
      }).sort((x,y)=>y.score-x.score)[0];
      selected = ucb.p;
      selectedUtility = { utility: ucb.score, explorationUCB: true };
      explorationDecision = {
        mode: 'exploration',
        rate: explorationRate,
        rolled: exploreRoll,
        target: selected.id,
        targetSampleSize: statsMap.get(selected.id)?.sampleSize ?? 0,
        strategy: 'UCB-promising-underexplored'
      };
      selectedReasonParts.push(`exploration (UCB ${ucb.score.toFixed(2)}, n=${ucb.p ? (statsMap.get(ucb.p.id)?.sampleSize ?? 0) : 0})`);
    }

    const confidence = selected ? this.confidenceFor(selected, statsMap.get(selected.id)) : null;

    // Estimated regret vs best observable utility among all viable candidates
    const bestObservableUtility = Math.max(...viable.map(v=>v.utility));
    const estimatedRegret = selectedUtility?.utility != null
      ? Math.round((bestObservableUtility - (selectedUtility.utility)) * 1000) / 1000
      : null;

    return {
      decision: 'PATH_SELECTED',
      selectedPath: selected ? { id: selected.id, version: selected.version,
        status: selected.status, steps: selected.steps, qualityScore: selected.quality_score } : null,
      candidatePaths: frontier.map(f=>({ id:f.id, version:f.version, qualityScore:f.quality_score })),
      rejectedCandidates: {
        hardRejected,
        constrainedOut
      },
      paretoFrontier: frontier.map(f=>f.id),
      selectionReason: selectedReasonParts.join(' | ') + (constrainedOut.length? ` | constraints excluded ${constrainedOut.length}`:''),
      explorationDecision,
      confidence,
      estimatedRegret,
      selectionLLMCalls: 0,
      contextAddedTokens: 0,
      request_id: undefined
    };
  }

  confidenceFor(path, stats) {
    const n = stats?.sampleSize ?? 0;
    const unc = this.uncertainty(stats);
    let level = n >= 30 && unc < 0.25 ? 'high' : n >= 8 ? 'medium' : 'low';
    return { level, sampleSize: n, uncertainty: Math.round(unc*1000)/1000 };
  }
}

export default new PathSelectionEngine();

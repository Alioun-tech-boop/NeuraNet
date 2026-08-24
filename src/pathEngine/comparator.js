/**
 * PathComparator — Pareto domination across SEPARATE dimensions.
 *
 * A dominates B only when:
 *   - A >= B on every observed dimension, AND
 *   - A > B on at least one, AND
 *   - both have enough executions to be comparable (minExecutions).
 * Dimensions: quality, latency (inverted), tokens (inverted), toolCalls (inverted), failureRate (inverted).
 */
export class PathComparator {
  constructor(opts = {}) {
    this.minExecutions = opts.minExecutions ?? 1;
    // Weights used ONLY for choosing bestKnown among the Pareto frontier,
    // never for elimination. Configurable per family.
    this.weights = opts.weights ?? { quality: 0.5, speed: 0.2, cost: 0.15, reliability: 0.15 };
  }

  dimensions(path) {
    const exec = Math.max(1, path.observed_executions || path.usage_count || 1);
    const hasLat = path.observed_latency_ms != null;
    const hasTok = path.observed_tokens != null;
    const hasTool = path.observed_tool_calls != null;
    return {
      quality: parseFloat(path.quality_score) || 0.5,
      latency: hasLat ? path.observed_latency_ms : null,   // lower better
      tokens: hasTok ? path.observed_tokens : null,        // lower better
      toolCalls: hasTool ? path.observed_tool_calls : null,// lower better
      failureRate: (path.observed_failures || 0) / exec,
      measured: { latency: hasLat, tokens: hasTok, toolCalls: hasTool }
    };
  }

  dominates(a, b) {
    const da = this.dimensions(a);
    const db = this.dimensions(b);
    if ((a.observed_executions || a.usage_count || 1) < this.minExecutions) return false;
    let strictlyBetter = false;

    if (da.quality < db.quality) return false;
    if (da.quality > db.quality) strictlyBetter = true;
    // Unmeasured dims are NEUTRAL (never count as advantage)
    if (da.measured.latency && db.measured.latency) {
      if (da.latency > db.latency) return false;
      if (da.latency < db.latency) strictlyBetter = true;
    }
    if (da.measured.tokens && db.measured.tokens) {
      if (da.tokens > db.tokens) return false;
      if (da.tokens < db.tokens) strictlyBetter = true;
    }
    if (da.measured.toolCalls && db.measured.toolCalls) {
      if (da.toolCalls > db.toolCalls) return false;
      if (da.toolCalls < db.toolCalls) strictlyBetter = true;
    }
    if (da.failureRate > db.failureRate) return false;
    if (da.failureRate < db.failureRate) strictlyBetter = true;

    return strictlyBetter;
  }

  /** Compare for reporting: BETTER / WORSE / PARETO_EQUAL */
  compare(a, b) {
    if (this.dominates(a, b)) return 'BETTER';
    if (this.dominates(b, a)) return 'WORSE';
    return 'PARETO_EQUAL';
  }

  /** Compute the Pareto frontier over an array of paths. */
  frontier(paths) {
    const active = [];
    const dominated = [];
    for (const p of paths) {
      const isDominated = paths.some(other =>
        other.id !== p.id && this.dominates(other, p));
      (isDominated ? dominated : active).push(p);
    }
    return { frontier: active, dominated };
  }

  /**
   * bestKnownPathAtTimeT: pick from Pareto frontier using configurable weights.
   * Deterministic; ties broken by version then created_at.
   */
  bestKnown(frontier) {
    if (!frontier.length) return null;
    let best = frontier[0];
    let bestScore = -1;
    for (const p of frontier) {
      const d = this.dimensions(p);
      const score =
        d.quality * this.weights.quality +
        (1 - Math.min(d.latency / 30000, 1)) * this.weights.speed +
        (1 - Math.min(d.tokens / 5000, 1)) * this.weights.cost +
        (1 - d.failureRate) * this.weights.reliability;
      if (score > bestScore ||
          (score === bestScore && p.version > best.version)) {
        bestScore = score; best = p;
      }
    }
    return best;
  }
}

export default new PathComparator();

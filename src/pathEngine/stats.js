/**
 * Path execution statistics — separate dimensions, never collapsed early.
 * Computed from path_executions history (per spec §8).
 */
export function computePathStats(executions, { recentWindow = 5 } = {}) {
  const ok = executions.filter(e => e.success !== false && e.quality_score != null);
  const n = executions.length;
  const sorted = f => executions.map(f).filter(v => v != null).sort((a,b)=>a-b);

  const qualities = sorted(e => e.quality_score);
  const latencies = sorted(e => e.latency_ms);
  const tokens = sorted(e => (e.input_tokens||0)+(e.output_tokens||0));
  const toolCalls = sorted(e => Math.max(e.tavily_calls||0, 0));

  const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
  const median = a => a.length ? a[Math.floor(a.length/2)] : null;
  const p90 = a => a.length ? a[Math.min(a.length-1, Math.floor(a.length*0.9))] : null;

  const successes = executions.filter(e => e.success !== false).length;
  const failures = n - successes;

  // Non-stationarity: recent window vs everything before it
  const chronological = [...executions].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const recentSlice = chronological.slice(-recentWindow).filter(e=>e.quality_score!=null);
  const olderSlice = chronological.slice(0, -recentWindow).filter(e=>e.quality_score!=null);
  const recentQuality = mean(recentSlice.map(e=>e.quality_score));
  const historicalQuality = mean(olderSlice.map(e=>e.quality_score));

  return {
    sampleSize: n,
    executionCount: n,
    successCount: successes,
    failureCount: failures,
    failureRate: n ? failures/n : 0,

    qualityMean: mean(qualities),
    qualityMin: qualities[0] ?? null,
    qualityMax: qualities[qualities.length-1] ?? null,

    latencyMean: mean(latencies),
    latencyMedian: median(latencies),
    latencyP90: p90(latencies),

    tokenMean: mean(tokens),
    toolCallMean: mean(toolCalls),

    recentQualityMean: recentQuality ?? null,
    historicalQualityMean: historicalQuality ?? null,
    degradationDetected: (recentQuality != null && historicalQuality != null &&
                          (historicalQuality - recentQuality) > 0.08),

    // Ordered newest-first reference for recency-weighted logic
    _chronologicalLastQuality: chronological.length ? chronological[chronological.length-1].quality_score : null
  };
}

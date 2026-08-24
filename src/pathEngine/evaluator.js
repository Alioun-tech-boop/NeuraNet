/**
 * PathEvaluator - transparent composite scoring.
 * Correctness and verification dominate; speed never beats quality on its own.
 */
export function evaluatePathExecution({ quality, verificationStatus, sourceCount, latencyMs, llmCalls, failures = 0, executions = 1 }) {
  const components = {};

  components.correctness = (quality ?? 0.5) * 0.35;
  components.verification =
    verificationStatus === 'verified' ? 0.25 :
    verificationStatus === 'partially_verified' ? 0.10 : 0;
  components.reliability = Math.max(0, (1 - failures / Math.max(executions, 1))) * 0.15;
  components.sourceQuality = Math.min((sourceCount || 0) / 3, 1) * 0.10;
  // Efficiency is capped so a fast-but-wrong path can never outrank a correct one.
  const latencyScore = 1 - Math.min((latencyMs || 5000) / 30000, 1);
  const callEfficiency = 1 - Math.min(((llmCalls || 1) - 1) / 5, 1);
  components.efficiency = ((latencyScore * 0.5) + (callEfficiency * 0.5)) * 0.15;

  const composite = Object.values(components).reduce((a, b) => a + b, 0);
  return {
    score: Math.round(composite * 100) / 100,
    components: Object.fromEntries(Object.entries(components).map(([k, v]) => [k, Math.round(v * 1000) / 1000]))
  };
}

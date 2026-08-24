import { ProductionEngine } from '../productions/engine.js';

/**
 * ProblemSignature - structural representation of a problem (never its answer).
 * Deterministic, zero LLM. Reuses the hardened extraction from ProductionEngine
 * so legacy semantic-safety behavior is preserved.
 */
const legacy = new ProductionEngine();

export function buildProblemSignature(task, domainOverride) {
  const sig = legacy.semanticSignature(task);
  if (domainOverride) {
    sig.domain = domainOverride;
  }
  // Family key: stable across linguistic formulations of the same problem shape.
  const familyKey = [
    sig.domain,
    sig.subdomain !== 'unspecified' ? sig.subdomain : '-',
    sig.intent,
    sig.jurisdiction !== 'unspecified' ? sig.jurisdiction : '-',
    sig.granularity !== 'institution' || true ? sig.granularity : 'institution'
  ].join('|').slice(0, 120);

  return { ...sig, familyKey };
}

export function signaturesCompatible(sigA, sigB) {
  return legacy.compareSignatures(sigA, sigB);
}

export function lexicalSimilarity(a, b) {
  return legacy.semanticMatch(a, b);
}

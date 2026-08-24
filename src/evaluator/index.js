/**
 * Evaluator - Generic interface per §25
 * Domain-specific evaluators return common structure
 */
export class Evaluator {
  async evaluate(production, taskProfile) {
    throw new Error('Not implemented');
  }

  // Common quality scoring
  baseQuality({ answer, sources, claims, verificationStatus, confidence }) {
    let score = 0.5;
    if (answer && answer.length > 50) score += 0.1;
    if (sources && sources.length > 0) score += 0.1;
    if (verificationStatus === 'verified') score += 0.15;
    else if (verificationStatus === 'partially_verified') score += 0.05;
    score += (confidence || 0.5) * 0.1;
    return Math.min(1.0, Math.round(score * 100) / 100);
  }
}

export class ResearchEvaluator extends Evaluator {
  async evaluate(production, taskProfile) {
    const quality = this.baseQuality(production);
    return {
      quality,
      correctness: production.verificationStatus === 'verified' ? 0.9 : 0.5,
      confidence: production.confidence,
      verification: production.verificationStatus,
      evidence: production.sources?.length || 0,
      errors: [],
      metrics: { sourceCount: production.sources?.length || 0 }
    };
  }
}

export class CodeEvaluator extends Evaluator {
  async evaluate(production, taskProfile) {
    // For coding: check if code was generated, tests passed, etc.
    // For MVP, use baseQuality plus code-specific checks
    const hasCode = production.answer && (production.answer.includes('```') || production.answer.includes('function') || production.answer.includes('const'));
    let score = this.baseQuality(production);
    if (hasCode) score = Math.min(1.0, score + 0.1);
    return {
      quality: score,
      correctness: hasCode ? 0.7 : 0.3,
      confidence: production.confidence,
      verification: hasCode ? 'partially_verified' : 'unverified',
      evidence: 1,
      errors: hasCode ? [] : ['No code detected'],
      metrics: { hasCode }
    };
  }
}

export class FinanceEvaluator extends Evaluator {
  async evaluate(production, taskProfile) {
    return { quality: this.baseQuality(production), correctness: 0.6, confidence: production.confidence, verification: production.verificationStatus, evidence: 1, errors: [], metrics: {} };
  }
}

export class DataEvaluator extends Evaluator {
  async evaluate(production, taskProfile) {
    return { quality: this.baseQuality(production), correctness: 0.6, confidence: production.confidence, verification: production.verificationStatus, evidence: 1, errors: [], metrics: {} };
  }
}

export function createEvaluator(domain) {
  switch ((domain || '').toLowerCase()) {
    case 'coding': return new CodeEvaluator();
    case 'finance': return new FinanceEvaluator();
    case 'data_analysis': return new DataEvaluator();
    default: return new ResearchEvaluator();
  }
}

/**
 * KnowledgeItem - Generic wrapper around Production per §2, §5
 */
export class KnowledgeItem {
  constructor(production) {
    this.id = production.id;
    this.query = production.original_query;
    this.normalizedQuery = production.normalized_query;
    this.answer = production.answer;
    this.domain = production.domain;
    this.claims = production.claims || [];
    this.sources = production.sources || [];
    this.qualityScore = parseFloat(production.quality_score) || 0.5;
    this.confidence = parseFloat(production.confidence) || 0.5;
    this.verificationStatus = production.verification_status;
    this.freshnessScore = parseFloat(production.freshness_score) || 1.0;
    this.isCanonical = production.is_canonical;
    this.createdAt = production.created_at;
    this.lastVerifiedAt = production.last_verified_at;
    this.provenance = {
      productionId: production.id,
      canonicalId: production.canonical_id,
      agentId: production.agent_id
    };
  }

  static fromProduction(production) {
    return new KnowledgeItem(production);
  }
}

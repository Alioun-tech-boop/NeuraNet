import crypto from 'node:crypto';
import { pool } from '../db/connection.js';

export class ProductionEngine {
  normalizeQuery(query) {
    if (!query || typeof query !== 'string') return '';
    return query.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
  }

  hashQuery(normalized) {
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
  }

  inferDomain(query) {
    const lower = (query || '').toLowerCase();
    if (lower.includes('finance') || lower.includes('market') || lower.includes('stock')) return 'finance';
    if (lower.includes('energy') || lower.includes('renewable') || lower.includes('electricity')) return 'energy';
    if (lower.includes('health') || lower.includes('medical')) return 'healthcare';
    return 'general';
  }

  freshnessForDomain(domain, createdAt, lastVerifiedAt) {
    const now = Date.now();
    const last = lastVerifiedAt ? new Date(lastVerifiedAt).getTime() : new Date(createdAt).getTime();
    const ageHours = (now - last) / (1000 * 60 * 60);
    // Energy/Finance: stale after 7 days, general: 30 days
    const ttlHours = (domain === 'energy' || domain === 'finance') ? 7 * 24 : 30 * 24;
    const freshness = Math.max(0, 1 - (ageHours / ttlHours));
    return Math.round(freshness * 100) / 100;
  }

  evaluateQuality({ answer, sources, claims, verificationStatus, confidence }) {
    let score = 0.5;
    const components = {};

    // Completeness
    const hasSubstance = answer && answer.length > 50;
    components.completeness = hasSubstance ? 0.1 : 0;
    score += components.completeness;

    // Source quality
    const hasSources = sources && sources.length > 0;
    const hasOfficialSource = hasSources && sources.some(s => s.url && s.url.includes('energycom'));
    components.sourceQuality = hasOfficialSource ? 0.15 : hasSources ? 0.05 : 0;
    score += components.sourceQuality;

    // Verification
    if (verificationStatus === 'verified') components.verification = 0.15;
    else if (verificationStatus === 'partially_verified') components.verification = 0.05;
    else components.verification = 0;
    score += components.verification;

    // Confidence
    components.confidence = (confidence || 0.5) * 0.1;
    score += components.confidence;

    score = Math.min(1.0, Math.round(score * 100) / 100);
    return { qualityScore: score, components };
  }

  async findCluster(orgId, queryHash) {
    const { rows } = await pool.query(
      `SELECT * FROM production_clusters WHERE organization_id = $1 AND query_signature = $2`,
      [orgId, queryHash]
    );
    return rows[0] || null;
  }

  async findCanonical(orgId, queryHash) {
    const cluster = await this.findCluster(orgId, queryHash);
    if (!cluster || !cluster.canonical_production_id) return null;
    const { rows } = await pool.query(`SELECT * FROM productions WHERE id = $1`, [cluster.canonical_production_id]);
    return rows[0] || null;
  }

  // Simple similarity: normalized exact hash for now, plus trigram for similar
  // Lightweight semantic matching: stemmed token overlap + entity/country compatibility
  // Deterministic, no LLM, prevents both false reuse and false rejection
  static STOPWORDS = new Set(['what','which','who','is','the','in','and','of','for','to','a','an','its','it','are','does','do','how','has','have','by','on','at','that','this','with','from','their','be','been','main','currently','responsibilities','role','powers','responsible']);

  stem(word) {
    return word
      .replace(/(ations|ation|tions|tion|ings|ing|ies|ied|eds|ed|es|s)$/,'')
      .replace(/ie$/,'y');
  }

  contentTokens(text) {
    let t = (text || '').toLowerCase().replace(/[^\w\s]/g,' ');
    // Canonicalize concept variants so lexical forms don't break semantic matching
    t = t.replace(/regulat\w*/g,'regulator').replace(/(responsibilit\w*|responsible)/g,'role').replace(/institution|agency|body|authority/g,'institution');
    const tokens = t.split(/\s+/)
      .filter(w => w.length > 2 && !ProductionEngine.STOPWORDS.has(w))
      .map(w => {
        if (w === 'ghanaian') return 'ghana';
        return this.stem(w);
      });
    return tokens;
  }

  extractSectors(text) {
    const sectors = ['banking','bank','telecommunication','telecom','securities','insurance','electricity','mining','health','data'];
    const t = (text||'').toLowerCase();
    const found = sectors.filter(s => t.includes(s));
    return found;
  }

  extractCountries(text) {
    const known = ['ghana','kenya','nigeria','senegal','mali','burkina','ivory',"cote",'togo','benin','liberia','sierra','guinea','africa'];
    const t = (text||'').toLowerCase();
    return known.filter(c => t.includes(c));
  }

  extractSectors(text) {
    const sectors = ['banking','bank','telecommunication','telecom','securities','insurance','electricity','mining','health','data'];
    const t = (text||'').toLowerCase();
    const found = sectors.filter(s => t.includes(s));
    return found;
  }

  semanticMatch(queryA, queryB) {
    const tokA = new Set(this.contentTokens(queryA));
    const tokB = new Set(this.contentTokens(queryB));
    if (tokA.size === 0 || tokB.size === 0) return 0;
    let inter = 0;
    for (const t of tokA) if (tokB.has(t)) inter++;
    const jaccard = inter / (tokA.size + tokB.size - inter);

    // Hard dimension checks: countries must be compatible
    const countriesA = this.extractCountries(queryA);
    const countriesB = this.extractCountries(queryB);
    if (countriesA.length && countriesB.length) {
      const shared = countriesA.filter(c => countriesB.includes(c));
      if (shared.length === 0) return 0; // different jurisdictions -> never equivalent
    }
    // Sector conflict detection: if the new query targets a sector absent from the candidate, reject
    const sectorsA = this.extractSectors(queryA);
    const sectorsB = this.extractSectors(queryB);
    if (sectorsB.length && !sectorsB.every(s => sectorsA.includes(s))) return 0;
    if (sectorsA.length && sectorsB.length === 0) return 0;
    return jaccard;
  }

  async findSimilarProductions(orgId, normalizedQuery, queryHash, limit = 5) {
    const exact = await this.findCanonical(orgId, queryHash);
    if (exact) return [exact];

    // Domain filter prevents cross-domain reuse
    const inferredDomain = this.inferDomain(normalizedQuery);
    const { rows } = await pool.query(
      `SELECT *, similarity(normalized_query, $2) as sim
       FROM productions
       WHERE organization_id = $1 AND is_canonical = true AND (domain = $3 OR domain = 'general')
       ORDER BY sim DESC LIMIT $4`,
      [orgId, normalizedQuery, inferredDomain, limit * 3]
    );
    // Semantic match on original queries (stemmed overlap + entity checks), threshold tuned to avoid false reuse
    return rows
      .map(r => ({ ...r, semanticScore: this.semanticMatch(normalizedQuery, r.normalized_query || r.original_query) }))
      .filter(r => r.semanticScore >= 0.45)
      .sort((a,b) => b.semanticScore - a.semanticScore)
      .slice(0, limit);
  }

  decide(canonical, task) {
    if (!canonical) return 'RESEARCH';
    const freshness = this.freshnessForDomain(canonical.domain, canonical.created_at, canonical.last_verified_at);
    const confidence = parseFloat(canonical.confidence) || 0.5;
    const quality = parseFloat(canonical.quality_score) || 0.5;
    const isVerified = canonical.verification_status === 'verified';

    // REUSE if high quality, verified, fresh, confident
    if (quality >= 0.7 && isVerified && freshness >= 0.7 && confidence >= 0.7) {
      return 'REUSE';
    }
    // REFRESH if exists but stale or medium quality
    if (freshness < 0.5 || quality < 0.7) {
      return 'REFRESH';
    }
    // Default: REUSE if reasonable
    if (freshness >= 0.5 && confidence >= 0.5) return 'REUSE';
    return 'RESEARCH';
  }

  compareProductions(existing, incoming) {
    if (!existing) return 'NEW';
    const existingQuality = parseFloat(existing.quality_score) || 0;
    const incomingQuality = parseFloat(incoming.quality_score) || 0;
    const existingFreshness = this.freshnessForDomain(existing.domain, existing.created_at, existing.last_verified_at);
    const incomingFreshness = incoming.freshness_score || 1.0;

    // Check for conflicting claims (simple: different answers with same query hash but different content)
    const answersDiffer = existing.answer && incoming.answer && existing.answer.slice(0, 50) !== incoming.answer.slice(0, 50);
    const bothVerified = existing.verification_status === 'verified' && incoming.verification_status === 'verified';
    if (answersDiffer && bothVerified) return 'CONFLICTING';

    if (incomingQuality > existingQuality + 0.01) return 'BETTER';
    if (Math.abs(incomingQuality - existingQuality) < 0.01 && incomingFreshness >= existingFreshness) return 'EQUIVALENT';
    if (incomingQuality < existingQuality - 0.01) return 'WORSE';
    return 'EQUIVALENT';
  }

  async createProduction({ organizationId, agentId, originalQuery, normalizedQuery, queryHash, answer, domain, claims, sources, verificationStatus, confidence, qualityScore, freshnessScore, clusterId }) {
    const { rows } = await pool.query(
      `INSERT INTO productions (organization_id, agent_id, original_query, normalized_query, query_hash, cluster_id, answer, domain, claims, sources, verification_status, confidence, quality_score, freshness_score, is_canonical, canonical_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14,false,NULL)
       RETURNING *`,
      [organizationId, agentId, originalQuery, normalizedQuery, queryHash, clusterId, answer, domain, JSON.stringify(claims||[]), JSON.stringify(sources||[]), verificationStatus||'unverified', confidence||0.5, qualityScore||0.5, freshnessScore||1.0]
    );
    return rows[0];
  }

  async ensureCluster(orgId, queryHash, domain) {
    let cluster = await this.findCluster(orgId, queryHash);
    if (!cluster) {
      const { rows } = await pool.query(
        `INSERT INTO production_clusters (organization_id, query_signature, domain, production_count)
         VALUES ($1,$2,$3,0) ON CONFLICT (organization_id, query_signature) DO UPDATE SET updated_at = NOW() RETURNING *`,
        [orgId, queryHash, domain]
      );
      cluster = rows[0];
    }
    return cluster;
  }

  async updateCanonical(clusterId, productionId) {
    await pool.query(`UPDATE production_clusters SET canonical_production_id = $1, updated_at = NOW(), production_count = production_count + 1 WHERE id = $2`, [productionId, clusterId]);
    await pool.query(`UPDATE productions SET is_canonical = true, canonical_id = $1 WHERE id = $1`, [productionId]);
    // Mark previous canonical as superseded
    await pool.query(`UPDATE productions SET is_canonical = false, status = 'superseded' WHERE cluster_id = $1 AND id != $2 AND is_canonical = true`, [clusterId, productionId]);
  }
}

export default new ProductionEngine();

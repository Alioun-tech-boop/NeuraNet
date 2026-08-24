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

  /**
   * Deterministic multi-dimension semantic signature per hardening spec.
   * No LLM. Extracts: domain, subdomain, jurisdiction, intent, object,
   * temporalScope, polarity, granularity.
   */
  semanticSignature(query) {
    const t = (query || '').toLowerCase();

    // --- Jurisdiction ---
    const countries = this.extractCountries(t);
    const jurisdiction = countries.length === 1 ? countries[0]
      : countries.length > 1 ? 'multi'
      : 'unspecified';

    // --- Temporal scope ---
    let temporalScope = 'current';
    if (/\b(19|20)\d{2}\b/.test(t)) {
      temporalScope = 'historical';
    } else if (/was |were |historical|formerly|previously/.test(t)) {
      temporalScope = 'historical';
    }

    // --- Polarity ---
    let polarity = 'positive';
    if (/\bnot\b|\bnever\b|\bdoes not\b|\bis not\b|\bare not\b/.test(t)) {
      polarity = 'negative';
    } else if (/^(is|are|does|do|was|were|can|could|should|has|have)\b/.test(t.trim())) {
      // Yes/no questions START with an auxiliary verb
      polarity = 'yesno_question';
    }

    // --- Intent --- (specific information-needs checked before generic subjects)
    let intent = 'identify';
    if (/licen[cs]e?s?\b/.test(t)) intent = 'licensing';
    else if (/penalt|sanction|\bfine\b/.test(t)) intent = 'legal_requirement';
    else if (/capacit|how much|how many|generate[d]?\b/.test(t)) intent = 'current_status';
    else if (/financ|fund|grant/.test(t)) intent = 'financing';
    else if (/invest/.test(t)) intent = 'investment';
    else if (/polic|target|framework|strategy/.test(t)) intent = 'policy';
    else if (/impact|environment/.test(t)) intent = 'environmental_impact';
    else if (/import/.test(t)) intent = 'trade';
    else if (/requirement|standard|technical/.test(t)) intent = 'technical_requirement';
    else if (/\blaw|legislation|acts?\b/.test(t)) intent = 'legal_framework';
    else if (/mandate|role|responsib|powers/.test(t)) intent = 'identify_with_role';
    else if (/enforce|compliance|monitor/.test(t)) intent = 'enforcement';
    else if (/compan|operator|developer|vendor/.test(t)) intent = 'company_information';

    // --- Question form ---
    let questionForm = 'open';
    const trimmed = t.trim();
    if (/^(is|are|does|do|was|were|can|could|should)\b/.test(trimmed)) questionForm = 'yesno';
    else if (/^how\s+(can|could|do|does|to)\b/.test(trimmed) || /how\s+(can|could)\b/.test(t)) questionForm = 'procedure';
    else if (/^(who|which)\b/.test(trimmed)) questionForm = 'identify';
    else if (/^what\s+(is|are)\b/.test(trimmed)) questionForm = 'description';

    // --- Granularity / object type ---
    let granularity = 'institution';
    if (/licen[cs]/.test(t)) granularity = 'license';
    else if (/compan|operator|investor|developer/.test(t)) granularity = 'company';
    else if (/polic|target|framework/.test(t)) granularity = 'policy';
    else if (/\blaw|legislation\b/.test(t)) granularity = 'law';
    else if (/project|plant|farm\b/.test(t)) granularity = 'project';
    else if (/technolog|equipment|install/.test(t)) granularity = 'technology';
    else if (/financ|fund|investment|capital/.test(t)) granularity = 'financial_product';
    else if (/market/.test(t)) granularity = 'market';

    // --- Subdomain ---
    let subdomain = '';
    if (/renewable|solar|wind/.test(t)) subdomain = 'renewable_energy';
    else if (/electricity|power grid/.test(t)) subdomain = 'electricity';
    else if (/\bbank/.test(t)) subdomain = 'banking';
    else if (/telecom/.test(t)) subdomain = 'telecommunications';
    else if (/securit/.test(t)) subdomain = 'securities';
    else if (/data protection|privacy/.test(t)) subdomain = 'data_protection';
    else if (/pesticide|agrochemical/.test(t)) subdomain = 'pesticides';
    else if (/competition|antitrust/.test(t)) subdomain = 'competition';
    else if (/insurance/.test(t)) subdomain = 'insurance';

    // --- Object: cross-sector detection ---
    const sectors = this.extractSectors(t);
    let object = `${subdomain || this.inferDomain(t)}_${intent}`;
    const sectorMap = { bank:'banking', banking:'banking', telecommunication:'telecommunications', telecom:'telecommunications', securities:'securities', insurance:'insurance', electricity:'electricity', mining:'mining', health:'health', data:'data' };
    const foreignSector = sectors.find(s => {
      const mapped = sectorMap[s] || s;
      return subdomain && !subdomain.includes(mapped);
    });
    if (subdomain && foreignSector) {
      object = `${subdomain}_x_${sectorMap[foreignSector] || foreignSector}`;
    }

    return {
      domain: this.inferDomain(t),
      subdomain: subdomain || 'unspecified',
      jurisdiction,
      intent,
      object,
      temporalScope,
      polarity,
      granularity,
      questionForm
    };
  }

  /**
   * Hard compatibility check between two signatures.
   * Returns { compatible, conflicts[] }. Any conflict forbids REUSE regardless of similarity.
   */
  compareSignatures(sigA, sigB) {
    const conflicts = [];
    if (sigA.jurisdiction !== 'unspecified' && sigB.jurisdiction !== 'unspecified' &&
        sigA.jurisdiction !== sigB.jurisdiction) {
      conflicts.push(`jurisdiction: ${sigA.jurisdiction} != ${sigB.jurisdiction}`);
    }
    if (sigA.temporalScope !== sigB.temporalScope) {
      conflicts.push(`temporalScope: ${sigA.temporalScope} != ${sigB.temporalScope}`);
    }
    const polA = sigA.polarity.startsWith('negative') ? 'negative' : 'positive';
    const polB = sigB.polarity.startsWith('negative') ? 'negative' : 'positive';
    if (polA !== polB) conflicts.push(`polarity: ${polA} != ${polB}`);
    if (sigA.subdomain !== 'unspecified' && sigB.subdomain !== 'unspecified' &&
        sigA.subdomain !== sigB.subdomain) {
      conflicts.push(`subdomain: ${sigA.subdomain} != ${sigB.subdomain}`);
    }
    // Intent mismatch: identify-family collapses together, but any two DISTINCT
    // specific intents conflict (licensing != company_information != financing...)
    const intentFamily = (i) => (i === 'identify' || i === 'identify_with_role') ? 'identify' : i;
    if (intentFamily(sigA.intent) !== intentFamily(sigB.intent)) {
      conflicts.push(`intent: ${sigA.intent} != ${sigB.intent}`);
    }
    // Question form: identify vs procedure vs description are different information needs
    const formA = sigA.questionForm || 'open';
    const formB = sigB.questionForm || 'open';
    if (formA !== formB && [formA, formB].includes('procedure')) {
      conflicts.push(`questionForm: ${formA} != ${formB}`);
    }
    // Granularity mismatch on specific object types
    const specificGran = ['license','company','policy','law','project','technology','financial_product'];
    if (sigA.granularity !== sigB.granularity &&
        specificGran.includes(sigA.granularity) !== specificGran.includes(sigB.granularity)) {
      conflicts.push(`granularity: ${sigA.granularity} != ${sigB.granularity}`);
    }
    return { compatible: conflicts.length === 0, conflicts };
  }

  /**
   * Full compatibility evaluation: signature comparison first (hard),
   * then lexical similarity as soft signal.
   */
  evaluateCompatibility(newQuery, candidateQuery) {
    const sigNew = this.semanticSignature(newQuery);
    const sigCand = this.semanticSignature(candidateQuery);
    const { compatible, conflicts } = this.compareSignatures(sigNew, sigCand);
    const similarity = this.semanticMatch(newQuery, candidateQuery);
    return {
      signatureNew: sigNew,
      signatureCandidate: sigCand,
      conflicts,
      compatible,
      similarity,
      reuseAllowed: compatible && similarity >= 0.45
    };
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
    // Hard signature compatibility first, then lexical similarity as soft gate
    return rows
      .map(r => {
        const compat = this.evaluateCompatibility(normalizedQuery, r.normalized_query || r.original_query);
        return { ...r, semanticScore: compat.similarity, compat };
      })
      .filter(r => r.compat.reuseAllowed)
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

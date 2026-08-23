import { pool } from '../db/connection.js';

/**
 * Sanitization Patterns - Per ARCHITECTURE-ESSENTIALS §8 and §15
 */

/**
 * Detect and redact sensitive patterns in research text
 * @param {string} text - Raw research text to sanitize
 * @returns {object} - Sanitized text and detected redactions
 */
const sanitizeText = (text) => {
  const redactions = [];
  let sanitized = text;

  const apiKeyPatterns = [
    /[a-zA-Z0-9]{20,}/g,
    /sk-[a-zA-Z0-9]{48}/g,
    /[a-zA-Z0-9]{32,}:\S+/g
  ];

  apiKeyPatterns.forEach((pattern, i) => {
    const matches = text.match(pattern) || [];
    matches.forEach(match => {
      const replacement = `REDACTED_API_KEY_${i}`;
      sanitized = sanitized.replace(match, replacement);
      redactions.push({ type: 'api_key', original: match, replacement });
    });
  });

  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const emailMatches = sanitized.match(emailPattern) || [];
  emailMatches.forEach(match => {
    sanitized = sanitized.replace(match, 'REDACTED_EMAIL');
    redactions.push({ type: 'email', original: match, replacement: 'REDACTED_EMAIL' });
  });

  const phonePattern = /(\+\d{1,3}\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
  const phoneMatches = sanitized.match(phonePattern) || [];
  phoneMatches.forEach(match => {
    sanitized = sanitized.replace(match, 'REDACTED_PHONE');
    redactions.push({ type: 'phone', original: match, replacement: 'REDACTED_PHONE' });
  });

  const sensitiveUrlPattern = /https?:\/\/(?:[^/]+\/)?(?:confidential|private|internal|admin)[^\s]*/gi;
  const urlMatches = sanitized.match(sensitiveUrlPattern) || [];
  urlMatches.forEach(match => {
    sanitized = sanitized.replace(match, 'REDACTED_URL');
    redactions.push({ type: 'url', original: match, replacement: 'REDACTED_URL' });
  });

  const credPattern = /(?:password|passwd|pwd|secret)[\s:=]+['"]?([^'";\s]+)['"]?/gi;
  const credMatches = sanitized.match(credPattern) || [];
  credMatches.forEach((match, i) => {
    const value = match.replace(credPattern, '').trim().replace(/['"]/g, '');
    if (value && value.length > 3 && value.length < 100) {
      const replacement = match.replace(value, 'REDACTED_VALUE');
      sanitized = sanitized.replace(match, replacement);
      redactions.push({ type: 'credential', original: value, replacement });
    }
  });

  const ccPattern = /\b(?:\d[ -]*?){13,16}\b/g;
  const ccMatches = sanitized.match(ccPattern) || [];
  ccMatches.forEach(match => {
    sanitized = sanitized.replace(match, 'REDACTED_CC');
    redactions.push({ type: 'credit_card', original: match, replacement: 'REDACTED_CC' });
  });

  const jwtPattern = /[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
  const jwtMatches = sanitized.match(jwtPattern) || [];
  jwtMatches.forEach(match => {
    sanitized = sanitized.replace(match, 'REDACTED_JWT');
    redactions.push({ type: 'jwt', original: match, replacement: 'REDACTED_JWT' });
  });

  const uuidPattern = /\b[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi;
  const uuidMatches = sanitized.match(uuidPattern) || [];
  uuidMatches.forEach(match => {
    sanitized = sanitized.replace(match, 'REDACTED_UUID');
    redactions.push({ type: 'uuid', original: match, replacement: 'REDACTED_UUID' });
  });

  return {
    sanitized: sanitized.trim(),
    redactions,
    originalLength: text.length,
    sanitizedLength: sanitized.length,
    redactionRatio: text.length > 0 ? (text.length - sanitized.length) / text.length : 0
  };
};

/**
 * Sanitize a full research trace object
 * @param {object} trace - Raw research trace from agent
 * @returns {object} - Sanitized trace with redactions logged
 */
const sanitizeResearchTrace = (trace) => {
  const redactions = [];

  if (trace.original_task && typeof trace.original_task === 'string') {
    const result = sanitizeText(trace.original_task);
    trace.original_task = result.sanitized;
    redactions.push(...result.redactions);
  }

  if (trace.search_queries && Array.isArray(trace.search_queries)) {
    trace.search_queries = trace.search_queries.map(q => {
      if (typeof q === 'string') {
        const result = sanitizeText(q);
        return result.sanitized;
      }
      return q;
    });
  }

  if (trace.sources && Array.isArray(trace.sources)) {
    trace.sources = trace.sources.map(s => {
      if (typeof s === 'object' && s.url_domain) {
        const original = s.url_domain;
        s.url_domain = sanitizeText(original).sanitized;
        redactions.push(...sanitizeText(original).redactions.map(r => ({ ...r, original })));
      }
      return s;
    });
  }

  if (trace.strategy && typeof trace.strategy === 'string') {
    const result = sanitizeText(trace.strategy);
    trace.strategy = result.sanitized;
    redactions.push(...result.redactions);
  }

  if (trace.outcome && typeof trace.outcome === 'string') {
    const result = sanitizeText(trace.outcome);
    trace.outcome = result.sanitized;
    redactions.push(...result.redactions);
  }

  if (trace.metadata && typeof trace.metadata === 'object') {
    const metaStr = JSON.stringify(trace.metadata);
    const cleanStr = sanitizeText(metaStr).sanitized;
    try {
      trace.metadata = JSON.parse(cleanStr);
      redactions.push(...sanitizeText(metaStr).redactions);
    } catch (e) {
      // keep original
    }
  }

  trace.redaction_count = redactions.length;
  return trace;
};

/**
 * Extract strategy from sanitized text
 * @param {string} strategyText - Strategy description text
 * @returns {string[]} - Array of strategy steps
 */
const extractStrategyFromText = (strategyText) => {
  if (!strategyText) return ['conduct_search', 'verify_results'];
  const lower = strategyText.toLowerCase();
  const steps = [];
  if (lower.includes('search') || lower.includes('recherche') || lower.includes('buscar')) steps.push('conduct_search');
  if (lower.includes('verify') || lower.includes('vérifier') || lower.includes('verificar')) steps.push('verify_results');
  if (lower.includes('cross') || lower.includes('cross-check') || lower.includes('crosscheck')) steps.push('cross_check_sources');
  if (lower.includes('filter') || lower.includes('filtrer')) steps.push('filter_results');
  if (lower.includes('rank') || lower.includes('classify')) steps.push('rank_results');
  return steps.length > 0 ? steps : ['conduct_search', 'verify_results'];
};

/**
 * Extract source categories from array of sources
 * @param {object[]} sources - Array of source objects
 * @returns {string[]} - Array of source categories
 */
const extractSourceCategoriesFromArray = (sources) => {
  if (!sources || !Array.isArray(sources)) return [];
  const categories = new Set();
  sources.forEach(s => {
    if (s && typeof s === 'object') {
      if (s.url_domain) {
        const domain = s.url_domain.replace(/^https?:\/\//, '').split('/')[0];
        categories.add(domain);
      }
      if (s.category) categories.add(s.category);
    }
  });
  return Array.from(categories);
};

/**
 * Extract successful approaches from sanitized trace
 * @param {object} trace - Sanitized research trace
 * @returns {string[]} - Array of successful approach descriptions
 */
const extractSuccessfulApproaches = (trace) => {
  const approaches = [];
  if (trace.outcome && typeof trace.outcome === 'string') {
    const lower = trace.outcome.toLowerCase();
    if (lower.includes('found') || lower.includes('success') || lower.includes('completed')) approaches.push('successful_outcome');
  }
  if (trace.search_queries && Array.isArray(trace.search_queries)) {
    trace.search_queries.forEach(q => {
      if (typeof q === 'string' && q.length > 5) approaches.push('query:' + q.substring(0, 30));
    });
  }
  return approaches.length > 0 ? approaches : ['conducted_research'];
};

/**
 * Extract failed approaches from sanitized trace
 * @param {object} trace - Sanitized research trace
 * @returns {string[]} - Array of failure descriptions
 */
const extractFailedApproaches = (trace) => {
  const failures = [];
  if (trace.outcome && typeof trace.outcome === 'string') {
    const lower = trace.outcome.toLowerCase();
    if (lower.includes('failed') || lower.includes('fail') || lower.includes('error')) failures.push('outcome_indicates_failure');
  }
  if (trace.sources && Array.isArray(trace.sources)) {
    trace.sources.forEach(s => {
      if (s && s.failed_usage_count > 0) failures.push('source_unreliable:' + (s.url_domain || 'unknown').substring(0, 20));
    });
  }
  if (trace.outcome && trace.outcome.verification_result === 'failed') failures.push('verification_failed');
  return failures.length > 0 ? failures : ['no_explicit_failures_detected'];
};

/**
 * Determine freshness requirement based on task domain
 * @param {string} taskText - Raw task description
 * @returns {number} - Freshness score (0.0-1.0, higher = more fresh)
 */
const determineFreshnessRequirement = (taskText) => {
  if (!taskText) return 1.0;
  const lower = taskText.toLowerCase();
  const sensitiveDomains = [
    'finance', 'market', 'stock', 'price', 'crypto', 'currency',
    'politics', 'election', 'news', 'regulation',
    'weather', 'temperature', 'forecast'
  ];
  const stableDomains = [
    'mathematics', 'philosophy', 'history', 'literature',
    'software', 'library', 'framework', 'algorithm'
  ];
  if (sensitiveDomains.some(d => lower.includes(d))) return 0.3;
  if (stableDomains.some(d => lower.includes(d))) return 0.9;
  return 0.7;
};

/**
 * Extract experience knowledge from sanitized trace
 * @param {object} sanitizedTrace - Trace after sanitization
 * @param {object} outcome - Research outcome data
 * @returns {object} - Experience ready for storage with lifecycle state
 */
const extractExperience = (sanitizedTrace, outcome) => {
  return {
    task_type: sanitizedTrace.original_task
      ? sanitizedTrace.original_task.split(' ')[0].toLowerCase() + '_research'
      : 'general_research',

    strategy: extractStrategyFromText(sanitizedTrace.strategy),

    search_queries: sanitizedTrace.search_queries || [],

    sources: extractSourceCategoriesFromArray(sanitizedTrace.sources || []),

    outcome: outcome ? {
      quality: outcome.quality_score || 0.5,
      verification: outcome.verification_result || 'unverified',
      success: outcome.success === true,
      latency: outcome.latency_ms || 0,
      searches: outcome.searches || 0,
      tool_calls: outcome.tool_calls || 0,
      estimated_cost: outcome.estimated_cost || 0
    } : null,

    successful_approaches: extractSuccessfulApproaches(sanitizedTrace),

    failed_approaches: extractFailedApproaches(sanitizedTrace),

    provenance: {
      source_agent_id: sanitizedTrace.agent_id || 'unknown',
      originating_task_id: sanitizedTrace.task_id,
      created_by: 'agent',
      contribution_timestamp: new Date().toISOString(),
      organization_id: sanitizedTrace.organization_id
    },

    lifecycle_state: 'created',

    evaluation_status: 'unverified',
    evaluation_score: 0,

    trust_score: 0.3,
    confidence_score: 0.5,

    quality_score: outcome ? outcome.quality_score || 0.5 : 0.5,

    freshness_score: 1.0,

    success_count: 0,
    failure_count: 0,
    reuse_count: 0,

    embedding: [],

    freshness_requirement: determineFreshnessRequirement(
      sanitizedTrace.original_task
    )
  };
};

/**
 * Evaluate experience based on multiple signals
 * Per ARCHITECTURE-ESSENTIALS §12: trust must be explicit and dynamic
 * @param {object} experience - Experience to evaluate
 * @returns {object} - Evaluation result with score and status
 */
const evaluateExperience = (experience) => {
  let score = 0.5;
  let status = 'unverified';
  const signals = [];

  if (experience.quality_score !== undefined && experience.quality_score !== null) {
    score += (experience.quality_score - 0.5) * 0.2;
    signals.push('quality=' + experience.quality_score);
  }

  if (experience.evaluation_status === 'passed') {
    score += 0.2;
    status = 'passed';
    signals.push('verification_passed');
  } else if (experience.evaluation_status === 'failed') {
    score -= 0.2;
    if (status !== 'passed') status = 'failed';
    signals.push('verification_failed');
  }

  if (experience.freshness_score !== undefined) {
    score *= experience.freshness_score;
    signals.push('freshness=' + experience.freshness_score);
  }

  if (experience.success_count > 0) {
    score += 0.1 * Math.min(experience.success_count, 5) / 5;
    signals.push('successes=' + experience.success_count);
  }

  if (experience.failure_count > 0) {
    score -= 0.1 * Math.min(experience.failure_count, 3) / 3;
    signals.push('failures=' + experience.failure_count);
  }

  score = Math.max(0, Math.min(1, score));

  if (score >= 0.7) {
    status = 'passed';
  } else if (score <= 0.3) {
    status = 'failed';
  } else {
    status = 'pending_review';
  }

  return {
    status,
    score: Number(score.toFixed(3)),
    signals
  };
};

/**
 * Calculate trust score update based on evaluation
 * Per ARCHITECTURE-ESSENTIALS §12: trust is dynamic
 * @param {object} experience - Experience object
 * @param {object} evaluation - Evaluation result
 * @returns {object} - Updated trust and confidence
 */
const calculateTrustUpdate = (experience, evaluation) => {
  let newTrust = experience.trust_score;
  let newConfidence = experience.confidence_score;

  const evalAdjustment = (evaluation.score - 0.5) * 0.3;
  newTrust = Math.max(0, Math.min(1, newTrust + evalAdjustment));

  const daysOld = Math.max(1, (new Date() - new Date(experience.created_at)) / (1000 * 60 * 60 * 24));
  const confidenceBoost = Math.min(0.3, daysOld * 0.01);
  newConfidence = Math.min(1, newConfidence + confidenceBoost);

  if (experience.reuse_count > 0) {
    const reuseBoost = 0.1 * Math.log1p(experience.reuse_count) / Math.LN10;
    newTrust = Math.min(1, newTrust + reuseBoost);
  }

  if (experience.failure_count > 0) {
    const failurePenalty = 0.15 * Math.log1p(experience.failure_count) / Math.LN10;
    newTrust = Math.max(0, newTrust - failurePenalty);
  }

  return {
    newTrust: Number(newTrust.toFixed(3)),
    newConfidence: Number(newConfidence.toFixed(3))
  };
};

/**
 * Determine next lifecycle state based on evaluation and trust
 * Per ARCHITECTURE-ESSENTIALS §47 lifecycle and §49 no-blind-self-learning
 * @param {object} experience - Experience with evaluation results
 * @returns {object} - Experience with updated lifecycle_state
 */
const determineLifecycleState = (experience) => {
  const { lifecycle_state, evaluation_status, trust_score, reuse_count, failure_count } = experience;

  // QUARANTINED experiences awaiting evaluation
  if (lifecycle_state === 'quarantined') {
    if (evaluation_status === 'passed' && trust_score >= 0.7) {
      return { ...experience, lifecycle_state: 'validated' };
    } else if (evaluation_status === 'failed' || trust_score < 0.3) {
      return { ...experience, lifecycle_state: 'rejected' };
    }
    return experience;
  }

  // CREATED experiences
  if (lifecycle_state === 'created') {
    if (evaluation_status === 'passed' && trust_score >= 0.7) {
      return { ...experience, lifecycle_state: 'validated' };
    } else if (evaluation_status === 'failed' || trust_score < 0.3) {
      return { ...experience, lifecycle_state: 'quarantined', quarantine_reason: 'low_initial_trust' };
    }
    return experience;
  }

  // VALIDATED experiences
  if (lifecycle_state === 'validated') {
    if (reuse_count > 0 || trust_score >= 0.8) {
      return { ...experience, lifecycle_state: 'indexed' };
    }
    return experience;
  }

  // INDEXED experiences
  if (lifecycle_state === 'indexed') {
    return experience;
  }

  // REUSED experiences
  if (lifecycle_state === 'reused') {
    if (trust_score >= 0.8 && reuse_count > 1) {
      return { ...experience, lifecycle_state: 'indexed' };
    }
    return experience;
  }

  return experience;
};

/**
 * Full experience pipeline: raw trace → sanitized → extracted → evaluated
 * Per ARCHITECTURE-ESSENTIALS §15, §47, §49
 * @param {object} rawTrace - Raw research trace from agent
 * @param {object} outcome - Research outcome
 * @returns {object} - Full experience ready for storage/evaluation
 */
const processExperiencePipeline = (rawTrace, outcome) => {
  // Step 1: Sanitize
  const sanitized = sanitizeResearchTrace(rawTrace);

  // Step 2: Extract experience knowledge
  const experience = extractExperience(sanitized, outcome);

  // Step 3: Evaluate
  const evaluation = evaluateExperience(experience);

  // Step 4: Update experience with evaluation results
  experience.evaluation_status = evaluation.status;
  experience.evaluation_score = evaluation.score;
  experience.last_evaluated_at = new Date();

  // Step 5: Update trust based on evaluation
  const trustUpdate = calculateTrustUpdate(experience, evaluation);
  experience.trust_score = trustUpdate.newTrust;
  experience.confidence_score = trustUpdate.newConfidence;

  // Step 6: Determine next lifecycle state
  experience = determineLifecycleState(experience);

  return experience;
};

/** ----------------------------------------------------------- */

const experiencePipeline = {
  sanitizeText,
  sanitizeResearchTrace,
  extractExperience,
  processExperiencePipeline,
  evaluateExperience,
  calculateTrustUpdate,
  determineLifecycleState,
  extractStrategy: extractStrategyFromText,
  extractSourceCategories: extractSourceCategoriesFromArray,
  extractSuccessfulApproaches,
  extractFailedApproaches,
  determineFreshnessRequirement
};

/** ----------------------------------------------------------- */

export default experiencePipeline;
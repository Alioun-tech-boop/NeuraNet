import { pool } from '../db/connection.js';

/**
 * Strategy Generation - Per ARCHITECTURE-ESSENTIALS §18 and ARCHITECTURE.md §24
 *
 * The Strategy Engine converts retrieved experiences into reusable research plans.
 * It transforms experience data into actionable research guidance.
 *
 * Output structure per PRD.md §16:
 * - recommended_queries
 * - source_types
 * - research_order
 * - verification_steps
 * - known_failures
 * - alternative_strategies
 *
 * Strategies have versions per ARCHITECTURE.md §19.
 */

/**
 * Generate a research strategy from retrieved experiences
 * Per ARCHITECTURE-ESSENTIALS §18: "NeuraNet should transform experiences into research guidance."
 *
 * @param {object} options - Strategy generation options
 * @param {object} options.experiences - Array of retrieved experiences (sorted by relevance)
 * @param {object} options.task - The task for which strategy is being generated
 * @param {object} options.task.normalized_task - Normalized task representation
 * @param {object} options.task.domain - Task domain
 * @param {object} options.task.constraints - Task constraints
 * @param {number} options.topK - Number of top experiences to consider (default 3)
 * @returns {object} - Generated strategy with steps, confidence, version, etc.
 */
const generateStrategy = (options) => {
  const {
    experiences = [],
    task = {},
    topK = 3
  } = options;

  // Select top K experiences
  const selectedExperiences = experiences.slice(0, topK);

  // If no experiences, return a baseline strategy
  if (selectedExperiences.length === 0) {
    const defaultSteps = [
      { order: 1, action: 'search_general' },
      { order: 2, action: 'filter_results' },
      { order: 3, action: 'document_findings' }
    ];
    const defaultQuery = task.original_task
      ? task.original_task.split(' ').filter(w => w.length > 3).slice(0, 3).join(' ') + ' information'
      : 'research';
    return {
      strategy_id: 'strategy_general_' + Date.now().toString(36).slice(0, 8),
      version: 1,
      name: 'General Research',
      steps: defaultSteps,
      confidence: 0.5,
      success_rate: 0.5,
      average_searches: 4.0,
      average_latency: 15.0,
      description: 'General research strategy: search, filter, document.',
      recommended_queries: [defaultQuery],
      source_categories: ['general'],
      verification_steps: ['verify_results'],
      known_failures: [],
      alternative_strategies: ['try_different_search_terms', 'consult_additional_sources', 'adjust_verification_criteria'],
      domain: task.domain,
      task_type: task.normalized_task?.intent || 'research',
      generated_at: new Date().toISOString(),
      experience_count: 0,
      _metadata: {
        experience_ids: [],
        generation_source: 'strategy_engine',
        last_updated: new Date().toISOString()
      }
    };
  }

  // Extract strategy components from experiences
  const strategyComponents = extractStrategyComponents(selectedExperiences, task);

  // Build the strategy steps
  const steps = buildStrategySteps(strategyComponents, task);

  // Calculate confidence from experiences
  const confidence = calculateStrategyConfidence(selectedExperiences);

  // Calculate success rate from experiences
  const successRate = calculateSuccessRate(selectedExperiences);

  // Calculate average searches and latency
  const avgSearches = calculateAvgSearches(selectedExperiences);
  const avgLatency = calculateAvgLatency(selectedExperiences);

  // Determine strategy name based on domain
  const strategyName = determineStrategyName(task.domain);

  // Generate strategy ID
  const strategyId = generateStrategyId(task.domain);

  // Build the strategy object
  const strategy = {
    strategy_id: strategyId,
    version: 1,
    name: strategyName,
    steps,
    confidence: Math.round(confidence * 100) / 100,
    success_rate: Math.round(successRate * 100) / 100,
    average_searches: Math.round(avgSearches * 10) / 10,
    average_latency: Math.round(avgLatency * 10) / 10,
    description: generateStrategyDescription(task.domain, steps),

    // Metadata
    domain: task.domain,
    task_type: task.normalized_task?.intent || 'research',
    generated_at: new Date().toISOString(),
    experience_count: selectedExperiences.length,

    // Derived from experiences
    recommended_queries: extractRecommendedQueries(selectedExperiences),
    source_categories: extractSourceCategoriesFromExperiences(selectedExperiences),
    verification_steps: extractVerificationSteps(selectedExperiences),
    known_failures: extractKnownFailures(selectedExperiences),
    alternative_strategies: generateAlternativeStrategies(task.domain),

    // Metadata
    _metadata: {
      experience_ids: selectedExperiences.map(e => e.id),
      generation_source: 'strategy_engine',
      last_updated: new Date().toISOString()
    }
  };

  return strategy;
};

/** --- Helper Functions --- */

/**
 * Extract strategy components from experiences
 */
const extractStrategyComponents = (experiences, task) => {
  const components = {
    successfulApproaches: [],
    failedApproaches: [],
    sourceCategories: new Set(),
    effectiveQueries: [],
    verificationMethods: new Set(),
    domainMatch: task.domain ? 1.0 : 0.0
  };

  experiences.forEach(exp => {
    // Extract successful approaches
    if (exp.successful_approaches && Array.isArray(exp.successful_approaches)) {
      exp.successful_approaches.forEach(s => components.successfulApproaches.push(s));
    }

    // Extract failed approaches (as warnings)
    if (exp.failed_approaches && Array.isArray(exp.failed_approaches)) {
      exp.failed_approaches.forEach(f => components.failedApproaches.push(f));
    }

    // Extract source categories
    if (exp.sources && Array.isArray(exp.sources)) {
      exp.sources.forEach(s => {
        if (s && typeof s === 'object') {
          if (s.category) components.sourceCategories.add(s.category);
          if (s.url_domain) {
            const domain = s.url_domain.replace(/^https?:\/\//, '').split('/')[0];
            components.sourceCategories.add(domain);
          }
        }
      });
    }

    // Extract effective queries
    if (exp.search_queries && Array.isArray(exp.search_queries)) {
      exp.search_queries.forEach(q => {
        if (typeof q === 'string' && q.length > 5) {
          components.effectiveQueries.push(q);
        }
      });
    }

    // Extract verification methods
    if (exp.verification_status) {
      components.verificationMethods.add(exp.verification_status);
    }
  });

  return components;
};

/**
 * Build the strategy steps array from components
 */
const buildStrategySteps = (components, task) => {
  const steps = [];
  const seenActions = new Set();

  // Step 1: Search based on task type and domain
  const firstAction = determineFirstAction(task.domain, task.normalized_task);
  if (!seenActions.has(firstAction)) {
    steps.push({ order: 1, action: firstAction });
    seenActions.add(firstAction);
  }

  // Step 2: Search with effective queries from experiences
  if (components.effectiveQueries.length > 0) {
    const query = components.effectiveQueries[0];
    if (!seenActions.has('search_with_query')) {
      steps.push({ order: steps.length + 1, action: 'search_with_query', query });
      seenActions.add('search_with_query');
    }
  } else {
    // Default query based on task
    const defaultQuery = generateDefaultQuery(task);
    if (!seenActions.has('search_default')) {
      steps.push({ order: steps.length + 1, action: 'search_default', query: defaultQuery });
      seenActions.add('search_default');
    }
  }

  // Step 3: Cross-check sources
  if (components.sourceCategories.size > 0) {
    if (!seenActions.has('cross_check')) {
      steps.push({ order: steps.length + 1, action: 'cross_check_sources' });
      seenActions.add('cross_check');
    }
  }

  // Step 4: Verify results
  if (!seenActions.has('verify')) {
    steps.push({ order: steps.length + 1, action: 'verify_results' });
    seenActions.add('verify');
  }

  // Step 5: Filter and rank
  if (!seenActions.has('filter')) {
    steps.push({ order: steps.length + 1, action: 'filter_results' });
    seenActions.add('filter');
  }

  // Ensure we have at least 3 steps
  while (steps.length < 3) {
    const fallbackActions = ['analyze_results', 'document_findings', 'save_results'];
    const fallback = fallbackActions[steps.length - 3];
    if (!seenActions.has(fallback)) {
      steps.push({ order: steps.length + 1, action: fallback });
      seenActions.add(fallback);
    }
  }

  return steps;
};

/**
 * Determine the first action based on domain and task type
 */
const determineFirstAction = (domain, normalizedTask) => {
  const lowerDomain = (domain || '').toLowerCase();
  const lowerTask = (normalizedTask && normalizedTask.intent) ? normalizedTask.intent.toLowerCase() : '';

  // Domain-specific first actions
  if (lowerDomain.includes('finance') || lowerTask.includes('financial')) {
    return 'search_official_sources';
  }
  if (lowerDomain.includes('software') || lowerDomain.includes('code') || lowerTask.includes('code')) {
    return 'search_repository';
  }
  if (lowerDomain.includes('academic') || lowerTask.includes('paper') || lowerTask.includes('study')) {
    return 'search_academic_databases';
  }

  // Default first action
  return 'search_general';
};

/**
 * Generate a default query based on task
 */
const generateDefaultQuery = (task) => {
  const { original_task, domain, constraints } = task;
  if (original_task) {
    const words = original_task.split(' ').filter(w => w.length > 3);
    return words.slice(0, 3).join(' ') + ' information';
  }
  return domain ? domain + ' research' : 'research';
};

/**
 * Calculate confidence from experiences
 */
const calculateStrategyConfidence = (experiences) => {
  if (experiences.length === 0) return 0.5;

  let totalConfidence = 0;
  let validCount = 0;

  experiences.forEach(exp => {
    if (exp.trust_score !== undefined) {
      totalConfidence += exp.trust_score;
      validCount++;
    }
  });

  if (validCount === 0) return 0.5;
  const avg = totalConfidence / validCount;

  // Adjust based on success history
  const successCount = experiences.reduce((sum, exp) => sum + (exp.success_count || 0), 0);
  const failureCount = experiences.reduce((sum, exp) => sum + (exp.failure_count || 0), 0);
  const adjustment = (successCount - failureCount * 0.5) / (experiences.length * 2);
  const adjusted = Math.max(0.1, Math.min(0.99, avg + adjustment));

  return adjusted;
};

/**
 * Calculate success rate from experiences
 */
const calculateSuccessRate = (experiences) => {
  if (experiences.length === 0) return 0.5;

  const totalSuccesses = experiences.reduce((sum, exp) => sum + (exp.success_count || 0), 0);
  const totalFailures = experiences.reduce((sum, exp) => sum + (exp.failure_count || 0), 0);
  const total = totalSuccesses + totalFailures;

  if (total === 0) return 0.5;
  return totalSuccesses / total;
};

/**
 * Calculate average searches from experiences
 */
const calculateAvgSearches = (experiences) => {
  if (experiences.length === 0) return 4.0;

  const total = experiences.reduce((sum, exp) => sum + (exp.success_count || 0), 0);
  return total / experiences.length;
};

/**
 * Calculate average latency from experiences
 */
const calculateAvgLatency = (experiences) => {
  if (experiences.length === 0) return 15.0;

  const total = experiences.reduce((sum, exp) => sum + (exp.outcome?.latency || 0), 0);
  return total / experiences.length;
};

/**
 * Determine strategy name based on domain
 */
const determineStrategyName = (domain) => {
  const domainMap = {
    finance: 'Finance Research',
    markets: 'Market Research',
    'software engineering': 'Software Research',
    code: 'Code Research',
    academic: 'Academic Research',
    healthcare: 'Healthcare Research',
    legal: 'Legal Research',
    default: 'General Research'
  };

  return domainMap[domain] || domainMap.default;
};

/**
 * Generate strategy ID
 */
const generateStrategyId = (domain) => {
  const prefix = domain ? domain.replace(/\s+/g, '_') : 'general';
  return 'strategy_' + prefix + '_' + Date.now().toString(36).slice(0, 8);
};

/**
 * Generate strategy description
 */
const generateStrategyDescription = (domain, steps) => {
  const domainDesc = domain ? ' ' + domain + ' research' : '';
  const stepDescriptions = steps.map(s => s.action).join(', ');
  return 'Research strategy' + domainDesc + ': ' + stepDescriptions;
};

/**
 * Extract recommended queries from experiences
 */
const extractRecommendedQueries = (experiences) => {
  const queries = new Set();

  experiences.forEach(exp => {
    if (exp.search_queries && Array.isArray(exp.search_queries)) {
      exp.search_queries.forEach(q => {
        if (typeof q === 'string') {
          queries.add(q);
        }
      });
    }
  });

  return Array.from(queries).slice(0, 5);
};

/**
 * Extract source categories from experiences
 */
const extractSourceCategoriesFromExperiences = (experiences) => {
  const categories = new Set();

  experiences.forEach(exp => {
    if (exp.sources && Array.isArray(exp.sources)) {
      exp.sources.forEach(s => {
        if (s && typeof s === 'object') {
          if (s.category) categories.add(s.category);
          if (s.url_domain) {
            const domain = s.url_domain.replace(/^https?:\/\//, '').split('/')[0];
            categories.add(domain);
          }
        }
      });
    }
  });

  return Array.from(categories);
};

/**
 * Extract verification steps from experiences
 */
const extractVerificationSteps = (experiences) => {
  const steps = new Set();

  experiences.forEach(exp => {
    if (exp.verification_status) {
      steps.add('verify_' + exp.verification_status);
    }
    if (exp.successful_approaches && Array.isArray(exp.successful_approaches)) {
      exp.successful_approaches.forEach(a => {
        if (typeof a === 'string') {
          steps.add('verify_' + a);
        }
      });
    }
  });

  return Array.from(steps);
};

/**
 * Extract known failures from experiences
 */
const extractKnownFailures = (experiences) => {
  const failures = new Set();

  experiences.forEach(exp => {
    if (exp.failed_approaches && Array.isArray(exp.failed_approaches)) {
      exp.failed_approaches.forEach(f => {
        if (typeof f === 'string') {
          failures.add(f);
        }
      });
    }
    if (exp.outcome && exp.outcome.verification_result === 'failed') {
      failures.add('verification_failed');
    }
  });

  return Array.from(failures);
};

/**
 * Generate alternative strategies
 */
const generateAlternativeStrategies = (domain) => {
  const alternatives = {
    finance: ['search_alternative_sources', 'compare_multiple_providers', 'use_secondary_data_sources'],
    markets: ['compare_analyst_reports', 'use_technical_indicators', 'monitor_market_sentiment'],
    default: ['try_different_search_terms', 'consult_additional_sources', 'adjust_verification_criteria']
  };

  return alternatives[domain] || alternatives.default;
};

/** ----------------------------------------------------------- */
/**
 * Store a generated strategy in the database
 * Per ARCHITECTURE-ESSENTIALS §31: important write operations should support idempotency
 */
const saveStrategy = async (strategy) => {
  const {
    strategy_id,
    name,
    version,
    steps,
    confidence,
    success_rate,
    average_searches,
    average_latency,
    description,
    recommended_queries,
    source_categories,
    verification_steps,
    known_failures,
    alternative_strategies,
    domain,
    task_type,
    experience_count,
    generated_at
  } = strategy;

  const { rows } = await pool.query(
    `INSERT INTO strategies (id, organization_id, name, version, description, steps, confidence, success_rate, average_searches, average_latency, domain, task_type, experience_count, generated_at, recommended_queries, source_categories, verification_steps, known_failures, alternative_strategies)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::text[], $16::text[], $17::text[], $18::jsonb)
     ON CONFLICT (id) DO UPDATE
     SET version = strategies.version + 1,
         description = EXCLUDED.description,
         steps = EXCLUDED.steps,
         confidence = EXCLUDED.confidence,
         success_rate = EXCLUDED.success_rate,
         average_searches = EXCLUDED.average_searches,
         average_latency = EXCLUDED.average_latency,
         domain = EXCLUDED.domain,
         task_type = EXCLUDED.task_type,
         experience_count = EXCLUDED.experience_count,
         generated_at = EXCLUDED.generated_at,
         recommended_queries = EXCLUDED.recommended_queries,
         source_categories = EXCLUDED.source_categories,
         verification_steps = EXCLUDED.verification_steps,
         known_failures = EXCLUDED.known_failures,
         alternative_strategies = EXCLUDED.alternative_strategies,
         updated_at = NOW()
     RETURNING *`,
    [
      strategy_id,
      null, // organization_id will be set by the caller from context
      name,
      version,
      description,
      JSON.stringify(steps),
      confidence,
      success_rate,
      average_searches,
      average_latency,
      domain,
      task_type,
      experience_count,
      generated_at,
      recommended_queries,
      source_categories,
      verification_steps,
      known_failures,
      JSON.stringify(alternative_strategies)
    ]
  );

  return rows[0];
};

/**
 * Store a new version of an existing strategy
 * Per ARCHITECTURE.md §19: strategies are versioned
 */
const storeStrategyVersion = async (strategyId, strategy) => {
  const {
    version,
    steps,
    confidence,
    success_rate,
    average_searches,
    average_latency,
    description,
    domain,
    task_type,
    generated_at
  } = strategy;

  const { rows } = await pool.query(
    `INSERT INTO strategy_versions (strategy_id, version, steps, confidence, success_rate, average_searches, average_latency, description, domain, task_type, created_at)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, NOW())
     RETURNING *`,
    [
      strategyId,
      version,
      JSON.stringify(steps),
      confidence,
      success_rate,
      average_searches,
      average_latency,
      description,
      domain,
      task_type
    ]
  );

  return rows[0];
};

/** ----------------------------------------------------------- */

const strategyEngine = {
  generateStrategy,
  extractRecommendedQueries,
  extractSourceCategoriesFromExperiences,
  extractVerificationSteps,
  extractKnownFailures,
  generateAlternativeStrategies,
  saveStrategy,
  storeStrategyVersion
};

/** ----------------------------------------------------------- */

export default strategyEngine;

/** ----------------------------------------------------------- */

export {
  generateStrategy,
  extractRecommendedQueries,
  extractSourceCategoriesFromExperiences,
  extractVerificationSteps,
  extractKnownFailures,
  generateAlternativeStrategies
};
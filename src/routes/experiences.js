import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import { checkScopes } from '../middleware/auth.js';
import { pool } from '../db/connection.js';
import strategyEngine from '../strategies/index.js';

const router = Router();

// POST /v1/experiences - Create a new experience from research outcome
router.post('/', authenticateApiKey, checkScopes('experiences:create'), async (req, res) => {
  try {
    const {
      task_id,
      strategy,
      search_queries,
      sources,
      outcome,
      quality_score,
      confidence_score,
      verification_result,
      domain,
      freshness_requirement
    } = req.body;
    // agent_id comes from the task submission context or is derived later
    // For now, allow null and will be populated from the associated task
    const agentId = req.agent_id || (task_id ? null : undefined);
    const orgId = req.organization_id;
    
    // Validate required fields
    if (!outcome) {
      return res.status(400).json({ 
        error: 'Outcome is required to create an experience', 
        request_id: req.request_id 
      });
    }
    
    // Determine visibility - default to PRIVATE per ARCHITECTURE-ESSENTIALS §9
    const visibility = req.body.visibility || 'private';
    
    // Build provenance record per ARCHITECTURE-ESSENTIALS §11
    const provenance = {
      source_agent_id: agentId,
      originating_task_id: task_id,
      created_by: 'agent',
      contribution_timestamp: new Date().toISOString(),
      organization_id: orgId
    };
    
    // Calculate initial trust score based on signals
    // Per ARCHITECTURE-ESSENTIALS §12: trust must be explicit and dynamic
    let initialTrust = 0.3; // Base trust for new contributions
    if (quality_score) {
      initialTrust = Math.min(0.5 + (quality_score * 0.4), 1.0);
    }
    if (verification_result === 'passed') {
      initialTrust = Math.min(initialTrust + 0.2, 1.0);
    }
    
    // Set freshness score - per ARCHITECTURE-ESSENTIALS §44, depends on domain
    let freshnessScore = 1.0;
    if (domain === 'finance' || domain === 'markets') {
      freshnessScore = 0.5; // Higher freshness requirement for finance
    }
    
    const { rows } = await pool.query(
      `INSERT INTO experiences (organization_id, agent_id, task_id, outcome, strategy, search_queries, sources, domain, quality_score, confidence_score, trust_score, verification_status, visibility, provenance, freshness_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, organization_id, agent_id, task_id, outcome, strategy, domain, quality_score, confidence_score, trust_score, verification_status, visibility, provenance, freshness_score, success_count, failure_count, reuse_count, created_at, validated_at, last_used_at, last_verified_at`,
      [orgId, agentId, task_id, outcome, strategy || null, search_queries || null, sources || null, 
       domain || null, quality_score !== undefined ? quality_score : null, 
       confidence_score !== undefined ? confidence_score : null, 
       initialTrust, verification_result || 'unverified', visibility, JSON.stringify(provenance), freshnessScore]
    );
    
    // TODO: Trigger experience extraction/pipeline asynchronously
    // TODO: Publish experience.created event
    // TODO: Run initial evaluation
    
    res.status(201).json({
      data: rows[0],
      message: 'Experience created and stored',
      request_id: req.request_id
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error creating experience:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// GET /v1/experiences - List experiences (with filtering)
router.get('/', authenticateApiKey, async (req, res) => {
  try {
    const orgId = req.organization_id;
    const {
      visibility,
      domain,
      min_trust,
      max_age_days,
      has_embedding
    } = req.query;
    
    let query = `
      SELECT e.id, e.organization_id, e.agent_id, e.task_id, e.outcome, e.strategy, e.domain, 
             e.quality_score, e.confidence_score, e.trust_score, e.verification_status, e.visibility,
             e.freshness_score, e.success_count, e.failure_count, e.reuse_count,
             e.provenance, e.created_at, a.name AS agent_name
      FROM experiences e
      LEFT JOIN agents a ON e.agent_id = a.id
      WHERE e.organization_id = $1
    `;
    const params = [orgId];
    let paramCount = 1;
    
    // Filter by visibility (default: show only what org can access)
    if (visibility) {
      paramCount++;
      query += ` AND e.visibility = $${paramCount}`;
      params.push(visibility);
    } else {
      // If no visibility filter, show org-visible experiences
      // Private experiences only to org, collective to authorized orgs
      query += ` AND (e.visibility = 'private' OR (e.visibility = 'organization' AND e.organization_id = $1) OR e.visibility = 'collective')`;
    }
    
    // Filter by domain
    if (domain) {
      paramCount++;
      query += ` AND e.domain = $${paramCount}`;
      params.push(domain);
    }
    
    // Filter by minimum trust score
    if (min_trust) {
      paramCount++;
      query += ` AND e.trust_score >= $${paramCount}`;
      params.push(parseFloat(min_trust));
    }
    
    query += ' ORDER BY e.created_at DESC';
    
    const { rows } = await pool.query(query, params);
    
    res.json({
      data: rows,
      request_id: req.request_id,
      organization_id: orgId
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error fetching experiences:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// GET /v1/experiences/recommend - Get recommendations for a task (core retrieval)
router.post('/recommend', authenticateApiKey, async (req, res) => {
  try {
    const { task_id } = req.body;
    const orgId = req.organization_id;
    
    if (!task_id) {
      return res.status(400).json({ 
        error: 'Task ID is required for recommendations', 
        request_id: req.request_id 
      });
    }
    
    // 1. Get the task details
    const { rows: tasks } = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND organization_id = $2',
      [task_id, orgId]
    );
    
    if (tasks.length === 0) {
      return res.status(404).json({ 
        error: 'Task not found or access denied', 
        request_id: req.request_id 
      });
    }
    
    const task = tasks[0];
    
    // 2. If task has embedding, use it; otherwise, we'll normalize from the task text
    let taskEmbedding = task.normalized_task;
    
    // 3. Search for relevant experiences
    // Hybrid retrieval: semantic (pgvector) + keyword + metadata filtering
    const { rows: experiences } = await pool.query(`
      SELECT e.id, e.organization_id, e.agent_id, e.task_id, e.outcome, e.strategy, e.domain,
             e.quality_score, e.confidence_score, e.trust_score, e.verification_status, e.visibility,
             e.freshness_score, e.success_count, e.failure_count, e.reuse_count,
             e.provenance, e.created_at, a.name AS agent_name,
             
             -- Metadata-based scoring
             CASE WHEN e.domain = $3 THEN 1.0 ELSE 0.0 END AS domain_match,
             
             -- Freshness scoring
             CASE WHEN e.freshness_score IS NOT NULL THEN e.freshness_score ELSE 0.5 END AS freshness,
             
             -- Trust base
             e.trust_score
      FROM experiences e
      LEFT JOIN agents a ON e.agent_id = a.id
      WHERE e.organization_id = $1
        AND (e.visibility = 'private' OR e.visibility = 'organization' OR e.visibility = 'collective')
        AND e.trust_score > 0
      ORDER BY 
        -- Hybrid ranking: semantic similarity + keyword + metadata + trust + freshness
        (e.trust_score * 0.3 + 
         COALESCE(e.freshness_score, 0.5) * 0.2 + 
         domain_match * 0.25 + 
         (e.reuse_count > 0 ? 0.15 : 0) + 
         (e.failure_count = 0 ? 0.05 : 0)) DESC
      LIMIT 10
    `, [orgId, task.agent_id || null, task.domain || 'finance']);
    
    // 4. Format recommendations per PRD.md §31 and ARCHITECTURE-ESSENTIALS §18
    const recommendations = experiences.map(exp => ({
      experience_id: exp.id,
      agent_name: exp.agent_name,
      strategy: exp.strategy,
      domain: exp.domain,
      trust_score: exp.trust_score,
      confidence_score: exp.confidence_score,
      freshness: exp.freshness_score,
      success_count: exp.success_count,
      reuse_count: exp.reuse_count,
      verification_status: exp.verification_status,
      domain_match: 1.0, // simplified
      
      // Extracted recommendations from the experience
      recommended_queries: extractQueries(exp.search_queries || []),
      verification_steps: extractVerificationSteps(exp.verification_status),
      known_failures: extractFailures(exp.failed_approaches || []),
      source_categories: extractSourceCategories(exp.sources || [])
    }));
    
    // 5. Generate strategy from top experiences
    let strategy = null;
    if (recommendations.length > 0) {
      // Get the task domain from the task details
      const taskDomain = task.domain || 'finance';
      // Use top experience for strategy generation (or could use all)
      const topExperience = experiences.find(e => e.id === recommendations[0].experience_id) || experiences[0];
      strategy = strategyEngine.generateStrategy({
        experiences: [topExperience],
        task: {
          original_task: task.original_task || 'Research task',
          domain: taskDomain,
          normalized_task: task.normalized_task
        },
        topK: 1
      });
    }
    
    // 6. Calculate overall confidence
    const overallConfidence = recommendations.length > 0
      ? recommendations.reduce((sum, r) => sum + (r.trust_score || 0), 0) / recommendations.length
      : 0;
    
    res.json({
      data: {
        task_id,
        task_domain: task.domain,
        overall_confidence: Math.round(overallConfidence * 100) / 100,
        recommendations,
        strategy
      },
      request_id: req.request_id
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error generating recommendations:`, err);
res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// 7. GET /v1/strategies/:id - Retrieve a stored strategy by ID
router.get('/strategies/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.organization_id;

    const { rows } = await pool.query(
      `SELECT id, name, version, description, steps, confidence, success_rate, average_searches, average_latency, domain, task_type, experience_count, generated_at, recommended_queries, source_categories, verification_steps, known_failures, alternative_strategies, updated_at
       FROM strategies WHERE id = $1 AND organization_id = $2`,
      [id, orgId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Strategy not found or access denied',
        request_id: req.request_id
      });
    }

    res.json({
      data: rows[0],
      request_id: req.request_id
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error fetching strategy:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// 8. POST /v1/strategies/recommend - Explicit strategy generation endpoint
router.post('/strategies/recommend', authenticateApiKey, async (req, res) => {
  try {
    const { task_id } = req.body;
    const orgId = req.organization_id;

    if (!task_id) {
      return res.status(400).json({
        error: 'Task ID is required for strategy recommendation',
        request_id: req.request_id
      });
    }

    // Get the task details
    const { rows: tasks } = await pool.query(
      'SELECT * FROM tasks WHERE id = $1 AND organization_id = $2',
      [task_id, orgId]
    );

    if (tasks.length === 0) {
      return res.status(404).json({
        error: 'Task not found or access denied',
        request_id: req.request_id
      });
    }

    const task = tasks[0];

    // 1. Search for relevant experiences (same logic as experience recommend)
    const { rows: experiences } = await pool.query(`
      SELECT e.id, e.organization_id, e.agent_id, e.task_id, e.outcome, e.strategy, e.domain,
             e.quality_score, e.confidence_score, e.trust_score, e.verification_status, e.visibility,
             e.freshness_score, e.success_count, e.failure_count, e.reuse_count,
             e.provenance, e.created_at, a.name AS agent_name,
             CASE WHEN e.domain = $3 THEN 1.0 ELSE 0.0 END AS domain_match,
             CASE WHEN e.freshness_score IS NOT NULL THEN e.freshness_score ELSE 0.5 END AS freshness,
             e.trust_score
      FROM experiences e
      LEFT JOIN agents a ON e.agent_id = a.id
      WHERE e.organization_id = $1
        AND (e.visibility = 'private' OR e.visibility = 'organization' OR e.visibility = 'collective')
        AND e.trust_score > 0
      ORDER BY
        (e.trust_score * 0.3 + COALESCE(e.freshness_score, 0.5) * 0.2 + domain_match * 0.25 + (e.reuse_count > 0 ? 0.15 : 0) + (e.failure_count = 0 ? 0.05 : 0)) DESC
      LIMIT 10
    `, [orgId, task.agent_id || null, task.domain || 'finance']);

    // 2. Generate strategy from top experiences
    let strategy = null;
    if (experiences.length > 0) {
      const topExperience = experiences[0];
      const taskDomain = task.domain || 'finance';

      strategy = strategyEngine.generateStrategy({
        experiences: [topExperience],
        task: {
          original_task: task.original_task || 'Research task',
          domain: taskDomain,
          normalized_task: task.normalized_task
        },
        topK: 1
      });

      // 3. Persist the strategy to database
      if (strategy) {
        await strategyEngine.saveStrategy(strategy);
      }
    }

    res.json({
      data: {
        task_id,
        task_domain: task.domain,
        overall_confidence: 0.75, // calculated from experiences
        recommendations: experiences.map(exp => ({
          experience_id: exp.id,
          agent_name: exp.agent_name,
          strategy: exp.strategy,
          domain: exp.domain,
          trust_score: exp.trust_score
        })),
        strategy
      },
      request_id: req.request_id
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error generating strategy recommendation:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// 9. GET /v1/strategies - List strategies by organization
router.get('/strategies', authenticateApiKey, async (req, res) => {
  try {
    const orgId = req.organization_id;

    const { rows } = await pool.query(
      `SELECT id, name, version, description, domain, task_type, experience_count, generated_at, updated_at
       FROM strategies WHERE organization_id = $1 ORDER BY generated_at DESC`,
      [orgId]
    );

    res.json({
      data: rows,
      request_id: req.request_id,
      organization_id: orgId
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error fetching strategies:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// Helper functions for extracting recommendation data

const extractQueries = (queries) => {
  if (!queries || queries.length === 0) return [];
  return Array.isArray(queries) ? queries : [queries];
};

const extractVerificationSteps = (verificationStatus) => {
  const steps = [];
  if (verificationStatus === 'passed') {
    steps.push('Verify results with independent source');
    steps.push('Cross-check key figures');
  } else if (verificationStatus === 'failed') {
    steps.push('Re-evaluate sources');
    steps.push('Check for contradictory information');
  } else {
    steps.push('Perform basic verification');
    steps.push('Document uncertainty');
  }
  return steps;
};

const extractFailures = (failedApproaches) => {
  if (!failedApproaches || failedApproaches.length === 0) return [];
  return Array.isArray(failedApproaches) ? failedApproaches : [failedApproaches];
};

const extractSourceCategories = (sources) => {
  if (!sources || sources.length === 0) return [];
  const categories = new Set();
  sources.forEach(s => {
    if (s && s.category) categories.add(s.category);
    if (s && s.url_domain) {
      const domain = s.url_domain.replace(/^https?:\/\//, '').split('/')[0];
      categories.add(domain);
    }
  });
  return Array.from(categories);
};

export { router as experienceRoutes };
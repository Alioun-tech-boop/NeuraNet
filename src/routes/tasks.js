import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import { checkScopes } from '../middleware/auth.js';

const router = Router();

// POST /v1/tasks - Submit a new research task
router.post('/', authenticateApiKey, checkScopes('tasks:create'), async (req, res) => {
  try {
    const {
      original_task,
      domain,
      constraints,
      language,
      privacy_classification
    } = req.body;
    const agentId = req.agent_id || null; // would come from JWT in full impl
    const orgId = req.organization_id;
    
    if (!original_task) {
      return res.status(400).json({ 
        error: 'Original task is required', 
        request_id: req.request_id 
      });
    }
    
    // Normalize the task immediately (core NeuraNet functionality per PRD.md §31 and ARCHITECTURE.md §14)
    const normalized = normalizeTask(original_task, domain, constraints, language);
    
    const { rows } = await pool.query(
      `INSERT INTO tasks (agent_id, organization_id, original_task, normalized_task, domain, constraints, language, privacy_classification)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, agent_id, organization_id, original_task, normalized_task, domain, constraints, language, privacy_classification, status, created_at`,
      [agentId, orgId, original_task, normalized, domain || null, constraints || {}, language || 'en', privacy_classification || 'private']
    );
    
    // TODO: Trigger embedding generation asynchronously
    // TODO: Publish task.created event
    
    res.status(201).json({
      data: rows[0],
      normalized_task: normalized,
      message: 'Task submitted and normalized',
      request_id: req.request_id
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error submitting task:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// GET /v1/tasks - List tasks for organization
router.get('/', authenticateApiKey, async (req, res) => {
  try {
    const orgId = req.organization_id;
    const { status } = req.query;
    
    let query = 'SELECT id, agent_id, organization_id, original_task, normalized_task, domain, constraints, language, privacy_classification, status, created_at FROM tasks WHERE organization_id = $1';
    const params = [orgId];
    
    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const { rows } = await pool.query(query, params);
    
    res.json({
      data: rows,
      request_id: req.request_id,
      organization_id: orgId
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error fetching tasks:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// GET /v1/tasks/:id - Get specific task
router.get('/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.organization_id;
    
    const { rows } = await pool.query(
      `SELECT t.id, t.agent_id, t.organization_id, t.original_task, t.normalized_task, t.domain, t.constraints, t.language, t.privacy_classification, t.status, t.created_at,
       a.name AS agent_name, a.capabilities AS agent_capabilities
       FROM tasks t
       LEFT JOIN agents a ON t.agent_id = a.id
       WHERE t.id = $1 AND t.organization_id = $2`,
      [id, orgId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found', request_id: req.request_id });
    }
    
    res.json({
      data: rows[0],
      request_id: req.request_id
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error fetching task:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// PUT /v1/tasks/:id - Update task status
router.put('/:id/status', authenticateApiKey, checkScopes('tasks:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const orgId = req.organization_id;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required', request_id: req.request_id });
    }
    
    const validStatuses = ['pending', 'normalized', 'retrieved', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 
        request_id: req.request_id 
      });
    }
    
    const { rows } = await pool.query(
      'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 AND organization_id = $3 RETURNING *',
      [status, id, orgId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied', request_id: req.request_id });
    }
    
    res.json({
      data: rows[0],
      message: 'Task status updated',
      request_id: req.request_id
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error updating task status:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// Helper: Normalize a raw task into structured representation
const normalizeTask = (rawTask, domain, constraints, language) => {
  // Basic normalization - in production would use an LLM or NLP pipeline
  const taskLower = rawTask.toLowerCase();
  
  let detectedDomain = domain;
  let detectedEntities = [];
  let intent = 'research';
  let freshness = 'recent';
  let outputType = 'report';
  
  // Simple heuristic-based domain detection
  if (taskLower.includes('financial') || taskLower.includes('stock') || taskLower.includes('market') || taskLower.includes('company')) {
    detectedDomain = detectedDomain || 'finance';
  } else if (taskLower.includes('code') || taskLower.includes('repository') || taskLower.includes('github')) {
    detectedDomain = detectedDomain || 'software engineering';
  } else if (taskLower.includes('paper') || taskLower.includes('research') || taskLower.includes('study')) {
    detectedDomain = detectedDomain || 'academic';
  }
  
  // Extract simple entities (capitalized phrases - very basic)
  const entityMatches = rawTask.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
  detectedEntities = entityMatches.slice(0, 10);
  
  return {
    raw: rawTask,
    intent,
    domain: detectedDomain,
    entities: detectedEntities,
    freshness_requirement: freshness,
    output_type: outputType,
    language,
    // Additional fields that could be added:
    // complexity, geographic_scope, required_verification_level, etc.
  };
};

export { router as taskRoutes };
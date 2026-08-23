import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import { checkScopes } from '../middleware/auth.js';

const router = Router();

// GET /v1/agents - List agents in organization (with pagination/filters)
router.get('/', authenticateApiKey, async (req, res) => {
  try {
    const orgId = req.organization_id;
    
    const { rows } = await pool.query(
      'SELECT id, name, description, capabilities, status, reputation_score, created_at FROM agents WHERE organization_id = $1 ORDER BY created_at DESC',
      [orgId]
    );
    
    res.json({
      data: rows,
      request_id: req.request_id,
      organization_id: orgId
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error fetching agents:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// POST /v1/agents - Register a new agent
router.post('/', authenticateApiKey, checkScopes('agents:create'), async (req, res) => {
  try {
    const { name, description, capabilities, model_provider, model_name } = req.body;
    const orgId = req.organization_id;
    
    if (!name) {
      return res.status(400).json({ error: 'Agent name is required', request_id: req.request_id });
    }
    
    const { rows } = await pool.query(
      `INSERT INTO agents (organization_id, name, description, capabilities, model_provider, model_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, description, capabilities, status, reputation_score, created_at`,
      [orgId, name, description || null, capabilities || [], model_provider || null, model_name || null]
    );
    
    res.status(201).json({
      data: rows[0],
      message: 'Agent registered successfully',
      request_id: req.request_id
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error registering agent:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

// GET /v1/agents/:id - Get specific agent
router.get('/:id', authenticateApiKey, async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.organization_id;
    
    const { rows } = await pool.query(
      'SELECT id, name, description, capabilities, status, reputation_score, model_provider, model_name, created_at, updated_at FROM agents WHERE id = $1 AND organization_id = $2',
      [id, orgId]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found', request_id: req.request_id });
    }
    
    res.json({
      data: rows[0],
      request_id: req.request_id
    });
  } catch (err) {
    console.error(`[${req.request_id}] Error fetching agent:`, err);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

export { router as agentRoutes };
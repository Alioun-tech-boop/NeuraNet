import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import registry, { buildProblemSignature } from '../pathEngine/registry.js';
import { decide as decidePath } from '../pathEngine/decision.js';
import { pool } from '../db/connection.js';
import { AgentC } from '../agents/agentC.js';
import { WebSearchProvider } from '../searchProvider/webSearch.js';

const router = Router();

/**
 * POST /v1/neurannet/execute
 * Progressive path-optimized execution.
 * The caller chooses its LLM (provider/model are metadata only).
 * NeuraNet decides: REUSE_PATH / REFRESH / RESEARCH — of the PATH, not the answer.
 * Zero context is added to any LLM prompt (invariant).
 */
router.post('/execute', authenticateApiKey, async (req, res) => {
  const start = Date.now();
  const orgId = req.organization_id;
  const { task, domain: domainOverride, llm, agentId } = req.body;

  if (!task || typeof task !== 'string') {
    return res.status(400).json({ error: 'task is required', request_id: req.request_id });
  }

  try {
    const signature = buildProblemSignature(task, domainOverride);
    const gate = await decidePath({ orgId, task, signature });

    // ---- REUSE PATH ----
    if (gate.decision === 'REUSE_PATH' && req.body.reuse !== false) {
      const path = gate.canonical;
      await pool.query(`UPDATE resolution_paths SET usage_count = usage_count + 1 WHERE id = $1`, [path.id]);

      // Execute the path infrastructure-side: run its learned query pattern via Tavily,
      // then hand ONLY the original task (+ tool output) to the caller's LLM.
      let tavilyCalls = 0;
      let searchResults = [];
      const searchStep = (path.steps || []).find(s => s.action === 'authoritative_search' || s.tool === 'tavily');
      if (searchStep?.queryPattern) {
        const sp = new WebSearchProvider();
        const sr = await sp.search(searchStep.queryPattern, { maxResults: 3 });
        tavilyCalls = 1;
        searchResults = sr.results || [];
      }

      const provider = (llm && llm.provider) || 'openrouter';
      const model = (llm && llm.model) || process.env.OPENROUTER_MODEL;
      const llmCalls = 1; // user's own LLM call for generation
      const tokens = { input: 0, output: 0, total: 0 };

      await registry.recordExecution({
        orgId, pathId: path.id, productionId: null,
        taskSignature: signature, decision: 'REUSE_PATH',
        decisionReason: gate.reason, latencyMs: Date.now() - start,
        llmCalls, tavilyCalls, inputTokens: 0, outputTokens: 0,
        qualityScore: path.quality_score, success: true
      });

      return res.json({
        decision: 'REUSE_PATH',
        path: {
          id: path.id, version: path.version, status: path.status,
          steps: path.steps, qualityScore: path.quality_score
        },
        familyId: gate.family.id,
        reason: gate.reason,
        searchResults,
        llmInstruction: {
          note: 'LLM receives original task unchanged. Path governs infrastructure only.',
          contextAddedTokens: 0,
          suggestedProvider: provider, suggestedModel: model
        },
        metrics: { latencyMs: Date.now() - start, llmCalls, tavilyCalls, tokens, contextAddedTokens: 0 },
        request_id: req.request_id
      });
    }

    // ---- RESEARCH / REFRESH / REJECT_REUSE: full research execution ----
    const agent = new AgentC({
      agentId: agentId || 'neurannet-research',
      name: 'NeuraNet Path Research Agent',
      model: (llm && llm.model) || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-lightning:free',
      modelProvider: (llm && llm.provider) || 'openrouter',
      neuraNetConfig: { apiKey: req.headers['x-api-key'], baseURL: `http://${req.get('host')}` },
      searchProvider: new WebSearchProvider()
    });
    const origInfer = agent._inferDomain.bind(agent);
    agent._inferDomain = (t) => t === task ? signature.domain : origInfer(t);

    const result = await agent.research(task, { baselineMode: false });

    const normalizedSources = result.researchResult.normalizedSources || [];
    const qualityEval = {
      qualityScore: result.metrics.qualityScore || 0.5,
      verification: result.verification.verificationStatus
    };
    const latencyMs = Date.now() - start;

    // Learn the executed path asynchronously (never blocks response per §12)
    setImmediate(async () => {
      try {
        const family = await registry.getOrCreateFamily(orgId, signature);
        const canonical = await registry.getCanonicalPath(family.id);

        const steps = [
          ...(canonical?.steps?.length ? canonical.steps : []),
          ...result.strategyExtraction.strategies.slice(0, 2).map((s, i) => ({
            order: (canonical?.steps?.length || 0) + i + 1,
            action: 'learned_strategy', params: String(s.strategy).slice(0, 120)
          }))
        ];
        const candidate = await registry.saveCandidatePath({
          orgId, familyId: family.id,
          steps: steps.length ? steps : [{ order: 1, action: 'search_general' }],
          parentId: canonical?.id || null,
          provenance: {
            createdBy: agentId || 'neurannet',
            reason: `execution quality ${qualityEval.qualityScore}`,
            evidenceProductionId: d_productionId(result),
            signatureExample: signature
          },
          metrics: {
            quality: qualityEval.qualityScore,
            verification: qualityEval.verification,
            latencyMs,
            sourceCount: normalizedSources.length,
            llmCalls: 1,
            toolsRequired: ['tavily']
          }
        });

        const cmp = registry.comparePaths(canonical, candidate);
        let promoted = null;
        if (cmp === 'NEW' || cmp === 'BETTER') promoted = await registry.promoteCanonical(candidate.id);

        await registry.recordExecution({
          orgId, pathId: promoted ? promoted.id : (canonical?.id || candidate.id),
          productionId: d_productionId(result),
          taskSignature: signature, decision: 'RESEARCH',
          decisionReason: gate.decision === 'REJECT_REUSE' ? gate.reason : (gate.reason || 'no compatible canonical'),
          latencyMs, llmCalls: 1, tavilyCalls: 1,
          inputTokens: result.metrics.totalTokensInput || 0,
          outputTokens: result.metrics.totalTokensOutput || 0,
          qualityScore: qualityEval.qualityScore, success: true
        });
      } catch (e) {
        console.error('[neurannet] async path learning failed:', e.message);
      }
    });

    function d_productionId(r2) { return r2.experienceSubmission?.experienceId || null; }

    return res.json({
      decision: gate.decision === 'REJECT_REUSE' ? 'REJECT_REUSE->RESEARCH' : 'RESEARCH',
      rejectedReason: gate.decision === 'REJECT_REUSE' ? gate.reason : undefined,
      familyKey: signature.familyKey,
      production: {
        id: result.experienceSubmission?.experienceId || null,
        outcome: result.outcome?.slice(0, 500),
        sources: normalizedSources.slice(0, 3)
      },
      llmInstruction: { contextAddedTokens: 0 },
      metrics: {
        latencyMs, llmCalls: 1, tavilyCalls: 1,
        tokens: { input: result.metrics.totalTokensInput || 0, output: result.metrics.totalTokensOutput || 0 },
        contextAddedTokens: 0
      },
      request_id: req.request_id
    });

  } catch (err) {
    console.error('[neurannet/execute]', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message, request_id: req.request_id });
  }
});

/** POST /v1/neurannet/evaluate — submit an external evaluation for a path execution */
router.post('/evaluate', authenticateApiKey, async (req, res) => {
  const { executionId, qualityScore, success } = req.body;
  if (!executionId) return res.status(400).json({ error: 'executionId required' });
  if (typeof qualityScore === 'number') {
    const q = Math.max(0, Math.min(1, qualityScore));
    await pool.query(`UPDATE path_executions SET quality_score=$1 WHERE id=$2`, [q, executionId]);
  }
  if (typeof success === 'boolean') {
    await pool.query(`UPDATE path_executions SET success=$1 WHERE id=$2`, [success, executionId]);
  }
  res.json({ ok: true, request_id: req.request_id });
});

/** GET /v1/neurannet/families/:id — family with its paths */
router.get('/families/:id', authenticateApiKey, async (req, res) => {
  const fam = await pool.query(`SELECT * FROM problem_families WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.organization_id]);
  if (!fam.rows[0]) return res.status(404).json({ error: 'Not found' });
  const paths = await pool.query(
    `SELECT id, version, parent_id, status, is_canonical, quality_score, score_components,
            usage_count, failure_count, created_at
     FROM resolution_paths WHERE family_id=$1 ORDER BY version DESC`, [req.params.id]);
  res.json({ family: fam.rows[0], paths: paths.rows, request_id: req.request_id });
});

/** GET /v1/neurannet/paths/:id — full path with versions and executions */
router.get('/paths/:id', authenticateApiKey, async (req, res) => {
  const p = await pool.query(`SELECT * FROM resolution_paths WHERE id=$1 AND organization_id=$2`,
    [req.params.id, req.organization_id]);
  if (!p.rows[0]) return res.status(404).json({ error: 'Not found' });
  const versions = await pool.query(`SELECT * FROM path_versions WHERE path_id=$1 ORDER BY version`, [req.params.id]);
  const executions = await pool.query(
    `SELECT id, decision, latency_ms, llm_calls, tavily_calls, quality_score, success, created_at
     FROM path_executions WHERE path_id=$1 ORDER BY created_at DESC LIMIT 50`, [req.params.id]);
  res.json({ path: p.rows[0], versions: versions.rows, executions: executions.rows, request_id: req.request_id });
});

/** GET /v1/neurannet/paths/:id/history */
router.get('/paths/:id/history', authenticateApiKey, async (req, res) => {
  const history = await registry.getPathHistory(req.params.id);
  res.json({ history, request_id: req.request_id });
});

/** GET /v1/neurannet/metrics */
router.get('/metrics', authenticateApiKey, async (req, res) => {
  const orgId = req.organization_id;
  const totals = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM problem_families WHERE organization_id=$1) AS families,
      (SELECT COUNT(*) FROM resolution_paths WHERE organization_id=$1) AS paths,
      (SELECT COUNT(*) FROM resolution_paths WHERE organization_id=$1 AND is_canonical) AS canonical_paths,
      (SELECT COUNT(*) FROM resolution_paths WHERE organization_id=$1 AND status='SUPERSEDED') AS superseded,
      (SELECT COUNT(*) FROM resolution_paths WHERE organization_id=$1 AND status='REJECTED') AS rejected,
      (SELECT COUNT(*) FROM path_executions WHERE organization_id=$1) AS executions,
      (SELECT COALESCE(SUM(context_added_tokens),0) FROM path_executions WHERE organization_id=$1) AS total_context_added_tokens
  `, [orgId]);
  const byDecision = await pool.query(`
    SELECT decision, COUNT(*) FROM path_executions WHERE organization_id=$1 GROUP BY decision
  `, [orgId]);
  res.json({ metrics: totals.rows[0], byDecision: byDecision.rows, request_id: req.request_id });
});

export { router as neurannetRoutes };

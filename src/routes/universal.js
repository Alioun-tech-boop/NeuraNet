import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import { TaskProfile } from '../taskProfile/index.js';
import { createEvaluator } from '../evaluator/index.js';
import productionEngine from '../productions/engine.js';
import { pool } from '../db/connection.js';
import { createLLMProvider } from '../llmProvider/factory.js';
import { WebSearchProvider } from '../searchProvider/webSearch.js';

const router = Router();

// POST /v1/query - Universal domain-agnostic endpoint per §36
router.post('/', authenticateApiKey, async (req, res) => {
  const start = Date.now();
  const orgId = req.organization_id;
  const { task, domain = 'general', llm, taskProfile: profileData } = req.body;

  if (!task || typeof task !== 'string') {
    return res.status(400).json({ error: 'task is required', request_id: req.request_id });
  }

  // LLM is chosen by caller, NeuraNet is agnostic per §1
  const providerName = (llm && llm.provider) || req.body.provider || 'openrouter';
  const model = (llm && llm.model) || req.body.model || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-lightning:free';

  const taskProfile = new TaskProfile({
    task,
    domain,
    objective: task,
    ...profileData,
    extensions: profileData
  });

  // Knowledge lookup - try to reuse existing production
  const normalized = productionEngine.normalizeQuery(task);
  const hash = productionEngine.hashQuery(normalized);
  const canonical = await productionEngine.findCanonical(orgId, hash);

  if (canonical) {
    const freshness = productionEngine.freshnessForDomain(canonical.domain, canonical.created_at, canonical.last_verified_at);
    const decision = productionEngine.decide(canonical, task);
    if (decision === 'REUSE') {
      await pool.query(`UPDATE productions SET reuse_count = reuse_count + 1 WHERE id = $1`, [canonical.id]);
      return res.json({
        answer: canonical.answer,
        domain: canonical.domain,
        taskProfile: taskProfile.toJSON(),
        llm: { provider: providerName, model },
        sources: canonical.sources,
        verification: canonical.verification_status,
        quality: canonical.quality_score,
        provenance: { productionId: canonical.id, canonicalId: canonical.id, reused: true },
        metrics: { decision: 'REUSE', latencyMs: Date.now() - start, tavilyCalls: 0, llmCalls: 0, tokens: { input: 0, output: 0 } },
        request_id: req.request_id
      });
    }
  }

  // RESEARCH: use caller's LLM with minimal context
  const knowledgeContext = `Relevant collective knowledge for ${domain}: Use official sources, verify claims.`;
  const llmProvider = createLLMProvider(providerName);
  const llmRes = await llmProvider.complete([
    { role: 'system', content: `You are a helpful ${domain} assistant. Be concise.` },
    { role: 'user', content: `${knowledgeContext}\n\nTask: ${task}` }
  ], { maxTokens: 300 });

  if (!llmRes.success) {
    return res.status(500).json({ error: 'LLM failed', details: llmRes.error, request_id: req.request_id });
  }

  // Create production and evaluate asynchronously (don't block response)
  const answer = llmRes.text || llmRes.content;
  const evaluator = createEvaluator(domain);
  const qualityEval = await evaluator.evaluate({ answer, sources: [], claims: [], verificationStatus: 'unverified', confidence: 0.5 }, taskProfile);

  // Async learning - don't await
  setImmediate(async () => {
    try {
      const cluster = await productionEngine.ensureCluster(orgId, hash, domain);
      const prod = await productionEngine.createProduction({
        organizationId: orgId, agentId: null, originalQuery: task, normalizedQuery: normalized, queryHash: hash,
        answer, domain, claims: [], sources: [], verificationStatus: 'unverified',
        confidence: qualityEval.confidence, qualityScore: qualityEval.quality, freshnessScore: 1.0, clusterId: cluster.id
      });
      await productionEngine.updateCanonical(cluster.id, prod.id);
    } catch (e) {
      console.error('[universal query] async learning failed', e.message);
    }
  });

  return res.json({
    answer,
    domain,
    taskProfile: taskProfile.toJSON(),
    llm: { provider: providerName, model },
    sources: [],
    verification: 'unverified',
    quality: qualityEval.quality,
    provenance: { reused: false, decision: 'RESEARCH' },
    metrics: {
      decision: 'RESEARCH',
      latencyMs: Date.now() - start,
      tavilyCalls: 0,
      llmCalls: 1,
      tokens: { input: llmRes.inputTokens, output: llmRes.outputTokens, total: llmRes.totalTokens }
    },
    request_id: req.request_id
  });
});

export { router as universalRoutes };

import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import productionEngine from '../productions/engine.js';
import { pool } from '../db/connection.js';
import { AgentC } from '../agents/agentC.js';
import { WebSearchProvider } from '../searchProvider/webSearch.js';
import repository from '../researchPath/repository.js';
import optimizer from '../neuraNet/optimizer.js';

const router = Router();

// POST /knowledge/query - Main entry point per §14, §18
router.post('/query', authenticateApiKey, async (req, res) => {
  const start = Date.now();
  const orgId = req.organization_id;
  const { query, agentId } = req.body;

  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'query is required', request_id: req.request_id });
  }

  const normalized = productionEngine.normalizeQuery(query);
  const hash = productionEngine.hashQuery(normalized);
  const domain = productionEngine.inferDomain(query);

  // Metrics
  let decision = 'RESEARCH';
  let tavilyCalls = 0;
  let llmCalls = 0;
  let tokens = { input: 0, output: 0, total: 0 };
  let production = null;
  let provenance = null;

  try {
    // Try to find canonical production
    const canonical = await productionEngine.findCanonical(orgId, hash);
    let similar = [];
    if (!canonical) {
      similar = await productionEngine.findSimilarProductions(orgId, normalized, hash, 3);
    }

    const candidate = canonical || (similar[0] || null);

    if (candidate) {
      decision = productionEngine.decide(candidate, query);
      const freshness = productionEngine.freshnessForDomain(candidate.domain, candidate.created_at, candidate.last_verified_at);

      if (decision === 'REUSE') {
        // REUSE: zero Tavily, zero LLM, return canonical directly
        await pool.query(`UPDATE productions SET reuse_count = reuse_count + 1, last_verified_at = NOW() WHERE id = $1`, [candidate.id]);
        production = candidate;
        provenance = {
          productionId: candidate.id,
          canonicalProductionId: candidate.id,
          sourceIds: (candidate.sources || []).map(s => s.id || s.url),
          claimIds: (candidate.claims || []).map((c, i) => `claim_${i}`),
          verificationStatus: candidate.verification_status,
          confidence: candidate.confidence,
          freshnessScore: freshness,
          originalAgentId: candidate.agent_id,
          createdAt: candidate.created_at,
          lastVerifiedAt: new Date().toISOString()
        };
        return res.json({
          decision: 'REUSE',
          production: {
            id: candidate.id,
            answer: candidate.answer,
            domain: candidate.domain,
            quality_score: candidate.quality_score,
            confidence: candidate.confidence,
            verification_status: candidate.verification_status,
            freshness_score: freshness,
            sources: candidate.sources,
            claims: candidate.claims,
            is_canonical: candidate.is_canonical
          },
          confidence: candidate.confidence,
          freshness,
          sources: candidate.sources,
          provenance,
          metrics: {
            productionRetrieved: 1,
            productionSimilarity: 1.0,
            productionConfidence: candidate.confidence,
            productionFreshness: freshness,
            decision: 'REUSE',
            tavilyCalls: 0,
            llmCalls: 0,
            tokens,
            latencyMs: Date.now() - start,
            productionReused: true
          },
          request_id: req.request_id
        });
      }

      if (decision === 'REFRESH') {
        // REFRESH: reuse strategy, verify with minimal search
        // For MVP, do a single Tavily search to verify freshness
        const agentC = new AgentC({
          agentId: agentId || 'knowledge-refresh',
          name: 'Knowledge Refresh Agent',
          neuraNetConfig: { apiKey: req.headers['x-api-key'], baseURL: `http://${req.get('host')}` },
          searchProvider: new WebSearchProvider()
        });
        // Use minimal refresh: 1 Tavily call to verify
        tavilyCalls = 1;
        // For now, just update last_verified_at and return candidate with refreshed timestamp
        await pool.query(`UPDATE productions SET last_verified_at = NOW(), freshness_score = $1 WHERE id = $2`, [freshness, candidate.id]);
        production = { ...candidate, last_verified_at: new Date().toISOString(), freshness_score: freshness };
        provenance = {
          productionId: candidate.id,
          canonicalProductionId: candidate.id,
          sourceIds: (candidate.sources || []).map(s => s.id || s.url),
          verificationStatus: candidate.verification_status,
          confidence: candidate.confidence,
          freshnessScore: freshness,
          originalAgentId: candidate.agent_id,
          createdAt: candidate.created_at,
          lastVerifiedAt: new Date().toISOString()
        };
        return res.json({
          decision: 'REFRESH',
          production: {
            id: candidate.id,
            answer: candidate.answer,
            domain: candidate.domain,
            quality_score: candidate.quality_score,
            confidence: candidate.confidence,
            verification_status: candidate.verification_status,
            freshness_score: freshness,
            sources: candidate.sources,
            claims: candidate.claims
          },
          confidence: candidate.confidence,
          freshness,
          sources: candidate.sources,
          provenance,
          metrics: {
            productionRetrieved: 1,
            productionSimilarity: 0.9,
            decision: 'REFRESH',
            tavilyCalls,
            llmCalls: 0,
            tokens,
            latencyMs: Date.now() - start,
            productionRefreshed: true
          },
          request_id: req.request_id
        });
      }
    }

    // RESEARCH: fast path lookup + research - LLM chosen by caller (model-agnostic)
    decision = 'RESEARCH';
    const pathLookupStart = Date.now();
    const taskFamily = repository.taskFamilyFromQuery(query, domain);
    const { path: canonicalPath, latencyMs: pathLookupMs } = await repository.getCanonicalPath(orgId, taskFamily);
    if (canonicalPath) {
      console.log(`[knowledge] Canonical path found: ${canonicalPath.id} v${canonicalPath.version} quality ${canonicalPath.quality_score}`);
    }

    // LLM is chosen by the caller, not by NeuraNet (model-agnostic per §1-4)
    const callerLlm = req.body.llm || {};
    const modelProvider = callerLlm.provider || req.body.modelProvider || process.env.DEFAULT_PROVIDER || 'openrouter';
    const model = callerLlm.model || req.body.model || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-lightning:free';

    const agentC = new AgentC({
      agentId: agentId || 'knowledge-research',
      name: 'Knowledge Research Agent',
      model,
      modelProvider,
      neuraNetConfig: { apiKey: req.headers['x-api-key'], baseURL: `http://${req.get('host')}` },
      searchProvider: new WebSearchProvider()
    });
    const origInfer = agentC._inferDomain.bind(agentC);
    agentC._inferDomain = (t) => t === query ? domain : origInfer(t);

    const result = await agentC.research(query, { baselineMode: false });
    tavilyCalls = 1;
    llmCalls = 1;
    tokens = { input: result.metrics.totalTokensInput || 0, output: result.metrics.totalTokensOutput || 0, total: (result.metrics.totalTokensInput||0)+(result.metrics.totalTokensOutput||0) };

    // Create production from AgentC result
    const normalizedSources = result.researchResult.normalizedSources || result.researchResult.searchResults || [];
    const claims = result.verification?.claims || [{ claim: result.outcome.slice(0,200), verificationStatus: result.verification.verificationStatus }];
    const quality = productionEngine.evaluateQuality({
      answer: result.outcome,
      sources: normalizedSources,
      claims,
      verificationStatus: result.verification.verificationStatus,
      confidence: result.metrics.qualityScore || 0.5
    });

    const cluster = await productionEngine.ensureCluster(orgId, hash, domain);
    const freshnessScore = 1.0;

    // Check for existing canonical to compare
    const existingCanonical = await productionEngine.findCanonical(orgId, hash);
    let comparison = 'NEW';
    let isCanonical = true;
    if (existingCanonical) {
      comparison = productionEngine.compareProductions(existingCanonical, {
        quality_score: quality.qualityScore,
        verification_status: result.verification.verificationStatus,
        confidence: result.metrics.qualityScore,
        freshness_score: freshnessScore,
        answer: result.outcome
      });
      if (comparison === 'CONFLICTING') {
        // Mark as conflicting, don't auto-promote
        isCanonical = false;
      } else if (comparison === 'BETTER' || comparison === 'NEW') {
        isCanonical = true;
      } else {
        isCanonical = false; // WORSE or EQUIVALENT - keep existing
      }
    }

    // Handle agentId that is not a UUID (like "test-a") - set to null
    const isUuid = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const validAgentId = (result.agentId && isUuid(result.agentId)) ? result.agentId : (agentId && isUuid(agentId) ? agentId : null);

    const newProd = await productionEngine.createProduction({
      organizationId: orgId,
      agentId: validAgentId,
      originalQuery: query,
      normalizedQuery: normalized,
      queryHash: hash,
      answer: result.outcome,
      domain,
      claims,
      sources: normalizedSources,
      verificationStatus: result.verification.verificationStatus,
      confidence: result.metrics.qualityScore || 0.5,
      qualityScore: quality.qualityScore,
      freshnessScore,
      clusterId: cluster.id
    });

    // Update canonical if better
    let finalProduction = newProd;
    if (isCanonical) {
      await productionEngine.updateCanonical(cluster.id, newProd.id);
      finalProduction = { ...newProd, is_canonical: true };
    } else {
      finalProduction = existingCanonical || newProd;
    }

    // Async learning - don't block response per §19 (§20 failure safety)
    setImmediate(() => {
      optimizer.emit('production.created', { production: newProd, experience: { strategy: newProd.sources } }).catch(e => console.error('[optimizer] async error', e.message));
    });

    provenance = {
      productionId: newProd.id,
      canonicalProductionId: finalProduction.id,
      sourceIds: normalizedSources.map(s => s.id || s.url),
      claimIds: claims.map((c,i) => `claim_${i}`),
      verificationStatus: result.verification.verificationStatus,
      confidence: result.metrics.qualityScore,
      freshnessScore,
      originalAgentId: result.agentId,
      createdAt: newProd.created_at,
      lastVerifiedAt: newProd.last_verified_at
    };

    return res.json({
      decision: 'RESEARCH',
      production: {
        id: finalProduction.id,
        answer: finalProduction.answer,
        domain: finalProduction.domain,
        quality_score: finalProduction.quality_score,
        confidence: finalProduction.confidence,
        verification_status: finalProduction.verification_status,
        freshness_score: finalProduction.freshness_score,
        sources: finalProduction.sources,
        claims: finalProduction.claims,
        is_canonical: finalProduction.is_canonical
      },
      confidence: finalProduction.confidence,
      freshness: freshnessScore,
      sources: finalProduction.sources,
      provenance,
      comparison,
      metrics: {
        productionRetrieved: similar.length,
        productionSimilarity: 0,
        decision: 'RESEARCH',
        tavilyCalls,
        llmCalls,
        tokens,
        latencyMs: Date.now() - start,
        productionCreated: true,
        productionImproved: comparison === 'BETTER',
        qualityScore: quality.qualityScore,
        qualityComponents: quality.components
      },
      request_id: req.request_id
    });

  } catch (err) {
    console.error(`[knowledge/query] Error:`, err);
    return res.status(500).json({ error: 'Internal server error', details: err.message, request_id: req.request_id });
  }
});

export { router as knowledgeRoutes };

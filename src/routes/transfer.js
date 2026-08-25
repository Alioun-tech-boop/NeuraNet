import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import registry, { buildProblemSignature } from '../pathEngine/registry.js';
import { pool } from '../db/connection.js';
import { AgentC } from '../agents/agentC.js';
import { WebSearchProvider } from '../searchProvider/webSearch.js';

const router = Router();

/**
 * POST /v1/neurannet/transfer — forces NEW execution guided by retrieved strategy.
 * Unlike REUSE (which returns cached answers), TRANSFER always executes fresh research.
 * The learned strategy optimizes the search query and source selection,
 * but the LLM prompt remains the original task only (zero-context invariant).
 */
router.post('/transfer', authenticateApiKey, async (req, res) => {
  const start = Date.now();
  const orgId = req.organization_id;
  const { task, llm } = req.body;
  if (!task || typeof task !== 'string') return res.status(400).json({ error:'task required', request_id:req.request_id });

  const provider = (llm?.provider) || 'openrouter';
  const model = (llm?.model) || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3.5-lightning:free';
  const signature = buildProblemSignature(task);

  try {
    // Step 1: Find compatible family and canonical path (semantic matching)
    const fam = await registry.findFamilyWithFallback(orgId, signature);
    let canonicalPath = null;
    if (fam) canonicalPath = await registry.getCanonicalPath(fam.id);

    // Step 2: Execute research guided by path strategy (infrastructure-side)
    // The strategy determines WHERE to search and WHAT to look for,
    // but never modifies the LLM prompt (zero-context invariant).
    let searchQuery = task; // default: use task as-is
    let strategyApplied = false;
    let appliedStrategyId = null;

    if (canonicalPath?.steps?.length) {
      // Extract learned query pattern from path steps
      const searchStep = canonicalPath.steps.find(s => 
        s.action?.includes('search') || s.action?.includes('official') || s.tool === 'tavily'
      );
      if (searchStep?.queryPattern || searchStep?.params?.queryPattern) {
        searchQuery = searchStep.queryPattern || searchStep.params.queryPattern;
        strategyApplied = true;
        appliedStrategyId = canonicalPath.id;
      }
      // Also check provenance for stored query patterns
      if (!strategyApplied && canonicalPath.provenance?.queryPattern) {
        searchQuery = canonicalPath.provenance.queryPattern;
        strategyApplied = true;
        appliedStrategyId = canonicalPath.id;
      }
    }

    // Step 3: Execute fresh Tavily search with optimized query
    const sp = new WebSearchProvider();
    const searchStart = Date.now();
    const sr = await sp.search(searchQuery, { maxResults: 3 });
    const tavilyLatency = Date.now() - searchStart;

    // Step 4: Call caller's LLM with ORIGINAL task + tool results (not strategy text)
    const sourcesContext = (sr.results||[]).slice(0,3).map(r => 
      `${r.title}: ${r.snippet?.slice(0,200)||''} (${r.url})`
    ).join('\n');

    const llmMessages = [
      { role:'system', content:'You are a concise research assistant. Cite sources.' },
      { role:'user', content: `${task}\n\nSources:\n${sourcesContext}\n\nAnswer concisely citing [1],[2] etc.` }
    ];

    // Use Groq for reliable execution (caller can override)
    const groqKey = process.env.GROQ_API_KEY;
    const llmStart = Date.now();
    let llmRes;
    if (groqKey && provider === 'groq') {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${groqKey}`},
        body:JSON.stringify({model:process.env.GROQ_MODEL||'allam-2-7b',
          messages:llmMessages,max_tokens:500,temperature:0.7})
      });
      const jd = await r.json();
      llmRes = { content: jd.choices?.[0]?.message?.content||'', inputTokens: jd.usage?.prompt_tokens||0, outputTokens: jd.usage?.completion_tokens||0 };
    } else {
      // fallback to openrouter
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENROUTER_API_KEY}`},
        body:JSON.stringify({model,model_messages:undefined,messages:llmMessages,max_tokens:500})
      }).catch(()=>null);
      if (!r || !r.ok) throw new Error('LLM call failed');
      const jd = await r.json();
      llmRes = { content: jd.choices?.[0]?.message?.content||'', inputTokens: jd.usage?.prompt_tokens||0, outputTokens: jd.usage?.completion_tokens||0 };
    }
    const llmLatency = Date.now() - llmStart;

    // Step 5: Store production
    await pool.query(
      `INSERT INTO productions (organization_id, original_query, normalized_query, answer, domain, verification_status)
       VALUES ($1,$2,$3,$4,$5,'unverified')`,
      [orgId, task, task.toLowerCase().trim(), llmRes.content, signature.domain]
    );

    res.json({
      decision: 'TRANSFER_EXECUTED',
      answer: llmRes.content,
      strategyApplied,
      appliedStrategyId,
      searchQueryUsed: searchQuery,
      sourcesCount: sr.results.length,
      metrics: {
        latencyMs: Date.now() - start,
        llmLatencyMs: llmLatency,
        tavilyLatencyMs: searchStart ? Date.now() - searchStart : 0,
        llmCalls: 1,
        tavilyCalls: sr.results.length > 0 ? 1 : 0,
        contextAddedTokens: 0,
        totalTokens: (llmRes.inputTokens||0)+(llmRes.outputTokens||0)
      },
      request_id: req.request_id
    });

  } catch(err) {
    console.error('[neurannet/transfer]', err.message);
    res.status(500).json({ error: err.message, request_id: req.request_id });
  }
});

export function registerTransferRoutes(app) {
  app.use('/v1/neurannet', router);
}

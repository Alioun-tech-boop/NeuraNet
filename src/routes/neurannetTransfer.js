import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import registry, { buildProblemSignature } from '../pathEngine/registry.js';
import { WebSearchProvider } from '../searchProvider/webSearch.js';

const router = Router();

router.post('/transfer', authenticateApiKey, async (req, res) => {
  const start = Date.now();
  const orgId = req.organization_id;
  const task = req.body?.task;
  if (!task) return res.status(400).json({ error:'task required', request_id:req.request_id });

  try {
    const signature = buildProblemSignature(task);
    const fam = await registry.findFamilyWithFallback(orgId, signature);
    const canonicalPath = fam ? await registry.getCanonicalPath(fam.id) : null;

    let searchQuery = task;
    let strategyApplied = false;
    if (canonicalPath?.steps?.length) {
      for (const step of canonicalPath.steps) {
        if (step.queryPattern || step.params?.queryPattern) {
          searchQuery = step.queryPattern || step.params.queryPattern;
          strategyApplied = true;
          break;
        }
      }
    }

    const sp = new WebSearchProvider();
    const sr = await sp.search(searchQuery, { maxResults: 3 });
    const sources = sr.results.map(r => ({ url: r.url, title: r.title }));

    const sourcesCtx = sources.slice(0, 3).map(r => `${r.title}: ${r.url}`).join('\n');
    const llmStart = Date.now();
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'allam-2-7b',
        messages: [
          { role: 'system', content: 'You are a concise research assistant.' },
          { role: 'user', content: `${task}\n\nSources:\n${sourcesCtx}\n\nAnswer concisely citing [1],[2].` }
        ],
        max_tokens: 400
      })
    });
    const jd = await groqRes.json();
    const answer = jd.choices?.[0]?.message?.content || '';
    const inputTokens = jd.usage?.prompt_tokens || 0;
    const outputTokens = jd.usage?.completion_tokens || 0;

    res.json({
      decision: 'TRANSFER_EXECUTED',
      answer,
      sources,
      strategyApplied,
      searchQueryUsed: searchQuery,
      metrics: {
        latencyMs: Date.now() - start,
        llmLatencyMs: Date.now() - llmStart,
        totalTokens: inputTokens + outputTokens,
        contextAddedTokens: 0
      },
      request_id: req.request_id
    });

  } catch (err) {
    console.error('[neurannet/transfer] Error:', err.message);
    res.status(500).json({ error: err.message, request_id: req.request_id });
  }
});

export { router as transferRouter };

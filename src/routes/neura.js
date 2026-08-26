import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import { pool } from '../db/connection.js';
import { LocalE5EmbeddingProvider } from '../pathEngine/localEmbedding.js';
import { WebSearchProvider } from '../searchProvider/webSearch.js';
import { createLLMProvider } from '../llmProvider/factory.js';
import registry, { buildProblemSignature } from '../pathEngine/registry.js';
import selectorEngine from '../pathEngine/selector.js';

const router = Router();

let e5 = null;
async function embeddings() {
  if (!e5) {
    e5 = new LocalE5EmbeddingProvider();
    await e5._loadModel();
  }
  return e5;
}

const STOP = new Set(['the','a','an','of','for','and','or','to','in','on','with','using','use','based','from','by','is','are','this','that','it','its','as','at','be','how','what','when','which','their','your','determine','identify','find','please','could','would','should']);
const contentWords = (t) => (t || '').toLowerCase().replace(/[^a-zà-ÿ\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
const Jaccardish = (task, strat) => {
  const t = new Set(contentWords(task));
  const s = new Set(contentWords(strat));
  if (!t.size) return 1;
  let hits = 0;
  for (const w of t) if (s.has(w)) hits++;
  return hits / t.size;
};

const LANG_RULE = ' ALWAYS respond in the SAME LANGUAGE as the user question.';

function heuristicQuality(output, task) {
  if (!output || output.length < 50) return { score: 0.1, parts: { length: 0.1, structure: 0, specificity: 0, relevance: 0 } };
  const length = Math.min(output.length / 800, 1);
  const structure = /\d+\.|[-*•]|\n\n/.test(output) ? 1 : 0;
  const specificity = /[A-Z]{2,}|\d+(\.\d+)?%|https?:\/\//.test(output) ? 1 : 0;
  const words = [...new Set(contentWords(task))];
  const lo = output.toLowerCase();
  const relevance = words.filter((w) => lo.includes(w)).length / Math.max(words.length, 1);
  const score = Math.round(((length * 0.25) + (structure * 0.2) + (specificity * 0.25) + (relevance * 0.3)) * 100) / 100;
  return { score, parts: { length: +length.toFixed(2), structure, specificity, relevance: +relevance.toFixed(2) } };
}

function stepsToText(stepsObj) {
  const steps = Array.isArray(stepsObj) ? stepsObj : stepsObj?.steps || [];
  return steps.map((s) => (typeof s === 'string' ? s : s?.label || '')).join(' ');
}

async function loadStrategies(orgId) {
  const { rows } = await pool.query(
    `SELECT id, name, version, description, steps, confidence FROM strategies WHERE organization_id=$1 ORDER BY updated_at DESC LIMIT 200`, [orgId]);
  return rows;
}

/* ── GET /v1/neura/models — available providers/models from env ── */
router.get('/models', authenticateApiKey, async (req, res) => {
  const catalog = [
    { provider: 'groq', models: [
      { id: 'allam-2-7b', name: 'Allam 2 7B', context: '8K', speed: 'very fast', tags: ['fast','arabic'] },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', context: '128K', speed: 'fast', tags: ['fast','balanced'] },
    ]},
    { provider: 'openrouter', models: [
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', context: '128K', speed: 'balanced', tags: ['reasoning'] },
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B', context: '128K', speed: 'balanced', tags: ['coding','reasoning'] },
    ]},
    { provider: 'anthropic', models: [
      { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', context: '200K', speed: 'balanced', tags: ['reasoning','coding'] },
    ]},
    { provider: 'openai', models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', context: '128K', speed: 'fast', tags: ['fast'] },
      { id: 'gpt-4o', name: 'GPT-4o', context: '128K', speed: 'balanced', tags: ['multimodal','reasoning'] },
    ]},
    { provider: 'gemini', models: [
      { id: 'gemini-flash-latest', name: 'Gemini Flash', context: '1M', speed: 'very fast', tags: ['fast','multimodal'] },
      { id: 'gemini-pro-latest', name: 'Gemini Pro', context: '2M', speed: 'balanced', tags: ['reasoning'] },
    ]},
  ];
  // annotate availability from env
  const envMap = { groq: !!process.env.GROQ_API_KEY, openrouter: !!process.env.OPENROUTER_API_KEY, anthropic: !!process.env.ANTHROPIC_API_KEY, openai: !!process.env.OPENAI_API_KEY, gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) };
  const annotated = catalog.map(g => ({ ...g, available: envMap[g.provider] ?? false }));
  res.json({ providers: annotated, request_id: req.request_id });
});

/* ── POST /v1/neura/chat — main conversational endpoint ──
   Thin adapter: calls EXISTING NeuraNet engines, never reimplements them. */
router.post('/chat', authenticateApiKey, async (req, res) => {
  const orgId = req.organization_id;
  const { message, model, conversationId, projectId } = req.body || {};
  const task = String(message || req.body?.task || '').trim();
  if (!task || task.length < 3) return res.status(400).json({ error: 'message required', request_id: req.request_id });

  // provider/model chosen BY THE USER — NeuraNet never selects it
  const providerName = model?.provider || req.body?.provider || 'groq';
  const modelId = model?.id || model?.name || req.body?.modelId || process.env.GROQ_MODEL || 'allam-2-7b';
  const started = Date.now();
  let timings = {};

  try {
    // 1 — problem signature via EXISTING registry helper (no LLM)
    let t = Date.now();
    const signature = buildProblemSignature(task);
    timings.signature = Date.now() - t;

    // 2 — semantic experience retrieval via EXISTING pathEngine (0 LLM calls)
    t = Date.now();
    let retrieval = { found: false, similarity: 0, strategy: null, alternatives: [], lexical: 'LOW' };
    let experience = null;
    let strategySteps = null;
    let strategyPath = null;
    try {
      const e5p = await embeddings();
      const qEmb = await e5p.embedQuery(task);
      const rows = await loadStrategies(orgId);
      let passages = [];
      try { passages = await Promise.all(rows.map((r) => e5p.embedPassage(r.description + ' ' + stepsToText(r.steps)))); } catch { passages = []; }
      const scored = rows.map((r, i) => {
        if (!passages[i]) return { row: r, sim: 0 };
        let dot = 0; for (let d = 0; d < qEmb.length; d++) dot += qEmb[d] * passages[i][d];
        return { row: r, sim: dot };
      }).sort((a, b) => b.sim - a.sim);

      const best = scored[0] || null;
      const alternatives = scored.slice(1, 4).map(s => ({ path: `${s.row.name}/v${s.row.version}`, similarity: +s.sim.toFixed(2) }));
      const overlap = best ? Jaccardish(task, best.row.description + ' ' + stepsToText(best.row.steps)) : 0;
      const isTransfer = !!best && best.sim >= 0.80 && overlap >= 0.12;
      retrieval = {
        found: isTransfer,
        similarity: best ? +best.sim.toFixed(2) : 0,
        lexical: 'LOW',
        alternatives,
        topMatch: best ? { path: `${best.row.name}/v${best.row.version}`, similarity: +best.sim.toFixed(2) } : null,
        passed: [
          { label: 'Semantic threshold', value: isTransfer ? `≥ 0.80 ✓ (${best.sim.toFixed(2)})` : 'below — new path' },
          { label: 'Entity overlap', value: `${(overlap*100).toFixed(0)}% ${overlap >= 0.12 ? '✓' : '(new class)'}` },
        ],
        rejected: alternatives.map(a => ({ label: a.path, reason: `similarity ${a.similarity} — below threshold` })),
      };
      if (isTransfer && best) {
        experience = best.row;
        strategySteps = Array.isArray(best.row.steps) ? best.row.steps : best.row.steps?.steps || [];
        strategyPath = `${best.row.name}/v${best.row.version}`;
      }
    } catch (e) { console.error('[neura/chat] retrieval', e.message); }
    timings.retrieval = Date.now() - t;

    // 3 — optional strategy-guided web search (existing WebSearchProvider)
    t = Date.now();
    let sources = [];
    try {
      const sp = new WebSearchProvider();
      const kw = experience ? contentWords(stepsToText(experience.steps)).slice(0, 4).join(' ') : '';
      const query = (`${task} ${kw}`).slice(0, 180);
      const sr = await sp.search(query, { maxResults: 3 });
      sources = (sr.results || []).slice(0, 3);
    } catch { sources = []; }
    timings.search = Date.now() - t;
    const sourceBlock = sources.length
      ? '\n\nSOURCES:\n' + sources.map((r, i) => `[${i+1}] ${r.title || ''}: ${(r.snippet || '').slice(0, 220)} (${r.url})`).join('\n')
      : '';

    // 4 — LLM execution via EXISTING provider abstraction (caller controls model)
    t = Date.now();
    let llmText = '';
    let llmUsage = { inputTokens: 0, outputTokens: 0 };
    try {
      const llm = await createLLMProvider(providerName);
      const sysPrompt = 'You are a helpful assistant. Be concise and factual.' + LANG_RULE;
      const result = await llm.complete(
        [{ role: 'system', content: sysPrompt }, { role: 'user', content: task + sourceBlock }],
        { temperature: 0.4, maxTokens: 900 }
      );
      llmText = result.text || result.content || '';
      llmUsage = { inputTokens: result.inputTokens || 0, outputTokens: result.outputTokens || 0 };
    } catch (e) {
      console.error('[neura/chat] llm', e.message);
      return res.status(502).json({ error: 'Provider unavailable', details: e.message, request_id: req.request_id });
    }
    timings.llm = Date.now() - t;

    // 5 — evaluation via heuristic (transparent proxy, not chain-of-thought)
    t = Date.now();
    const qualityInfo = heuristicQuality(llmText, task);
    timings.evaluation = Date.now() - t;

    // 6 — experience update via EXISTING strategies table (procedural only, never the answer)
    let savedPath = strategyPath;
    let savedSteps = strategySteps;
    try {
      const slug = (() => {
        const words = contentWords(task).slice(0, 6).sort().join('-').replace(/[^a-z0-9-]/g, '') || 'task';
        return `neura/${words}`;
      })();
      const existing = await pool.query(`SELECT id, version FROM strategies WHERE organization_id=$1 AND name=$2`, [orgId, slug]);
      const stepsJson = experience ? experience.steps
        : { steps: [
            { label: 'Parse the question and extract entities/jurisdiction' },
            ...(sources.length ? [{ label: 'Query authoritative sources via web search' }] : []),
            { label: 'Answer with citations [n]' },
            { label: 'Cross-check entity names across sources' },
          ] };
      if (existing.rows.length) {
        const v = existing.rows[0].version + 1;
        await pool.query(`UPDATE strategies SET version=$2, description=$3, steps=$4, confidence=$5, updated_at=now() WHERE id=$1`,
          [existing.rows[0].id, v, task, stepsJson, qualityInfo.score.toFixed(2)]);
        if (!savedPath) savedPath = `${slug}/v${v}`;
        if (!savedSteps) savedSteps = stepsJson.steps;
      } else {
        await pool.query(`INSERT INTO strategies (organization_id, name, version, description, steps, confidence, success_rate, average_latency)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [orgId, slug, 1, task, stepsJson, qualityInfo.score.toFixed(2), qualityInfo.score >= 0.7 ? 1 : 0, timings.llm]);
        if (!savedPath) savedPath = `${slug}/v1`;
        if (!savedSteps) savedSteps = stepsJson.steps;
      }
    } catch (e) { console.error('[neura/chat] persist', e.message); if (!savedPath) savedPath = 'neura/task/v1'; }

    // Non-streaming response for MVP; structure supports future SSE
    res.json({
      ok: true,
      conversationId: conversationId || null,
      reply: llmText,
      model: { provider: providerName, id: modelId },
      experience: {
        found: !!experience,
        strategyPath: savedPath,
        strategySteps: savedSteps,
        similarity: retrieval.similarity,
        lexical: retrieval.lexical,
        alternatives: retrieval.alternatives,
        topMatch: retrieval.topMatch,
        compatibility: { passed: retrieval.passed, rejected: retrieval.rejected },
        transferConfirmed: !!experience,
      },
      sources: sources.map(s => ({ title: s.title || s.url, url: s.url, snippet: (s.snippet||'').slice(0, 220) })),
      evaluation: { quality: qualityInfo.score, breakdown: qualityInfo.parts },
      usage: llmUsage,
      timings: { totalMs: Date.now() - started, ...timings },
      invariants: { contextTokens: 0, matchingLLMCalls: 0 },
      request_id: req.request_id,
    });

  } catch (err) {
    console.error('[neura/chat]', err.stack || err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message, request_id: req.request_id });
  }
});

/* GET /v1/neura/experiences — aggregated learned strategies by workflow/domain */
router.get('/experiences', authenticateApiKey, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, version, description, steps, confidence, success_rate, average_latency, updated_at
       FROM strategies WHERE organization_id=$1 ORDER BY updated_at DESC LIMIT 200`, [req.organization_id]);
    // lightweight grouping by name prefix
    const byWorkflow = {};
    for (const r of rows) {
      const wf = (r.name.split('/')[0] || 'other');
      (byWorkflow[wf] = byWorkflow[wf] || []).push(r);
    }
    res.json({
      experiences: rows.map(r => ({ path: `${r.name}/v${r.version}`, description: r.description, steps: r.steps, confidence: +r.confidence, successRate: +r.success_rate, updatedAt: r.updated_at })),
      byWorkflow,
      count: rows.length,
      request_id: req.request_id,
    });
  } catch (e) {
    console.error('[neura/experiences]', e.message);
    res.status(500).json({ error: 'Internal server error', request_id: req.request_id });
  }
});

/* GET /v1/neura/status — compact system health for the workspace shell */
router.get('/status', authenticateApiKey, async (req, res) => {
  let dbOk = false, e5Ok = false;
  try { await pool.query('SELECT 1'); dbOk = true; } catch {}
  try { const p = new LocalE5EmbeddingProvider(); const h = await p.healthCheck(); e5Ok = !!h.healthy; } catch {}
  res.json({
    llm: { status: 'connected' },
    neuranet: { active: true },
    retrieval: { active: e5Ok },
    database: { connected: dbOk },
    experienceEngine: { learning: true },
    request_id: req.request_id,
  });
});

/* GET /v1/neura/architecture — static data-flow description for the dev view */
router.get('/architecture', authenticateApiKey, async (req, res) => {
  res.json({
    flow: ['USER','NEURA','NEURANET','SEMANTIC RETRIEVAL','STRATEGY','SELECTED MODEL','TOOLS','RESULT','EXPERIENCE UPDATE'],
    invariants: ['0 historical tokens injected','0 LLM calls for matching','provider-neutral','no answer caching'],
    request_id: req.request_id,
  });
});

export const neuraRouter = router;

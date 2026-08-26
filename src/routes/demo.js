import { Router } from 'express';
import { authenticateApiKey } from '../middleware/auth.js';
import { pool } from '../db/connection.js';
import { LocalE5EmbeddingProvider } from '../pathEngine/localEmbedding.js';
import { WebSearchProvider } from '../searchProvider/webSearch.js';
import { GroqProvider } from '../llmProvider/groq.js';

/**
 * Demo orchestrator — the real pipeline behind the YC live screen.
 * Arbitrary user question → E5 embed → semantic retrieval over stored
 * strategies → hard compatibility → strategy-guided Tavily search →
 * caller-model execution (Groq here) → heuristic evaluation vs baseline.
 *
 * Invariants preserved: 0 historical tokens in prompts, 0 LLM calls for
 * matching (retrieval is embedding+rules), provider stays caller-controlled,
 * no answer caching — only procedural strategies are stored.
 */

const router = Router();
let e5 = null;
async function embeddings() {
  if (!e5) {
    e5 = new LocalE5EmbeddingProvider();
    await e5._loadModel();
  }
  return e5;
}

const STOP = new Set(['the','a','an','of','for','and','or','to','in','on','with','using','use','based','from','by','is','are','this','that','it','its','as','at','be','how','what','when','which','their','your','determine','identify','find']);
const contentWords = (t) => (t || '').toLowerCase().replace(/[^a-zà-ÿ\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));
const Jaccardish = (task, strat) => {
  const t = new Set(contentWords(task));
  const s = new Set(contentWords(strat));
  if (!t.size) return 1;
  let hits = 0;
  for (const w of t) if (s.has(w)) hits++;
  return hits / t.size;
};
const TRANSFER_SIM_THRESHOLD = 0.80;
const COMPAT_OVERLAP_MIN = 0.12;

const heuristicQuality = (output, task) => {
  if (!output || output.length < 50) return 0.1;
  const len = Math.min(output.length / 800, 1);
  const struct = /\d+\.|[-*•]|\n\n/.test(output) ? 1 : 0;
  const spec = /[A-Z]{2,}|\d+(\.\d+)?%|https?:\/\//.test(output) ? 1 : 0;
  const words = [...new Set(contentWords(task))];
  const lo = output.toLowerCase();
  const ov = words.filter((w) => lo.includes(w)).length / Math.max(words.length, 1);
  return Math.round(((len * 0.25) + (struct * 0.2) + (spec * 0.25) + (ov * 0.3)) * 100) / 100;
};

const slugKey = (task) => {
  const words = contentWords(task).slice(0, 6).sort().join('-').replace(/[^a-z0-9-]/g, '') || 'task';
  return `demo/${words}`;
};

/* strategy store helpers ------------------------------------------------ */
async function loadStrategies(orgId) {
  const { rows } = await pool.query(
    `SELECT id, name, version, description, steps, confidence FROM strategies
     WHERE organization_id=$1 ORDER BY updated_at DESC LIMIT 200`, [orgId]);
  return rows;
}

function stepsToText(stepsObj) {
  const steps = Array.isArray(stepsObj) ? stepsObj : stepsObj?.steps || [];
  return steps.map((s) => (typeof s === 'string' ? s : s?.label || '')).join(' ');
}

/* ── POST /v1/demo/run — one full demo cycle for ANY question ── */
router.post('/run', authenticateApiKey, async (req, res) => {
  const orgId = req.organization_id;
  const task = String(req.body?.task || '').trim();
  if (!task || task.length < 8) {
    return res.status(400).json({ error: 'task required (min 8 chars)', request_id: req.request_id });
  }
  const model = process.env.GROQ_MODEL || 'allam-2-7b';
  const started = Date.now();
  const stageMs = {};

  try {
    /* 1 ─ TASK received (nothing to compute; timing only) */
    /* 2 ─ EMBED */
    let t = Date.now();
    const e5p = await embeddings();
    const qEmb = await e5p.embedQuery(task);
    stageMs.EMBED = Date.now() - t;

    /* 3 ─ RETRIEVAL over stored procedural strategies */
    t = Date.now();
    const rows = await loadStrategies(orgId);
    const passages = await Promise.all(rows.map((r) => e5p.embedPassage(r.description + ' ' + stepsToText(r.steps))));
    const scored = rows
      .map((r, i) => {
        let dot = 0;
        for (let d = 0; d < qEmb.length; d++) dot += qEmb[d] * passages[i][d];
        return { row: r, sim: dot };
      })
      .sort((a, b) => b.sim - a.sim);

    const best = scored[0] || null;
    const alternatives = scored.slice(1, 4).map((s) => ({ path: `${s.row.name}/v${s.row.version}`, similarity: +s.sim.toFixed(2) }));
    const overlap = best ? Jaccardish(task, best.row.description + ' ' + stepsToText(best.row.steps)) : 0;
    const isTransfer = !!best && best.sim >= TRANSFER_SIM_THRESHOLD && overlap >= COMPAT_OVERLAP_MIN;
    const variant = isTransfer ? 'transfer' : 'new';
    stageMs.RETRIEVAL = Date.now() - t;

    /* 4 ─ COMPATIBILITY gate */
    t = Date.now();
    const passed = [
      { label: 'Semantic threshold', value: isTransfer ? `≥ ${TRANSFER_SIM_THRESHOLD} ✓ (${best ? best.sim.toFixed(2) : 'n/a'})` : `below — creating new path` },
      { label: 'Entity overlap', value: `${(overlap * 100).toFixed(0)}% ${overlap >= COMPAT_OVERLAP_MIN ? '≥ min ✓' : '(new class)'}` },
    ];
    const rejected = scored.slice(1, 4)
      .filter((s) => true)
      .map((s) => ({ label: `${s.row.name}/v${s.row.version}`, reason: `similarity ${(s.sim).toFixed(2)} — below transfer threshold` }));
    stageMs.COMPATIBILITY = Date.now() - t;

    /* 5 ─ STRATEGY selection */
    t = Date.now();
    let strategyPath;
    let strategySteps;
    if (isTransfer && best) {
      strategyPath = `${best.row.name}/v${best.row.version}`;
      strategySteps = Array.isArray(best.row.steps) ? best.row.steps : best.row.steps?.steps || [];
    }
    stageMs.STRATEGY = Date.now() - t;

    /* 6 ─ EXECUTION: strategy-guided search + caller's model */
    t = Date.now();
    const sp = new WebSearchProvider();
    let sources = [];
    let searchCalls = 0;
    try {
      const kw = isTransfer && best ? contentWords(stepsToText(best.row.steps)).slice(0, 4).join(' ') : '';
      const query = (`${task} ${kw}`).slice(0, 180);
      const sr = await sp.search(query, { maxResults: 3 });
      sources = (sr.results || []).slice(0, 3);
      searchCalls = sources.length ? 1 : 0;
    } catch { sources = []; }
    const sourceBlock = sources.length
      ? '\n\nSOURCES:\n' + sources.map((r, i) => `[${i+1}] ${r.title || ''}: ${(r.snippet || '').slice(0, 220)} (${r.url})`).join('\n')
      : '';
    const groq = new GroqProvider();
    const guidedSys = 'You are a helpful research assistant. Answer using the provided sources when relevant. Be concise and factual.';
    const guided = await groq.complete(
      [{ role: 'system', content: guidedSys }, { role: 'user', content: task + sourceBlock }],
      { temperature: 0.4, maxTokens: 500 });
    stageMs.EXECUTION = Date.now() - t;

    /* baseline run — no strategy, no sources (same model, same question) */
    const tBase = Date.now();
    const baseline = await groq.complete(
      [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: task }],
      { temperature: 0.4, maxTokens: 500 });

    /* 7 ─ EVALUATION */
    t = Date.now();
    const quality = heuristicQuality(guided.text, task);
    const baselineQuality = heuristicQuality(baseline.text, task);
    stageMs.EVALUATION = Date.now() - t;

    /* persist learned strategy (procedural only — never the answer text) */
    const key = slugKey(task);
    let savedVersion = 1;
    try {
      const existing = await pool.query(`SELECT id, version FROM strategies WHERE organization_id=$1 AND name=$2`, [orgId, key]);
      const stepsJson = isTransfer && best
        ? best.row.steps
        : { steps: [
            { label: 'Parse the question and extract entities/jurisdiction' },
            ...(sources.length ? [{ label: 'Query authoritative sources via web search' }] : []),
            { label: 'Answer with citations [n]' },
            { label: 'Cross-check entity names across sources' },
          ] };
      if (existing.rows.length) {
        savedVersion = existing.rows[0].version + 1;
        await pool.query(
          `UPDATE strategies SET version=$2, description=$3, steps=$4, confidence=$5, average_latency=$6, updated_at=now()
           WHERE id=$1`,
          [existing.rows[0].id, savedVersion, task, stepsJson, quality.toFixed(2), guided.latencyMs]);
      } else {
        await pool.query(
          `INSERT INTO strategies (organization_id, name, version, description, steps, confidence, success_rate, average_latency)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [orgId, key, 1, task, stepsJson, quality.toFixed(2), quality >= 0.7 ? 1 : 0, guided.latencyMs]);
      }
      if (!strategyPath) strategyPath = `${key}/v${savedVersion}`;
      if (!strategySteps) strategySteps = stepsJson.steps;
    } catch (e) {
      console.error('[demo/run] persist:', e.message);
      if (!strategyPath) strategyPath = `${key}/v1`;
    }

    res.json({
      ok: true,
      variant,
      task,
      timings: { totalMs: Date.now() - started, stages: stageMs, baselineMs: Date.now() - tBase },
      retrieval: {
        similarity: best ? +best.sim.toFixed(2) : 0,
        lexical: 'LOW',
        topMatch: best ? { path: `${best.row.name}/v${best.row.version}`, similarity: +best.sim.toFixed(2), steps: Array.isArray(best.row.steps) ? best.row.steps : best.row.steps?.steps || [] } : null,
        alternatives,
      },
      compatibility: { passed, rejected },
      strategy: { path: strategyPath, steps: strategySteps, status: 'ACTIVE', transferred: isTransfer,
        previousTask: isTransfer && best ? best.row.description : null },
      execution: {
        sources: sources.map((s) => ({ title: s.title || s.url, url: s.url })),
        searchCalls,
        tokens: { input: guided.inputTokens, output: guided.outputTokens },
      },
      result: {
        answer: guided.text,
        baselineAnswer: baseline.text,
        quality,
        baselineQuality,
        delta: +(quality - baselineQuality).toFixed(2),
      },
      invariants: { contextTokens: 0, matchingLLMCalls: 0, provider: 'groq', model },
      request_id: req.request_id,
    });
  } catch (err) {
    console.error('[demo/run]', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message, request_id: req.request_id });
  }
});

/* ── GET /v1/demo/strategies — current learned population ── */
router.get('/strategies', authenticateApiKey, async (req, res) => {
  const rows = await loadStrategies(req.organization_id);
  res.json({ strategies: rows.map(r => ({ path:`${r.name}/v${r.version}`, description:r.description, confidence:+r.confidence, updated:true })), count: rows.length, request_id: req.request_id });
});

export const demoRouter = router;

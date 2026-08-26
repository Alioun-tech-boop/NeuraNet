/* ─────────────────────────────────────────────────────────────────────────────
   NeuraNet demo data layer — single source of truth for the UI.

   Everything the UI renders flows through this file. To connect a real API,
   replace the bodies of `api.*` with fetch calls; component contracts and
   shapes stay identical. No values are hardcoded inside components.

   Benchmark numbers below are the real measured results from
   experiments/final_validation (n=45, bootstrap B=5000, seed 42).
   ───────────────────────────────────────────────────────────────────────────── */

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export const WORKSPACE = { name: 'Demo', environment: 'Production' };

export const PROVIDERS = [
  { id: 'groq', label: 'Groq', models: ['allam-2-7b', 'gpt-oss-20b'] },
  { id: 'openrouter', label: 'OpenRouter', models: ['meta-llama/llama-3.3-70b-instruct'] },
];

/* ── Top-level metrics (Overview) ── */
export const METRICS = {
  strategies: 147,
  successfulPaths: 89,
  semanticReuse: 71, // %
  llmMatchingCalls: 0,
};

/* ── Demo tasks: deliberately different wording, same underlying problem ── */
export const DEMO_TASKS = {
  first: {
    id: 'task-1',
    text: 'Identify the banking regulator of Ghana and verify it using official sources.',
    shortLabel: 'Banking regulator of Ghana…',
  },
  second: {
    id: 'task-2',
    text: 'Determine which institution supervises banking establishments operating in Ghana.',
    shortLabel: 'Institution supervising banking establishments…',
  },
};

/* ── Execution pipeline stages. `detail` resolved per task variant at runtime ── */
export const PIPELINE_STAGES = ['TASK', 'EMBED', 'RETRIEVAL', 'COMPATIBILITY', 'STRATEGY', 'EXECUTION', 'EVALUATION'];

export function stageDetail(stageId, variant /* 'first' | 'second' */) {
  const isNew = variant === 'first';
  const map = {
    TASK: { ok: true, lines: ['Received'] },
    EMBED: { ok: true, lines: ['E5 · multilingual-e5-small', '384 dimensions', '18 ms'] },
    RETRIEVAL: isNew
      ? { ok: true, lines: ['No compatible strategy above threshold', 'novel problem class'] }
      : { ok: true, lines: [{ key: 'similarity', value: 0.89 }, 'pgvector · cosine'] },
    COMPATIBILITY: isNew
      ? { ok: true, lines: ['Jurisdiction: Ghana ✓', 'Domain: Banking ✓'] }
      : { ok: true, lines: ['Ghana ✓', 'Banking ✓', 'Regulatory research ✓', 'Polarity: compatible ✓'] },
    STRATEGY: isNew
      ? { ok: true, lines: [{ tag: 'NEW PATH' }, 'research/ghana-regulator/v1'] }
      : { ok: true, lines: [{ tag: 'TRANSFERRED' }, 'research/ghana-regulator/v1'] },
    EXECUTION: { ok: true, lines: [isNew ? '3 sources verified' : '2 sources verified', isNew ? 'cross-check + official portal' : 'official supervision registry'] },
    EVALUATION: { ok: true, lines: [{ key: 'quality', value: isNew ? 0.86 : 0.91 }] },
  };
  return map[stageId];
}

/* ── Retrieval visualization ── */
export const RETRIEVAL = {
  embedding: { model: 'E5', dims: 384 },
  store: 'pgvector',
  topMatch: { path: 'research/ghana-regulator/v1', similarity: 0.89 },
  alternatives: [
    { path: 'financial-analysis/v3', similarity: 0.41 },
    { path: 'generic-web-search/v2', similarity: 0.36 },
    { path: 'code-verification/v1', similarity: 0.19 },
  ],
  lexicalSimilarity: 'LOW',
};

/* ── Hard compatibility filter (semantic score alone never transfers) ── */
export const COMPATIBILITY = {
  passed: [
    { label: 'Jurisdiction', value: 'Ghana' },
    { label: 'Domain', value: 'Banking' },
    { label: 'Task class', value: 'Regulatory research' },
    { label: 'Polarity', value: 'compatible' },
  ],
  rejected: [
    { label: 'Securities trading', reason: 'different task class' },
    { label: 'Kenya banking', reason: 'jurisdiction mismatch' },
    { label: 'Software security', reason: 'workflow mismatch' },
  ],
};

/* ── Strategy population ── */
export const STRATEGIES = [
  {
    id: 's1',
    path: 'research/ghana-regulator/v1',
    status: 'ACTIVE',
    quality: 0.88,
    executions: 12,
    reuse: 7,
    successRate: 0.917,
    created: 'Aug 2026',
    steps: [
      { id: 'st1', label: 'Research official regulator' },
      { id: 'st2', label: 'Cross-check independent source' },
      { id: 'st3', label: 'Verify official authority' },
    ],
    history: [
      { version: 'v1', date: 'Aug 12, 2026', note: 'initial discovery from Task A' },
      { version: 'v2', date: 'Aug 14, 2026', note: 'cross-check step added after evaluation' },
      { version: 'v3', date: 'Aug 21, 2026', note: 'official-source verification enforced' },
    ],
  },
  {
    id: 's2',
    path: 'research/deep-verify/v3',
    status: 'ACTIVE',
    quality: 0.93,
    executions: 31,
    reuse: 19,
    successRate: 0.94,
    created: 'Jul 2026',
    steps: [
      { id: 'st1', label: 'Decompose question' },
      { id: 'st2', label: 'Query primary sources' },
      { id: 'st3', label: 'Triangulate 3 sources' },
      { id: 'st4', label: 'Verify jurisdiction fit' },
    ],
    history: [
      { version: 'v1', date: 'Jul 02, 2026', note: 'seeded from manual run' },
      { version: 'v2', date: 'Jul 19, 2026', note: 'triangulation widened to 3 sources' },
      { version: 'v3', date: 'Aug 09, 2026', note: 'jurisdiction gate added' },
    ],
  },
  {
    id: 's3',
    path: 'code-verification/v1',
    status: 'ACTIVE',
    quality: 0.81,
    executions: 22,
    reuse: 4,
    successRate: 0.86,
    created: 'Jun 2026',
    steps: [
      { id: 'st1', label: 'Reproduce locally' },
      { id: 'st2', label: 'Add regression test' },
    ],
    history: [{ version: 'v1', date: 'Jun 11, 2026', note: 'discovered from CI failure loop' }],
  },
  { id: 's4', path: 'financial-analysis/v3', status: 'DOMINATED', quality: 0.74, executions: 9, reuse: 0, successRate: 0.7, created: 'May 2026',
    steps: [{ id: 'st1', label: 'Pull filings' }], history: [] },
  { id: 's5', path: 'generic-web-search/v2', status: 'DOMINATED', quality: 0.61, executions: 17, reuse: 0, successRate: 0.62, created: 'Apr 2026',
    steps: [{ id: 'st1', label: 'Search web' }], history: [] },
];

/* ── Pareto frontier points (cost vs quality) ── */
export const PARETO = {
  frontier: [
    { cost: 0.002, quality: 0.79, path: 'generic-web-search/v2' },
    { cost: 0.003, quality: 0.86, path: 'research/ghana-regulator/v1' },
    { cost: 0.006, quality: 0.93, path: 'research/deep-verify/v3' },
  ],
  dominated: [
    { cost: 0.004, quality: 0.74, path: 'financial-analysis/v3' },
    { cost: 0.007, quality: 0.61, path: 'legacy-manual/v1' },
    { cost: 0.009, quality: 0.71, path: 'multi-agent-brute/v2' },
    { cost: 0.005, quality: 0.58, path: 'single-shot/v1' },
  ],
};

/* ── Experience graph ── */
export const EXPERIENCE_GRAPH = {
  workflow: { id: 'wf-reg', label: 'Regulatory Research', kind: 'workflow' },
  strategy: STRATEGIES[0],
  tasks: [
    { id: 'ta', label: 'Task A', sub: 'banking regulator of Ghana', kind: 'task' },
    { id: 'tb', label: 'Task B', sub: 'institution supervising banks', kind: 'task' },
    { id: 'tc', label: 'Task C', sub: 'central bank license registry', kind: 'task' },
  ],
  transferNode: { id: 'xfer', label: 'Semantic Transfer', kind: 'transfer' },
};

/* ── Result panel (second task) ── */
export const RESULT = {
  answer: 'Bank of Ghana',
  verification: ['Official source', 'Cross-checked', 'Relevant jurisdiction'],
  sources: [{ title: 'Bank of Ghana', detail: 'Official regulatory documentation — bog.gov.gh' }],
  quality: 0.91,
  baselineDelta: '+0.05',
};

/* ── Invariants exposed in the UI ── */
export const INVARIANTS = [
  { id: 'ctx', label: 'CONTEXT INJECTION', value: '0 TOKENS', note: 'NeuraNet does not inject historical task context into the LLM prompt.' },
  { id: 'match', label: 'MATCHING', value: '0 LLM CALLS', note: 'Semantic retrieval and strategy selection happen outside the model.' },
];

/* ── Benchmarks — real measured numbers ── */
export const BENCHMARKS = {
  retrieval: {
    e5: { mrr: 0.793 },
    trgm: { mrr: 0.637 },
    improvement: '+25%',
  },
  transfer: {
    baseline: 0.852,
    shuffled: 0.799,
    neuranet: 0.911,
    lift: { mean: 0.059, ci: [0.013, 0.111] },
    relevance: { mean: 0.053, ci: [0.002, 0.116] },
    n: 45,
    bootstrapB: 5000,
    negativeTransferRate: 0.133,
  },
  providers: [
    { provider: 'Groq', model: 'allam-2-7b', lift: '+0.059', ci: '[+0.013, +0.111]', significant: true },
    { provider: 'Groq', model: 'gpt-oss-20b', lift: '−0.039', ci: '[−0.114, +0.035]', significant: false },
  ],
};

/* ── Simulated execution timings per stage (ms) — tuned for a 3-minute demo ── */
export const STAGE_TIMINGS = { TASK: 350, EMBED: 550, RETRIEVAL: 800, COMPATIBILITY: 500, STRATEGY: 650, EXECUTION: 950, EVALUATION: 700 };

/* ─────────────────────────────────────────────────────────────────────────────
   API-shaped adapters — swap these bodies with real fetch calls later.
   ───────────────────────────────────────────────────────────────────────────── */

/** Live backend call: arbitrary question through the real pipeline.
 *  API key/base resolution order: localStorage (Settings) → build-time env
 *  (.env.local, gitignored) → empty. Falls back to the scripted mock when
 *  the API is unreachable, so the recorded demo never breaks. */
const ENV_KEY = import.meta.env?.VITE_NEURANET_API_KEY || '';
const ENV_BASE = import.meta.env?.VITE_API_BASE || '';

export function getApiKey() {
  return localStorage.getItem('nn_api_key') || ENV_KEY;
}
export function getApiBase() {
  // legacy cleanup: the console is same-origin now; drop stale absolute bases
  const stored = localStorage.getItem('nn_api_base');
  if (stored && /localhost:3000/.test(stored)) {
    localStorage.removeItem('nn_api_base');
    return ENV_BASE ?? '';
  }
  return stored ?? ENV_BASE;
}

/** Transport = official @neuranet/sdk (aliased to ../../sdk by Vite),
 *  same-origin through the /v1 proxy. Falls back to the scripted mock
 *  when unreachable, so a recorded demo never breaks. */
export async function runLive(task) {
  try {
    const { default: NeuraNet } = await import('@neuranet/sdk');
    const client = new NeuraNet({ apiKey: getApiKey(), baseUrl: getApiBase() || undefined });
    const j = await client.demo.run(task);
    return { ...j, live: true };
  } catch {
    return { ...(await api.runExecution(task.includes('supervises') || task.includes('institution') ? 'second' : 'first')), live: false };
  }
}

export const api = {
  async getMetrics() {
    await delay(120);
    return METRICS;
  },
  async getStrategies() {
    await delay(120);
    return STRATEGIES;
  },
  async getBenchmarks() {
    await delay(120);
    return BENCHMARKS;
  },
  /** Runs one demo execution; resolves stage callbacks as the pipeline advances. */
  async runExecution(variant, { onStage } = {}) {
    let acc = 0;
    for (const stage of PIPELINE_STAGES) {
      acc += STAGE_TIMINGS[stage];
      await delay(STAGE_TIMINGS[stage]);
      onStage?.(stage, stageDetail(stage, variant), acc);
    }
    return variant === 'first'
      ? { newPath: STRATEGIES[0], result: null }
      : { newPath: null, result: RESULT };
  },
};

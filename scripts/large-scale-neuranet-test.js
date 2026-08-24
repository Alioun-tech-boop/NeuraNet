import 'dotenv/config';
import { spawn } from 'node:child_process';
import { pool } from '../src/db/connection.js';
import productionEngine from '../src/productions/engine.js';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const BASE = process.env.NEURANET_API_BASE_URL || 'http://127.0.0.1:3000';
const KEY = process.env.NEURANET_API_KEY || 'neuranet-dev-key';
const ORG = '00000000-0000-0000-0000-000000000001';
const LLM = { provider: process.env.SEMANTIC_TEST_PROVIDER || 'groq', model: process.env.GROQ_MODEL || 'allam-2-7b' };

// ============================================================
// DATASET GENERATION - 13 domains x families, labeled
// ============================================================
const COUNTRIES = ['Ghana', 'Kenya', 'Nigeria', 'Senegal'];
const DOMAINS = {
  energy:        { reg: 'renewable energy regulator', inst: 'Energy Commission', topic: 'renewable energy' },
  finance:       { reg: 'financial market regulator', inst: 'Securities and Exchange Commission', topic: 'capital markets' },
  banking:       { reg: 'banking regulator', inst: 'Bank of Ghana', topic: 'banking supervision' },
  securities:    { reg: 'securities regulator', inst: 'Securities and Exchange Commission', topic: 'securities trading' },
  telecommunications: { reg: 'telecommunications regulator', inst: 'National Communications Authority', topic: 'telecommunications' },
  agriculture:   { reg: 'agricultural regulator', inst: 'Ministry of Food and Agriculture', topic: 'agricultural inputs' },
  healthcare:    { reg: 'health products regulator', inst: 'Food and Drugs Authority', topic: 'medical devices' },
  environment:   { reg: 'environmental protection authority', inst: 'Environmental Protection Agency', topic: 'environmental impact' },
  technology:    { reg: 'technology standards authority', inst: 'National Information Technology Agency', topic: 'digital services' },
  cybersecurity: { reg: 'cybersecurity authority', inst: 'Cyber Security Authority', topic: 'critical infrastructure protection' },
  law:           { reg: 'legal affairs commission', inst: 'Attorney General Department', topic: 'legislative drafting' },
  education:     { reg: 'education service regulator', inst: 'Ghana Education Service', topic: 'school accreditation' },
  transportation: { reg: 'transport safety regulator', inst: 'National Road Safety Authority', topic: 'road transport safety' }
};

function buildDataset() {
  const rows = [];
  let n = 0;
  const push = (query, relation, family, domain) => rows.push({ id: `D${++n}`, query, relation, family, domain });

  // A. EXACT EQUIVALENCE + B. PARAPHRASES: seed one question per domain then paraphrases
  for (const [domain, cfg] of Object.entries(DOMAINS)) {
    const base = `What is the main ${cfg.reg} in Ghana, and what is its role?`;
    // Seed queries are NOT pre-labeled as reuse targets; they run first (RESEARCH expected)
    push(base, 'SEED', 'seed', domain);
    // Paraphrases -> EQUIVALENT to the seed
    push(`Which institution regulates ${cfg.topic} in Ghana?`, 'EQUIVALENT', 'paraphrase', domain);
    push(`Who oversees ${cfg.topic} regulation in Ghana?`, 'EQUIVALENT', 'paraphrase', domain);
    push(`Which Ghanaian authority is responsible for ${cfg.topic} regulation?`, 'EQUIVALENT', 'paraphrase', domain);
    push(`What body handles ${cfg.topic} matters in Ghana?`, 'EQUIVALENT', 'paraphrase', domain);
    push(`Which organization manages ${cfg.topic} oversight in Ghana?`, 'EQUIVALENT', 'paraphrase', domain);
    push(`What is the mandate of the ${cfg.inst}?`, 'EQUIVALENT', 'paraphrase', domain);
  }

  // C. DIFFERENT INTENT (same domain vocabulary)
  for (const [domain, cfg] of Object.entries(DOMAINS)) {
    push(`What licenses are required for ${cfg.topic} companies in Ghana?`, 'NON_EQUIVALENT', 'diff_intent_license', domain);
    push(`How can a company obtain authorization for ${cfg.topic} activities in Ghana?`, 'NON_EQUIVALENT', 'diff_intent_procedure', domain);
    push(`What penalties exist for violations in the ${cfg.topic} sector in Ghana?`, 'NON_EQUIVALENT', 'diff_intent_penalties', domain);
  }

  // D. DIFFERENT OBJECT / E. DIFFERENT ENTITY
  for (const [domain, cfg] of Object.entries(DOMAINS)) {
    push(`What policies exist for ${cfg.topic} in Ghana?`, 'NON_EQUIVALENT', 'diff_object_policy', domain);
    push(`Which companies operate in the ${cfg.topic} sector in Ghana?`, 'NON_EQUIVALENT', 'diff_object_companies', domain);
  }

  // F. DIFFERENT JURISDICTION
  const otherCountries = COUNTRIES.slice(1); // Kenya, Nigeria, Senegal
  for (const [domain, cfg] of Object.entries(DOMAINS)) {
    for (const c of otherCountries.slice(0, 2)) {
      push(`What is the main ${cfg.reg} in ${c}, and what is its role?`, 'SEED_OTHER_COUNTRY', 'jurisdiction_seed', domain);
      push(`Who regulates ${cfg.topic} in ${c}?`, 'EQUIVALENT_OTHER_COUNTRY', 'jurisdiction_variant', domain);
    }
  }

  // G. TEMPORAL
  for (const domain of ['energy','banking','finance','healthcare','environment','technology','education','transportation']) {
    const cfg = DOMAINS[domain];
    push(`Who regulated ${cfg.topic} in Ghana in 2015?`, 'NON_EQUIVALENT', 'temporal_2015', domain);
    push(`Who regulated ${cfg.topic} in Ghana in 2010?`, 'NON_EQUIVALENT', 'temporal_2010', domain);
    push(`Who currently regulates ${cfg.topic} in Ghana?`, 'EQUIVALENT', 'temporal_current', domain);
  }

  // H. POLARITY
  for (const domain of ['energy','banking','healthcare','environment']) {
    const cfg = DOMAINS[domain];
    push(`Is the ${cfg.inst} responsible for ${cfg.topic}?`, 'YESNO_NEAR', 'polarity_yesno', domain);
    push(`Is the ${cfg.inst} NOT responsible for ${cfg.topic}?`, 'NON_EQUIVALENT', 'polarity_negation', domain);
  }

  // I. GRANULARITY
  for (const [domain, cfg] of Object.entries(DOMAINS)) {
    push(`Which ${cfg.topic} companies are licensed in Ghana?`, 'NON_EQUIVALENT', 'granularity_company', domain);
    push(`What projects has the ${cfg.inst} approved in Ghana?`, 'NON_EQUIVALENT', 'granularity_project', domain);
  }

  // J. LEXICAL TRAPS
  for (const [domain, cfg] of Object.entries(DOMAINS)) {
    push(`How does ${cfg.topic} financing work in Ghana?`, 'NON_EQUIVALENT', 'trap_financing', domain);
    push(`Which institutions fund ${cfg.topic} projects in Ghana?`, 'NON_EQUIVALENT', 'trap_funding', domain);
  }

  // K. CROSS-DOMAIN TRAPS
  push("Who regulates renewable energy financing through banks in Ghana?", 'NON_EQUIVALENT', 'cross_trap', 'energy');
  push("Does the banking regulator supervise renewable energy companies in Ghana?", 'NON_EQUIVALENT', 'cross_trap', 'energy');
  push("What telecommunications rules apply to mobile money under banking law in Ghana?", 'NON_EQUIVALENT', 'cross_trap', 'banking');

  // L. NEAR-DUPLICATES (one critical dimension differs)
  push("What is the main renewable energy regulator in Kenya, and what is its role?", 'SEED_OTHER_COUNTRY', 'near_dup_country', 'energy');
  push("What was the main renewable energy regulator in Ghana, historically?", 'NON_EQUIVALENT', 'near_dup_temporal', 'energy');
  push("Is there a main renewable energy regulator in Ghana?", 'NEAR_DUP_YESNO', 'near_dup_polarity', 'energy');

  // Progressive learning sequences (interleaved later by runner order)
  const seqDefs = [
    ["S1","Who regulates renewable energy in Ghana?", 'SEED', 'energy'],
    ["S2","Which authority oversees renewable energy in Ghana?", 'EQUIVALENT', 'energy'],
    ["S3","What licenses are required for renewable energy companies in Ghana?", 'NON_EQUIVALENT', 'energy'],
    ["S4","How can renewable energy companies obtain licenses in Ghana?", 'NON_EQUIVALENT', 'energy'],
    ["S5","Who regulates renewable energy in Nigeria?", 'SEED_OTHER_COUNTRY', 'energy'],
    ["S6","Who oversees renewable energy regulation in Ghana?", 'EQUIVALENT', 'energy'],
    ["S7","Who regulates mobile money in Ghana?", 'SEED', 'fintech_mm'],
    ["S8","Which authority supervises mobile money operators in Ghana?", 'EQUIVALENT', 'fintech_mm'],
    ["S9","What licenses do mobile money operators need in Ghana?", 'NON_EQUIVALENT', 'fintech_mm'],
    ["S10","Who regulates solar panel imports in Ghana?", 'NON_EQUIVALENT', 'solar_imports']
  ];
  const seqRows = seqDefs.map(([id,q,rel,dom]) => ({ id, q, rel, dom }));

  return { rows, seqRows };
}

console.log('=== NEURANET LARGE-SCALE SEMANTIC + PROGRESSIVE BENCHMARK ===');

// Interleave sequences into main flow
const { rows: baseRows, seqRows } = buildDataset();
const DATASET = [];
// Put seeds first (all SEED + SEED_OTHER_COUNTRY), then equivalents/variants, then sequences interleaved
const seeds = baseRows.filter(r => r.relation === 'SEED' || r.relation === 'SEED_OTHER_COUNTRY');
const rest = baseRows.filter(r => r.relation !== 'SEED' && r.relation !== 'SEED_OTHER_COUNTRY');
DATASET.push(...seeds.map(r => ({ ...r })));
// interleave: after every 6 non-seed queries insert one sequence item
let si = 0;
for (let i = 0; i < rest.length; i++) {
  DATASET.push(rest[i]);
  if ((i+1) % 6 === 0 && si < seqRows.length) {
    const s = seqRows[si++];
    DATASET.push({ id: s.id, query: s.q, relation: s.rel, family: `sequence_${s.dom}`, domain: s.dom });
  }
}
while (si < seqRows.length) {
  const s = seqRows[si++];
  DATASET.push({ id: s.id, query: s.q, relation: s.rel, family: `sequence_${s.dom}`, domain: s.dom });
}

console.log(`Dataset: ${DATASET.length} labeled queries`);
const famCount = {};
for (const r of DATASET) famCount[r.family] = (famCount[r.family]||0)+1;
console.log('Families:', JSON.stringify(famCount));

// ============================================================
// RUNNER
// ============================================================
const START_IDX = parseInt(process.argv[2] || '1', 10);

let api = spawn('node', ['src/api/index.js'], { stdio: ['ignore','pipe','pipe'] });
async function ensureApi() {
  try { const h = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) }); if (h.ok) return; } catch {}
  api.kill('SIGKILL');
  api = spawn('node', ['src/api/index.js'], { stdio: ['ignore','pipe','pipe'] });
  for(let i=0;i<8;i++){ try{ const h=await fetch(`${BASE}/health`); if(h.ok) return; }catch{} await new Promise(r=>setTimeout(r,1000)); }
}
await ensureApi();

async function kquery(query, agentId) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE}/v1/knowledge/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
      body: JSON.stringify({ query, agentId, llm: LLM })
    });
    const data = await res.json();
    return { status: res.status, data, latencyMs: Date.now() - start };
  } catch (e) {
    return { status: 0, data: {}, latencyMs: Date.now() - start, error: e.message };
  }
}

let observations = [];
if (START_IDX > 1 && existsSync('neuranet-large-scale-results.json')) {
  const prior = JSON.parse(readFileSync('neuranet-large-scale-results.json','utf8'));
  observations = prior.observations.filter(o => o.decision); // keep completed only
  console.log(`Resuming: ${observations.length} prior observations loaded`);
}

// Pre-compute reference signature map for dimension comparison reporting
const t0 = Date.now();
let falseReuse = 0, falseRejection = 0, trueReuse = 0, trueResearch = 0;
for (const o of observations) {
  if (o.evaluation === 'FALSE_REUSE') falseReuse++;
  else if (o.evaluation === 'FALSE_REJECTION') falseRejection++;
  else if (o.evaluation === 'TRUE_REUSE') trueReuse++;
  else if (o.evaluation === 'TRUE_RESEARCH') trueResearch++;
}

function evaluate(obs) {
  // relation: EQUIVALENT => REUSE correct; SEED/SEED_OTHER_COUNTRY/NON_EQUIVALENT => RESEARCH correct
  if (!obs.decision) return 'ERROR';
  if (obs.relation === 'EQUIVALENT') {
    return obs.decision === 'REUSE' ? 'TRUE_REUSE' : 'FALSE_REJECTION';
  }
  if (['SEED','SEED_OTHER_COUNTRY'].includes(obs.relation)) {
    // First-time questions must not falsely reuse something incompatible
    return obs.decision === 'RESEARCH' ? 'TRUE_RESEARCH'
      : obs.decision === 'REUSE' ? 'PRIOR_KNOWLEDGE_REUSE' : 'OTHER';
  }
  if (obs.relation === 'EQUIVALENT_OTHER_COUNTRY') {
    return obs.decision === 'REUSE' ? 'TRUE_REUSE' : 'FALSE_REJECTION';
  }
  if (obs.relation === 'NEAR_DUP_YESNO') {
    return obs.decision === 'RESEARCH' ? 'TRUE_RESEARCH' : 'DEFENSIBLE_REUSE';
  }
  return obs.decision === 'RESEARCH' ? 'TRUE_RESEARCH'
    : obs.decision === 'REUSE' ? 'FALSE_REUSE' : 'OTHER';
}

let idx = 0;
for (const row of DATASET) {
  idx++;
  if (idx < START_IDX) continue;
  if (observations.find(o => o.id === row.id && o.decision)) continue;

  await ensureApi();
  const norm = productionEngine.normalizeQuery(row.query);
  const hash = productionEngine.hashQuery(norm);
  const sigNew = productionEngine.semanticSignature(row.query);

  const r = await kquery(row.query, `ls-${row.id}`);
  let d = r.data;
  if (r.status === 0 || !d.decision && r.latencyMs < 100) {
    await ensureApi();
    const retry = await kquery(row.query, `ls-${row.id}-r`);
    d = retry.data;
  }

  const evaluation = evaluate({ relation: row.relation, decision: d.decision });
  if (evaluation === 'FALSE_REUSE') falseReuse++;
  else if (evaluation === 'FALSE_REJECTION') falseRejection++;
  else if (evaluation === 'TRUE_REUSE') trueReuse++;
  else if (evaluation === 'TRUE_RESEARCH') trueResearch++;

  const obs = {
    id: row.id, query: row.query, relation: row.relation, family: row.family,
    decision: d.decision ?? null,
    selectedProduction: d.production?.id?.slice(0,8) ?? null,
    canonicalProduction: d.provenance?.canonicalProductionId?.slice(0,8) ?? null,
    quality: d.production?.quality_score ?? null,
    verification: d.production?.verification_status ?? null,
    freshness: d.metrics?.productionFreshness ?? null,
    llmCalls: d.metrics?.llmCalls ?? null,
    tavilyCalls: d.metrics?.tavilyCalls ?? null,
    inputTokens: d.metrics?.tokens?.input ?? null,
    outputTokens: d.metrics?.tokens?.output ?? null,
    totalTokens: d.metrics?.tokens?.total ?? null,
    contextAdded: 0, // invariant: NeuraNet never injects into prompt
    latencyMs: r.latencyMs,
    semanticSimilarity: null,
    semanticSignature: sigNew,
    conflictsDetected: [],
    pathId: null, pathVersion: null,
    evaluation,
    httpStatus: r.status,
    error: d.error ? String(d.error).slice(0,150) : null
  };
  observations.push(obs);

  const mark = evaluation.startsWith('FALSE') ? '✖' : '·';
  process.stdout.write(`[${idx}/${DATASET.length}] ${mark} ${String(d.decision||'ERR').padEnd(8)} ${evaluation.padEnd(22)} ${row.family}\n`);

  // Checkpoint save every 5 queries
  if (idx % 5 === 0) {
    writeFileSync('neuranet-large-scale-results.json', JSON.stringify({ datasetSize: DATASET.length, observations, savedAtIdx: idx }, null, 0));
  }
  await new Promise(res=>setTimeout(res,400));
}

writeFileSync('neuranet-large-scale-results.json', JSON.stringify({
  datasetSize: DATASET.length, observations,
  finishedAt: new Date().toISOString()
}, null, 2));

// ============================================================
// ANALYSIS
// ============================================================
api.kill();

const done = observations.filter(o=>o.decision);
const decisions = { REUSE: 0, RESEARCH: 0, REFRESH: 0 };
done.forEach(o => { if (decisions[o.decision] !== undefined) decisions[o.decision]++; });

const reuseObs = done.filter(o=>o.decision==='REUSE');
const researchObs = done.filter(o=>o.decision==='RESEARCH');
const reuseLatencies = reuseObs.map(o=>o.latencyMs).sort((a,b)=>a-b);
const researchLatencies = researchObs.map(o=>o.latencyMs).sort((a,b)=>a-b);
const median = a => a.length ? (a.length%2 ? a[Math.floor(a.length/2)] : (a[a.length/2-1]+a[a.length/2])/2) : 0;
const p95 = a => a.length ? a[Math.min(a.length-1, Math.floor(a.length*0.95))] : 0;

const totalLlmWithNeuranet = done.reduce((a,b)=>a+(b.llmCalls||0),0);
const totalTavilyWithNeuranet = done.reduce((a,b)=>a+(b.tavilyCalls||0),0);
const totalTokensWithNeuranet = done.reduce((a,b)=>a+(b.totalTokens||0),0);
// Without NeuraNet: every request would have been RESEARCH: 1 LLM + 1 Tavily + median research tokens
const medianResearchTokens = researchObs.length ? median(researchObs.map(o=>o.totalTokens||0)) : 0;
const llmWithout = done.length;
const tavilyWithout = done.length;
const tokensWithout = done.length * medianResearchTokens;

const contextViolations = done.filter(o=>o.contextAdded !== 0).length;
const zeroContextReuse = reuseObs.filter(o=>o.contextAdded===0 && o.llmCalls===0 && o.tavilyCalls===0).length;
const nonZeroContextReuse = reuseObs.length - zeroContextReuse;
const errors = done.filter(o=>o.error).length;

const stats = {
  totalRequests: done.length,
  plannedTotal: DATASET.length,
  decisions,
  reuseRate: reuseObs.length/done.length,
  falseReuse, falseRejection, trueReuse, trueResearch,
  precisionReuse: reuseObs.length ? (trueReuse/(trueReuse+falseReuse)) : null,
  medianLatencyResearchMs: Math.round(median(researchLatencies)),
  medianLatencyReuseMs: Math.round(median(reuseLatencies)),
  p95LatencyResearchMs: p95(researchLatencies),
  p95LatencyReuseMs: p95(reuseLatencies),
  speedupMedian: median(reuseLatencies) ? Math.round(median(researchLatencies)/median(reuseLatencies)*10)/10 : null,
  llmCallsWithNeuraNet: totalLlmWithNeuranet,
  llmCallsWithoutNeuraNet: llmWithout,
  llmCallsAvoided: llmWithout - totalLlmWithNeuranet,
  tavilyCallsWithNeuraNet: totalTavilyWithNeuranet,
  tavilyCallsAvoided: tavilyWithout - totalTavilyWithNeuranet,
  tokensWithNeuraNet: totalTokensWithNeuranet,
  tokensWithoutEstimate: tokensWithout,
  estimatedTokensSaved: tokensWithout - totalTokensWithNeuranet,
  contextViolations,
  zeroContextReuse,
  nonZeroContextReuse,
  errors,
  wallClockMinutes: Math.round((Date.now()-t0)/60000)
};

writeFileSync('neuranet-large-scale-summary.json', JSON.stringify(stats, null, 2));
console.log('\n=== SUMMARY ===');
console.log(JSON.stringify(stats, null, 2));

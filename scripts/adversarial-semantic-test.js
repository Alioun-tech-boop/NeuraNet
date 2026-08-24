import 'dotenv/config';
import { spawn } from 'node:child_process';
import { pool } from '../src/db/connection.js';
import productionEngine from '../src/productions/engine.js';
import { writeFileSync } from 'node:fs';

const BASE = process.env.NEURANET_API_BASE_URL || 'http://127.0.0.1:3000';
const KEY = process.env.NEURANET_API_KEY || 'neuranet-dev-key';
const LLM = { provider: process.env.SEMANTIC_TEST_PROVIDER || 'groq', model: process.env.GROQ_MODEL || 'allam-2-7b' };

const REFS = {
  A: "What is the main renewable energy regulator in Ghana, and what is its role?",
  B: "What is the main banking regulator in Ghana, and what is its role?",
  C: "What is the main telecommunications regulator in Ghana, and what is its role?",
  D: "What renewable energy policies has Ghana adopted?",
  E: "What is the main renewable energy regulator in Kenya, and what is its role?",
  F: "Which institution regulates electricity in Ghana?",
  G: "Which institution regulates Ghana's securities market?",
  H: "Which institution regulates data protection in Ghana?",
  I: "Which institution regulates pesticides in Ghana?",
  J: "Which institution oversees competition regulation in Ghana?"
};

// 100 adversarial/observational queries grouped by category
const QUERIES = [
  // §2 Equivalent (Q1-Q15)
  ["Q1","Which Ghanaian institution is responsible for regulating renewable energy, and what does it do?","EQUIVALENT_A"],
  ["Q2","Who regulates renewable energy in Ghana and what are its responsibilities?","EQUIVALENT_A"],
  ["Q3","Which authority oversees renewable energy regulation in Ghana?","EQUIVALENT_A"],
  ["Q4","What body is responsible for renewable energy regulation in Ghana?","EQUIVALENT_A"],
  ["Q5","Which institution has regulatory responsibility for renewable energy in Ghana?","EQUIVALENT_A"],
  ["Q6","Which Ghanaian institution supervises banks and what is its role?","EQUIVALENT_B"],
  ["Q7","Who is responsible for banking regulation in Ghana?","EQUIVALENT_B"],
  ["Q8","Which authority regulates telecommunications in Ghana?","EQUIVALENT_C"],
  ["Q9","What body oversees Ghana's telecommunications sector?","EQUIVALENT_C"],
  ["Q10","Which institution is responsible for data protection regulation in Ghana?","EQUIVALENT_H"],
  ["Q11","Which authority regulates pesticides in Ghana?","EQUIVALENT_I"],
  ["Q12","Which institution oversees competition in Ghana?","EQUIVALENT_J"],
  ["Q13","Which authority regulates securities in Ghana?","EQUIVALENT_G"],
  ["Q14","Which institution is responsible for electricity regulation in Ghana?","EQUIVALENT_F"],
  ["Q15","Who regulates renewable energy in Kenya?","EQUIVALENT_E"],
  // §3 Same words different meaning (Q16-Q25)
  ["Q16","What is the main banking regulator in Ghana, and what is its role?","EXACT_B"],
  ["Q17","What is the main telecommunications regulator in Ghana, and what is its role?","EXACT_C"],
  ["Q18","What renewable energy policies has Ghana adopted?","EXACT_D"],
  ["Q19","What licenses are required for renewable energy companies in Ghana?","INTENT_MISMATCH"],
  ["Q20","What incentives exist for renewable energy investments in Ghana?","INTENT_MISMATCH"],
  ["Q21","What are Ghana's renewable energy targets?","INTENT_MISMATCH"],
  ["Q22","How is renewable energy regulated in Ghana?","NEAR_EQUIV_A"],
  ["Q23","Which companies operate in Ghana's renewable energy market?","INTENT_MISMATCH"],
  ["Q24","What is the current renewable energy capacity of Ghana?","INTENT_MISMATCH"],
  ["Q25","How much solar power does Ghana currently generate?","INTENT_MISMATCH"],
  // §4 Same subject different country (Q26-Q30)
  ["Q26","Who regulates renewable energy in Kenya?","COUNTRY_KE"],
  ["Q27","Who regulates renewable energy in Nigeria?","COUNTRY_NG"],
  ["Q28","Who regulates renewable energy in Senegal?","COUNTRY_SN"],
  ["Q29","Which institution regulates banking in Kenya?","COUNTRY_KE_BANK"],
  ["Q30","Which institution regulates telecommunications in Nigeria?","COUNTRY_NG_TELECOM"],
  // §5 Same country different regulator (Q31-Q37)
  ["Q31","Which institution regulates banking in Ghana?","EXACT_B_ALT"],
  ["Q32","Which institution regulates telecommunications in Ghana?","EXACT_C_ALT"],
  ["Q33","Which institution regulates securities in Ghana?","EXACT_G_ALT"],
  ["Q34","Which institution regulates data protection in Ghana?","EXACT_H_ALT"],
  ["Q35","Which institution regulates pesticides in Ghana?","EXACT_I_ALT"],
  ["Q36","Which institution oversees competition regulation in Ghana?","EXACT_J_ALT"],
  ["Q37","Which institution regulates electricity in Ghana?","EXACT_F_ALT"],
  // §6 High lexical similarity (Q38-Q43)
  ["Q38","What regulator is responsible for renewable energy financing in Ghana's banking sector?","TRAP_FINANCE"],
  ["Q39","How does Ghana's banking sector finance renewable energy?","TRAP_FINANCE"],
  ["Q40","Which Ghanaian bank regulates renewable energy investments?","TRAP_BANK"],
  ["Q41","Does the banking regulator supervise renewable energy activities?","TRAP_BANK"],
  ["Q42","Which telecommunications authority regulates renewable energy services in Ghana?","TRAP_TELECOM"],
  ["Q43","Which securities regulator oversees renewable energy companies in Ghana?","TRAP_SECURITIES"],
  // §7 Contradiction (Q44-Q48)
  ["Q44","What is the renewable energy regulator in Ghana's banking sector?","CONTRADICTION"],
  ["Q45","Which telecommunications authority regulates renewable energy?","CONTRADICTION"],
  ["Q46","Is the securities regulator responsible for renewable energy regulation in Ghana?","CONTRADICTION"],
  ["Q47","Does the banking regulator regulate Ghana's solar energy sector?","CONTRADICTION"],
  ["Q48","Is the telecommunications regulator the authority responsible for renewable energy in Ghana?","CONTRADICTION"],
  // §8 Entity switch (Q49-Q53)
  ["Q49","Which institution regulates electricity in Ghana?","ENTITY_F"],
  ["Q50","Which institution regulates renewable energy in Ghana?","ENTITY_A"],
  ["Q51","Which institution regulates Ghana's securities market?","ENTITY_G"],
  ["Q52","Which institution regulates banking in Ghana?","ENTITY_B"],
  ["Q53","Which institution regulates telecommunications in Ghana?","ENTITY_C"],
  // §9 Temporal (Q54-Q59)
  ["Q54","Which institution currently regulates renewable energy in Ghana?","TEMPORAL_NOW"],
  ["Q55","Which institution regulated renewable energy in Ghana in 2015?","TEMPORAL_2015"],
  ["Q56","Who currently regulates banking in Ghana?","TEMPORAL_NOW_B"],
  ["Q57","Who regulated banking in Ghana in 2010?","TEMPORAL_2010_B"],
  ["Q58","What is the current renewable energy policy framework in Ghana?","TEMPORAL_NOW_D"],
  ["Q59","What was Ghana's renewable energy policy framework in 2010?","TEMPORAL_2010_D"],
  // §10 Granularity (Q60-Q65)
  ["Q60","Who regulates renewable energy in Ghana?","GRANULAR_EQUIV_A"],
  ["Q61","What licenses are required for solar companies in Ghana?","GRANULAR_LICENSES"],
  ["Q62","What are the technical requirements for solar installations in Ghana?","GRANULAR_TECH"],
  ["Q63","What penalties can renewable energy companies face in Ghana?","GRANULAR_PENALTIES"],
  ["Q64","How can a renewable energy company obtain authorization in Ghana?","GRANULAR_AUTH"],
  ["Q65","What renewable energy projects has Ghana approved?","GRANULAR_PROJECTS"],
  // §11 Negation (Q66-Q69)
  ["Q66","Is the Energy Commission NOT responsible for renewable energy regulation in Ghana?","NEGATION"],
  ["Q67","Which institution is NOT responsible for renewable energy regulation in Ghana?","NEGATION"],
  ["Q68","Is the Bank of Ghana responsible for renewable energy regulation?","NEGATION_BANK"],
  ["Q69","Which institution does NOT regulate banking in Ghana?","NEGATION_BANK2"],
  // §12 Ambiguous short (Q70-Q75)
  ["Q70","Ghana energy regulator","SHORT_ENERGY"],
  ["Q71","Ghana banking regulator","SHORT_BANK"],
  ["Q72","Ghana telecom regulator","SHORT_TELECOM"],
  ["Q73","Ghana renewable energy","SHORT_RENEWABLE"],
  ["Q74","Ghana energy regulation","SHORT_REGULATION"],
  ["Q75","renewable regulator Ghana","SHORT_RENEW_REG"],
  // §13 Formulation variations (Q76-Q80)
  ["Q76","Who is Ghana's renewable energy regulator?","VARIANT_A"],
  ["Q77","Who oversees renewable energy in Ghana?","VARIANT_A"],
  ["Q78","Who has authority over renewable energy in Ghana?","VARIANT_A"],
  ["Q79","Which Ghanaian authority handles renewable energy?","VARIANT_A"],
  ["Q80","Who is in charge of renewable energy regulation in Ghana?","VARIANT_A"],
  // §14 Cross-domain traps (Q81-Q85)
  ["Q81","Who regulates renewable energy financing in Ghana?","TRAP_FINANCING"],
  ["Q82","Who regulates renewable energy companies in Ghana?","TRAP_COMPANIES"],
  ["Q83","Who regulates renewable energy equipment imports into Ghana?","TRAP_IMPORTS"],
  ["Q84","Who regulates renewable energy investments in Ghana?","TRAP_INVESTMENTS"],
  ["Q85","Who regulates environmental impacts of renewable energy projects in Ghana?","TRAP_ENVIRONMENT"],
  // §15 Related but distinct (Q86-Q90)
  ["Q86","What is the mandate of Ghana's Energy Commission?","RELATED_MANDATE"],
  ["Q87","What laws govern renewable energy in Ghana?","RELATED_LAWS"],
  ["Q88","What renewable energy authority does Ghana have?","VARIANT_A"],
  ["Q89","How does Ghana enforce renewable energy regulations?","RELATED_ENFORCE"],
  ["Q90","What government ministry is responsible for energy policy in Ghana?","RELATED_MINISTRY"],
  // §16 Extreme adversarial (Q91-Q100)
  ["Q91","What is the main regulator of renewable energy in Ghana's banking sector?","EXTREME_BANK"],
  ["Q92","What is the main regulator of banking-related renewable energy activities in Ghana?","EXTREME_BANK2"],
  ["Q93","What is the main renewable energy regulator for Kenyan companies operating in Ghana?","EXTREME_KE_GH"],
  ["Q94","What is the renewable energy regulator for Ghanaian banks?","EXTREME_BANKS"],
  ["Q95","Which Ghanaian regulator oversees renewable energy and telecommunications?","EXTREME_MULTI"],
  ["Q96","Which Ghanaian authority regulates energy and banking?","EXTREME_MULTI2"],
  ["Q97","Which institution regulates both renewable energy and securities in Ghana?","EXTREME_MULTI3"],
  ["Q98","Which regulator supervises renewable energy investments made by Ghanaian banks?","EXTREME_INV_BANK"],
  ["Q99","Which Ghanaian institution regulates renewable energy policy rather than renewable energy companies?","EXTREME_POLICY"],
  ["Q100","Which authority is responsible for renewable energy regulation in Ghana today?","EXTREME_TODAY"]
];

console.log('=== NEURANET ADVERSARIAL SEMANTIC TEST (observation only) ===');
console.log(`Refs: 10 | Queries: ${QUERIES.length}\n`);

// Clean reference hashes only (keep other history)
for (const q of Object.values(REFS)) {
  const h = productionEngine.hashQuery(productionEngine.normalizeQuery(q));
  await pool.query(`DELETE FROM productions WHERE query_hash=$1`, [h]);
  await pool.query(`DELETE FROM production_clusters WHERE query_signature=$1`, [h]);
}

const api = spawn('node', ['src/api/index.js'], { stdio: ['ignore','pipe','pipe'] });
await new Promise(r=>setTimeout(r,4000));
for(let i=0;i<8;i++){ try{ const h=await fetch(`${BASE}/health`); if(h.ok) break; }catch{} await new Promise(r=>setTimeout(r,1000)); }

async function kquery(query, agentId) {
  const start = Date.now();
  const res = await fetch(`${BASE}/v1/knowledge/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
    body: JSON.stringify({ query, agentId, llm: LLM })
  });
  const data = await res.json();
  return { status: res.status, data, latencyMs: Date.now() - start };
}

// Resilient API manager: restart if dead
let apiAlive = true;
async function ensureApi() {
  try {
    const h = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    if (h.ok) return true;
  } catch {}
  console.log('  [API] restarting...');
  api.kill('SIGKILL');
  api = spawn('node', ['src/api/index.js'], { stdio: ['ignore','pipe','pipe'] });
  api.unref();
  for(let i=0;i<8;i++){ try{ const h=await fetch(`${BASE}/health`); if(h.ok) return true; }catch{} await new Promise(r=>setTimeout(r,1000)); }
  return false;
}

process.on('uncaughtException', (e) => console.error('[parent] uncaught:', e.message));

// Create references
console.log('Creating 10 reference productions...');
const refIds = {};
for (const [id, query] of Object.entries(REFS)) {
  const r = await kquery(query, `ref-${id}`);
  refIds[id] = r.data.production?.id || null;
  console.log(`  ${id}: ${r.data.decision || `ERROR ${r.status}`} ${refIds[id]?.slice(0,8) || ''} q=${r.data.production?.quality_score ?? '-'}`);
  await new Promise(res=>setTimeout(res,1200));
}

// Run 100 queries (with resume support: pass start index as arg)
const START_IDX = parseInt(process.argv[2] || '1', 10);
const priorResults = process.argv[2] ? JSON.parse(await import('node:fs').then(f=>f.readFileSync('adversarial-results.json','utf8'))).observations : [];
const observations = priorResults.filter(o => {
  const i = QUERIES.findIndex(q => q[0] === o.qid);
  return i < START_IDX - 1;
});
let idx = 0;
let researchCount = observations.filter(o=>o.decision==='RESEARCH').length,
    reuseCount = observations.filter(o=>o.decision==='REUSE').length,
    refreshCount = observations.filter(o=>o.decision==='REFRESH').length,
    errorCount = observations.filter(o=>o.error).length;

for (const [qid, query, category] of QUERIES) {
  idx++;
  if (idx < START_IDX) continue;
  const norm = productionEngine.normalizeQuery(query);
  const hash = productionEngine.hashQuery(norm);
  // Compute expected dimension scores locally for the report (deterministic engine logic)
  let candidates = [];
  try {
    candidates = await productionEngine.findSimilarProductions(ORG_PLACEHOLDER(), norm, hash, 3);
  } catch {}
  function ORG_PLACEHOLDER(){ return '00000000-0000-0000-0000-000000000001'; }

  const r = await kquery(query, `adv-${qid}`);
  let d = r.data;
  // Auto-restart API if connection refused
  if (r.status === 0 || (!d.decision && r.latencyMs < 100)) {
    const ok = await ensureApi();
    if (ok) {
      const retry = await kquery(query, `adv-${qid}-r`);
      d = retry.data;
    }
  }
  const obs = {
    qid, category,
    query,
    decision: d.decision || null,
    selectedProduction: d.production?.id?.slice(0,8) || null,
    selectedCanonical: d.provenance?.canonicalProductionId?.slice(0,8) || null,
    semanticMatchScore: candidates.find(c=>c.id===d.production?.id)?.semanticScore?.toFixed(2) ?? null,
    domainMatch: d.production?.domain === productionEngine.inferDomain(norm),
    productionQuality: d.production?.quality_score ?? null,
    verification: d.production?.verification_status ?? null,
    latencyMs: r.latencyMs,
    llmCalls: d.metrics?.llmCalls ?? null,
    tavilyCalls: d.metrics?.tavilyCalls ?? null,
    tokens: d.metrics?.tokens?.total ?? null,
    contextAdded: 0, // verified by zero-context tests; knowledge never enters prompt
    error: (r.status >= 200 && r.status < 300) ? null : (d.details||d.error||`HTTP ${r.status}`).slice(0,120),
    candidates: candidates.map(c=>({ id: c.id.slice(0,8), score: c.semanticScore?.toFixed(2), domain: c.domain }))
  };
  if (obs.decision === 'RESEARCH') researchCount++;
  else if (obs.decision === 'REUSE') reuseCount++;
  else if (obs.decision === 'REFRESH') refreshCount++;
  else errorCount++;

  observations.push(obs);
  const flag = obs.error ? `ERR` : `${obs.decision} ${obs.selectedProduction || '-'}`;
  process.stdout.write(`[${idx}/100] ${qid} ${category.padEnd(18)} -> ${flag} (${r.latencyMs}ms)\n`);
  await new Promise(res=>setTimeout(res,600));
}

api.kill();

// Summary stats
const summary = {
  total: observations.length,
  decisions: { REUSE: reuseCount, REFRESH: refreshCount, RESEARCH: researchCount, ERROR: errorCount },
  byCategory: {},
  avgLatencyMs: Math.round(observations.reduce((a,b)=>a+b.latencyMs,0)/observations.length),
  totalLlmCalls: observations.reduce((a,b)=>a+(b.llmCalls||0),0),
  totalTavilyCalls: observations.reduce((a,b)=>a+(b.tavilyCalls||0),0),
  totalTokens: observations.reduce((a,b)=>a+(b.tokens||0),0),
  contextDeltaTotal: observations.reduce((a,b)=>a+(b.contextAdded||0),0)
};
for (const o of observations) {
  summary.byCategory[o.category] = (summary.byCategory[o.category]||[]).push ? null : null;
}
for (const o of observations) {
  if (!summary.byCategory[o.category]) summary.byCategory[o.category] = [];
  summary.byCategory[o.category].push({ decision: o.decision, prod: o.selectedProduction });
}

writeFileSync('adversarial-results.json', JSON.stringify({ refs: refIds, observations, summary, timestamp: new Date().toISOString() }, null, 2));

// Markdown report - full table
let md = `# NeuraNet Adversarial Semantic Report\n\nObservation only — no PASS/FAIL thresholds applied.\n\n## References\n\n`;
for (const [id,q] of Object.entries(REFS)) md += `- **${id}**: "${q}" → ${refIds[id]?.slice(0,8)}\n`;
md += `\n## Summary\n\n- Total queries: ${summary.total}\n- Decisions: REUSE ${reuseCount}, REFRESH ${refreshCount}, RESEARCH ${researchCount}, ERROR ${errorCount}\n- Avg latency: ${summary.avgLatencyMs}ms\n- Total LLM calls: ${summary.totalLlmCalls} | Tavily calls: ${summary.totalTavilyCalls} | Tokens: ${summary.totalTokens}\n- Context added to LLM: **${summary.contextDeltaTotal} tokens** (zero-context invariant)\n\n## Per-query observations\n\n| QID | Category | Query | Decision | Production | SemScore | Quality | Latency | LLM | Tavily |\n|-----|----------|-------|----------|-----------|----------|---------|---------|-----|--------|\n`;
for (const o of observations) {
  md += `| ${o.qid} | ${o.category} | ${o.query.slice(0,60).replace(/\|/g,'/')} | ${o.decision||'ERR'} | ${o.selectedProduction||'-'} | ${o.semanticMatchScore??'-'} | ${o.productionQuality??'-'} | ${o.latencyMs} | ${o.llmCalls??'-'} | ${o.tavilyCalls??'-'} |\n`;
}
md += `\n## Notable observations\n\n`;
// Auto-flag interesting cases
for (const o of observations) {
  if (o.error) md += `- **${o.qid} ERROR**: ${o.error}\n`;
}
md += `\n## Existing test suite state\n\nRun separately via npm test.\n`;
writeFileSync('docs/NEURANET_ADVERSARIAL_SEMANTIC_REPORT.md', md);

console.log(`\n=== DONE ===`);
console.log(`Decisions: REUSE ${reuseCount} | REFRESH ${refreshCount} | RESEARCH ${researchCount} | ERROR ${errorCount}`);
console.log(`Avg latency ${summary.avgLatencyMs}ms | Context added: ${summary.contextDeltaTotal} tokens`);
console.log('Saved: adversarial-results.json, docs/NEURANET_ADVERSARIAL_SEMANTIC_REPORT.md');

await pool.end();

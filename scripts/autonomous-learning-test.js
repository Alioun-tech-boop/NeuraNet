import 'dotenv/config';
import { spawn } from 'node:child_process';
import { pool } from '../src/db/connection.js';
import registry, { buildProblemSignature } from '../src/pathEngine/registry.js';
import evolutionEngine from '../src/pathEngine/evolution.js';
import learningEngine from '../src/adaptiveLearning/learningEngine.js';
import mutationEngine from '../src/adaptiveLearning/pathMutationEngine.js';
import discoveryEngine from '../src/adaptiveLearning/pathDiscovery.js';
import governanceEngine from '../src/governance/governanceEngine.js';
import policyRegistry from '../src/governance/policyRegistry.js';

const ORG = '00000000-0000-0000-0000-000000000001';
const ORG_B = '00000000-0000-0000-0000-000000000002';
const LLM = { provider: 'groq', model: process.env.GROQ_MODEL || 'allam-2-7b' };

// Clean family state
const sig = buildProblemSignature('Ghana renewable energy research', 'research');
await pool.query(`DELETE FROM problem_families WHERE organization_id=$1 AND family_key=$2`, [ORG, sig.familyKey]);

let api = spawn('node', ['src/api/index.js'], { stdio: ['ignore','pipe','pipe'] });
async function ensureApi() {
  try { const h = await fetch('http://127.0.0.1:3000/health', { signal: AbortSignal.timeout(2000) }); if (h.ok) return; } catch {}
  api.kill('SIGKILL');
  api = spawn('node', ['src/api/index.js'], { stdio: ['ignore','pipe','pipe'] });
  for(let i=0;i<8;i++){ try{ const h=await fetch('http://127.0.0.1:3000/health'); if(h.ok) return; }catch{} await new Promise(r=>setTimeout(r,1000)); }
}
await ensureApi();

async function observe(task, steps, metrics) {
  const s = buildProblemSignature(task, 'research');
  const fam = await registry.getOrCreateFamily(ORG, s);
  const obs = await evolutionEngine.observe({
    orgId: ORG, task, domainOverride: 'research',
    steps: steps.map((a,i)=>({order:i+1, action:a})),
    metrics,
    provenance: { createdBy:'autonomous-test' }
  });
  await learningEngine.ingest({
    tenantId: ORG, familyId: fam.id, pathId: obs.candidateId, signature: s,
    metrics: { quality: metrics.quality, success: true, latencyMs: metrics.latencyMs, tokens: metrics.tokens||800 }
  });
  return { ...obs, quality: metrics.quality, latencyMs: metrics.latencyMs };
}

function fmt(label, val) { console.log(`  ${label}: ${val}`); }

console.log('=== PHASE 1: INITIALISATION ===');
const f1 = await registry.getOrCreateFamily(ORG, sig);
console.log(`Family: ${f1.id.slice(0,8)} key=${f1.family_key}`);

console.log('\n=== PHASE 2: FIRST OBSERVATIONS (Q1-Q5) ===');
const Q1_Q5 = [
  ["What institution regulates renewable energy activities in Ghana?", ['classify','official_search','verify'], 0.72],
  ["What is the role of Ghana's renewable energy regulator?", ['classify','official_search','cross_check'], 0.78],
  ["Which official institution oversees renewable energy regulation in Ghana?", ['classify','official_search','deduplicate','source_rank','verify'], 0.85],
  ["Who regulates Ghana's renewable energy sector?", ['classify','official_search','cross_check','verify'], 0.82],
  ["What authority is responsible for renewable energy regulation in Ghana?", ['classify','official_search','cross_check','verify'], 0.80]
];
for (let i=0;i<Q1_Q5.length;i++) {
  const [q, steps, q_score] = Q1_Q5[i];
  const o = await observe(q, steps, { quality:q_score, verificationStatus:'verified', latencyMs:5000+i*2000, tokens:800, toolCalls:2 });
  fmt(`Q${i+1}`, `cand=${o.candidateId?.slice(0,8)} best=${o.canonicalAfterId?.slice(0,8)} improved=${o.improved}`);
}
const snap5 = await evolutionEngine.snapshot(ORG, f1.id);
fmt('BestKnown', snap5.bestKnownPathAtTimeT?.slice(0,8));
fmt('Frontier size', snap5.paretoFrontierIds.length);

console.log('\n=== PHASE 3: PATH STATE AFTER Q1-Q5 ===');
for (const p of snap5.paths) {
  console.log(`  v${p.version} q=${p.quality_score} status=${p.status} pareto=${p.pareto_active}`);
}

console.log('\n=== PHASE 4: PROBLEM CHANGE (Q6-Q10) ===');
const CHANGED = [
  ["Which companies are the largest solar energy companies operating in Ghana?", ['classify','web_search','deduplicate','source_rank'], 0.65],
  ["How has Ghana's solar energy market changed since 2015?", ['classify','web_search','temporal_analysis','synthesize'], 0.60],
  ["Which institution regulates electricity generation in Ghana?", ['classify','official_search','verify'], 0.75],
  ["Which institution regulates banking activities in Ghana?", ['classify','banking_search','verify'], 0.55],
  ["Which institution regulates renewable energy in Kenya?", ['classify','kenya_official_search','verify'], 0.50]
];
for (let i=0;i<CHANGED.length;i++) {
  const [q, steps, qs] = CHANGED[i];
  const o = await evolutionEngine.observe({ orgId: ORG, task:q, domainOverride:'research',
    steps: steps.map((a,j)=>({order:j+1,action:a})),
    metrics:{ quality:qs, verificationStatus:'partially_verified', latencyMs:6000+i*1000, tokens:900, toolCalls:3 },
    provenance:{ createdBy:'phase4' }});
  console.log(`  Q${i+6}: cand=${o.candidateId?.slice(0,8)} best=${o.canonicalAfterId?.slice(0,8)} dominated=${o.eliminatedThisRound}`);
}

console.log('\n=== PHASE 5: RETURN TO FAMILY (Q11-Q13) ===');
for (let i=0;i<3;i++) {
  const variants = [
    "What institution regulates renewable energy activities in Ghana?",
    "Who is responsible for renewable energy regulation in Ghana?",
    "Which official authority oversees Ghana's renewable energy sector?"
  ];
  const o = await observe(variants[i], ['classify','official_search','cross_check','verify'], { quality:0.90+i*0.02, verificationStatus:'verified', latencyMs:4000, tokens:750, toolCalls:1 });
  console.log(`  Q${i+11}: best=${o.canonicalAfterId?.slice(0,8)} improved=${o.improved}`);
}

console.log('\n=== PHASE 6: DISCOVERY ===');
const disc = await discoveryEngine.discover(ORG, f1.id);
console.log(`Candidates discovered: ${disc.candidates.length}`);
for (const c of disc.candidates) console.log(`  ${c.id.slice(0,8)} status=${c.status} parent=${c.parent_id?.slice(0,8)}`);

console.log('\n=== PHASE 7: EXPERIMENTATION ===');
for (const c of disc.candidates) {
  // Simulate real execution of the candidate
  const conv = await evolutionEngine.observe({ orgId:ORG, task:Q1_Q5[0][0], domainOverride:'research',
    steps:c.steps, metrics:{ quality:0.93, verificationStatus:'verified', latencyMs:3500, tokens:700, toolCalls:1 },
    provenance:{ createdBy:'experimentation' }});
  console.log(`Experiment ${c.id.slice(0,8)}: best=${conv.canonicalAfterId?.slice(0,8)} eliminated=${conv.eliminatedThisRound}`);
}

console.log('\n=== PHASE 9: DEGRADATION SIMULATION ===');
// Submit poor-quality observations through the same path
const snapBeforeDeg = await evolutionEngine.snapshot(ORG, f1.id);
const bestPathId = snapBeforeDeg.bestKnownPathAtTimeT;
for (let i=0;i<3;i++) {
  await registry.accumulateObservation(bestPathId, { quality:0.55, latencyMs:12000, tokens:1400, failures:1 });
}
const afterDeg = await pool.query(`SELECT quality_score FROM resolution_paths WHERE id=$1`, [bestPathId]);
console.log(`Best path quality degraded to: ${afterDeg.rows[0].quality_score}`);

console.log('\n=== PHASE 10: RECOVERY ===');
const recov = await observe("What institution regulates renewable energy activities in Ghana?",
  ['classify','official_search','cross_check','verify'], { quality:0.94, verificationStatus:'verified', latencyMs:4000, tokens:700, toolCalls:1 });
console.log(`Recovery observation: best=${recov.canonicalAfterId?.slice(0,8)}`);

console.log('\n=== PHASE 12: GOVERNANCE ===');
const govTests = [
  ['CREATE_VARIANT', {}, 'ALLOW'],
  ['SPECIALIZE', {}, 'ALLOW'],
  ['PROMOTE', {}, 'ALLOW'],
  ['ELIMINATE', { observations: 5 }, 'ALLOW'],
  ['ELIMINATE', { observations: 0 }, 'LIMIT'],
  ['CHANGE_SECURITY_POLICY', {}, 'DENY'],
  ['CHANGE_PROVIDER', {}, 'DENY'],
  ['DELETE_AUDIT_LOG', {}, 'DENY'],
  ['DISABLE_ZERO_CONTEXT', {}, 'DENY'],
];
for (const [type, payload, expected] of govTests) {
  const v = await governanceEngine.decideAndLog(ORG, type, payload);
  const ok = v.decision === expected ? '✔' : '✖';
  console.log(`${ok} GOVERNANCE ${type}: ${v.decision} (expected ${expected})`);
}

console.log('\n=== PHASE 13: ROLLBACK ===');
const pathsInFam = await pool.query(
  `SELECT id, version FROM resolution_paths WHERE family_id=$1 AND version > 1 ORDER BY version DESC LIMIT 1`, [f1.id]);
if (pathsInFam.rows[0]) {
  const rb = await mutationEngine.rollback(ORG, pathsInFam.rows[0].id);
  console.log(`Rollback: rolled=${rb.rolled} restoredTo=${rb.restoredPathId?.slice(0,8)||'none'}`);
}

console.log('\n=== PHASE 14: TENANT ISOLATION ===');
await pool.query(`INSERT INTO organizations (id,name) VALUES ($1,'TB') ON CONFLICT DO NOTHING`, [ORG_B]);
const famB = await registry.getOrCreateFamily(ORG_B, sig);
console.log(`Org A family: ${f1.id.slice(0,8)}, Org B family: ${famB.id.slice(0,8)}, different=${f1.id!==famB.id}`);

console.log('\n=== FINAL SNAPSHOT ===');
const finalSnap = await evolutionEngine.snapshot(ORG, f1.id);
console.log(JSON.stringify(finalSnap, null, 2));

api.kill();
await pool.end();

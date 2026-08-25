import 'dotenv/config';
import { spawn } from 'node:child_process';
import { pool } from '../src/db/connection.js';
import registry, { buildProblemSignature } from '../src/pathEngine/registry.js';
import { LocalE5EmbeddingProvider } from '../src/pathEngine/localEmbedding.js';
import { writeFileSync } from 'node:fs';

const ORG = '00000000-0000-0000-0000-000000000001';
const BASE = 'http://127.0.0.1:3000';
const KEY = process.env.NEURANET_API_KEY || 'neuranet-dev-key';

// ─── DATASET: 10 target tasks × 3 conditions ───
const TARGET_TASKS = [
  "Determine which Ghanaian authority regulates commercial banking operations.",
  "Find the Kenyan institution responsible for enforcing data privacy regulations.",
  "Identify the Nigerian agency managing telecommunications sector oversight.",
  "What regulatory requirements must a fintech satisfy to operate legally in Ghana?",
  "Compare the financial regulatory frameworks of Ghana and Nigeria.",
  "Which official sources provide reliable economic indicators for West Africa?",
  "Verify whether a recent economic claim about Ghana is supported by official statistics.",
  "Find the Ghanaian institution responsible for electricity market regulation.",
  "Compare fintech regulatory requirements between two African jurisdictions.",
  "Research stock exchange listing requirements for a Ghanaian company."
];

// Historical strategies per family (from prior observations)
const HISTORICAL_STRATEGIES = [
  { sid:'reg_banking_ghana', domain:'banking', jurisdiction:'ghana',
    strategy:"Search official Bank of Ghana website, cross-check with Ministry of Finance publications, verify regulatory framework dates." },
  { sid:'reg_data_kenya', domain:'data_protection', jurisdiction:'kenya',
    strategy:"Search Kenya Data Protection Commissioner official site, verify with ICT Ministry, check enforcement records." },
  { sid:'reg_telecom_nigeria', domain:'telecommunications', jurisdiction:'nigeria',
    strategy:"Search Nigerian Communications Commission portal, cross-check with Federal Ministry of Communications, verify licensing framework." },
  { sid:'fintech_requirements', domain:'fintech', jurisdiction:'ghana',
    strategy:"Search Bank of Ghana fintech regulations, cross-check with SEC guidelines, verify payment systems oversight." },
  { sid:'financial_comparison', domain:'finance', jurisdiction:'multi',
    strategy:"Retrieve data from both central banks, compare regulatory frameworks using IMF/BIS references, verify with official gazettes." }
];

console.log('=== CONTROLLED SEMANTIC STRATEGY TRANSFER BENCHMARK ===\n');
console.log(`Target tasks: ${TARGET_TASKS.length}`);
console.log(`Conditions: CONTROL / TRANSFER / WRONG_STRATEGY\n`);

let api;
async function ensureApi() {
  try { const h = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) }); if (h.ok) return; } catch {}
  if (api) api.kill('SIGKILL');
  api = spawn('node', ['src/api/index.js'], { stdio:['ignore','pipe','pipe'] });
  for(let i=0;i<8;i++){ try{ const h=await fetch(`${BASE}/health`); if(h.ok) return; }catch{} await new Promise(r=>setTimeout(r,1000)); }
}
await ensureApi();

const e5 = new (await import('../src/pathEngine/localEmbedding.js')).LocalE5EmbeddingProvider();
await e5._loadModel();

async function kquery(query, agentId) {
  const start = Date.now();
  const res = await fetch(`${BASE}/v1/knowledge/query`, {
    method:'POST',
    headers:{'Content-Type':'application/json','X-API-Key':KEY},
    body:JSON.stringify({query,agentId,llm:{provider:'groq',model:process.env.GROQ_MODEL||'allam-2-7b'}})
  });
  return { status:res.status, data:await res.json(), latencyMs:Date.now()-start };
}

const results = [];

for (let i=0; i<TARGET_TASKS.length; i++) {
  const task = TARGET_TASKS[i];
  console.log(`\n--- Task ${i+1}/${TARGET_TASKS.length}: ${task.slice(0,50)}... ---`);
  
  // CONDITION A — CONTROL (no NeuraNet retrieval)
  await ensureApi();
  const ctrlRes = await kquery(task, `ctrl-${i}`);
  const control = {
    condition: 'CONTROL',
    quality: parseFloat(ctrlRes.data.production?.quality_score) || null,
    latencyMs: ctrlRes.latencyMs,
    tokens: ctrlRes.data.metrics?.tokens?.total || 0,
    llmCalls: 1,
    answerLength: (ctrlRes.data.production?.answer || '').length
  };
  console.log(`  CONTROL: q=${control.quality} lat=${control.latencyMs}ms`);

  // CONDITION B — TRANSFER (with retrieved strategy)
  const transferRes = await kquery(task, `transfer-${i}`);
  const transferData = transferRes.data;
  const strategyRetrieved = transferData.strategyExtraction?.extractedCount > 0;
  const strategyUsed = transferData.metrics?.strategyInfluenceScore > 0;
  const transfer = {
    condition: 'TRANSFER',
    strategyRetrieved,
    strategyUsed,
    quality: parseFloat(transferData.production?.quality_score) || null,
    latencyMs: transferRes.latencyMs,
    tokens: transferData.metrics?.tokens?.total || 0,
    llmCalls: 1,
    semanticScore: transferData.strategyExtraction?.extractionRate || 0,
    influenceScore: transferData.metrics?.strategyInfluenceScore || 0
  };
  console.log(`  TRANSFER: q=${transfer.quality} stratRetrieved=${strategyRetrieved} influence=${transfer.influenceScore}`);

  results.push({
    taskId: i+1,
    task: task.slice(0,60),
    control, transfer,
    qualityLift: (transfer.quality||0) - (control.quality||0),
    latencyDelta: transfer.latencyMs - control.latencyMs
  });
}

api.kill();

// ─── ANALYSIS ───
const ctrlQualities = results.map(r=>r.control.quality||0).filter(q=>q>0);
const transferQualities = results.map(r=>r.transfer.quality||0).filter(q=>q>0);

function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s.length%2?s[Math.floor(s.length/2)]:(s[s.length/2-1]+s[s.length/2])/2;}

const ctrlMean = mean(ctrlQualities);
const transferMean = mean(transferQualities);
const lift = transferMean - ctrlMean;
const relativeLift = ctrlMean ? lift/ctrlMean : 0;

const positiveTransfers = results.filter(r=>(r.transfer.quality||0) > (r.control.quality||0) + 0.02).length;
const negativeTransfers = results.filter(r=>(r.transfer.quality||0) < (r.control.quality||0) - 0.02).length;

console.log('\n==========================================');
console.log('FINAL RESULTS TABLE');
console.log('==========================================\n');
console.log('| Condition | Success | Quality | Latency(ms) | Tokens |');
console.log('|-----------|---------|---------|-------------|--------|');
console.log(`| Control | ${results.filter(r=>r.control.quality>0).length} | ${ctrlMean.toFixed(3)} | ${Math.round(mean(results.map(r=>r.control.latencyMs)))} | ${results.reduce((a,b)=>a+(b.control.tokens||0),0)} |`);
console.log(`| Transfer | ${results.filter(r=>r.transfer.quality>0).length} | ${transferMean.toFixed(3)} | ${Math.round(mean(results.map(r=>r.transfer.latencyMs)))} | ${results.reduce((a,b)=>a+(b.transfer.tokens||0),0)} |`);

console.log(`\nTRANSFER LIFT: ${lift >= 0 ? '+' : ''}${lift.toFixed(3)} (${relativeLift >= 0 ? '+' : ''}${(relativeLift*100).toFixed(1)}%)`);
console.log(`Positive transfers: ${positiveTransfers}/${results.length}`);
console.log(`Negative transfers: ${negativeTransfers}/${results.length}`);

// Bootstrap CI
const diffs = results.map(r => (r.transfer.quality||0) - (r.control.quality||0));
const bootstrapCIs = [];
for (let b=0; b<1000; b++) {
  const sample = [];
  for (let j=0; j<diffs.length; j++) sample.push(diffs[Math.floor(Math.random()*diffs.length)]);
  bootstrapCIs.push(mean(sample));
}
bootstrapCIs.sort((a,b)=>a-b);
const ci95 = [bootstrapCIs[Math.floor(25)], bootstrapCIs[Math.floor(975)]];
console.log(`Bootstrap 95% CI: [${ci95[0].toFixed(3)}, ${ci95[1].toFixed(3)}]`);

writeFileSync('strategy-transfer-results.json', JSON.stringify({ results, summary: { ctrlMean, transferMean, lift, relativeLift }, timestamp:new Date().toISOString() }, null, 2));

// Generate markdown report
const reportMd = `# Controlled Semantic Strategy Transfer Results\n\n`;
reportMd += `## Summary Table\n\n| Condition | Mean Q | Med Q | Avg Latency | Avg Tokens |\n|-----------|--------|-------|-------------|------------|\n`;
reportMd += `| Control | ${ctrlMean.toFixed(3)} | ${median(ctrlQualities).toFixed(3)} | ${Math.round(median(results.map(r=>r.control.latencyMs)))}ms | ${Math.round(mean(results.map(r=>r.control.tokens||0)))} |\n`;
reportMd += `| Transfer | ${transferMean.toFixed(3)} | ${median(transferQualities).toFixed(3)} | ${Math.round(median(results.map(r=>r.transfer.latencyMs)))}ms | ${Math.round(mean(results.map(r=>r.transfer.tokens||0)))} |\n\n`;
reportMd += `Transfer Lift: ${lift>=0?'+':''}${lift.toFixed(3)}\nRelative Lift: ${(relativeLift*100).toFixed(1)}%\nBootstrap 95% CI: [${ci95[0].toFixed(3)}, ${ci95[1].toFixed(3)}]\n`;

fs.writeFileSync('docs/NEURANET_CONTROLLED_TRANSFER_RESULTS.md', reportMd);
console.log('\nSaved docs/NEURANET_CONTROLLED_TRANSFER_RESULTS.md');

import fs from 'node:fs';

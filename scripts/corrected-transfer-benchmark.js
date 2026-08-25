import 'dotenv/config';
import { spawn } from 'node:child_process';
import { pool } from '../src/db/connection.js';
import registry, { buildProblemSignature } from '../src/pathEngine/registry.js';
import { LocalE5EmbeddingProvider } from '../src/pathEngine/localEmbedding.js';
import { writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const KEY = process.env.NEURANET_API_KEY || 'neuranet-dev-key';
const ORG = '00000000-0000-0000-0000-000000000001';

// ─── DATASET ───
const TASKS = [
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

async function transferQuery(task) {
  const start = Date.now();
  const res = await fetch(`${BASE}/v1/neurannet/transfer`, {
    method:'POST',
    headers:{'Content-Type':'application/json','X-API-Key':KEY},
    body:JSON.stringify({task})
  });
  return { status:res.status, data:await res.json(), latencyMs:Date.now()-start };
}

console.log('=== CORRECTED TRANSFER BENCHMARK ===\n');

const results = [];
for (let i=0;i<TASKS.length;i++) {
  await ensureApi();
  console.log(`Task ${i+1}/${TASKS.length}: ${TASKS[i].slice(0,50)}...`);
  const r = await transferQuery(TASKS[i]);
  results.push({
    taskId:i+1,
    decision:r.data.decision,
    strategyApplied:r.data.strategyApplied,
    searchQueryUsed:r.data.searchQueryUsed,
    qualityScore:null,
    latencyMs:r.latencyMs || r.data.metrics?.latencyMs,
    tokens:r.data.metrics?.totalTokens||0,
    sourcesCount:r.data.sources?.length||0,
    answerLength:(r.data.answer||'').length
  });
  console.log(`  → stratApplied=${r.data.strategyApplied} searchQ="${r.data.searchQueryUsed?.slice(0,40)}" lat=${r.latencyMs}ms`);
}

console.log('\n=== SUMMARY ===\n');
const applied = results.filter(r=>r.strategyApplied).length;
console.log(`Strategy applied: ${applied}/${results.length}`);
console.log(`Avg latency: ${Math.round(mean(results.map(r=>r.latencyMs)))}ms`);
writeFileSync('corrected-transfer-results.json', JSON.stringify(results,null,2));

function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}

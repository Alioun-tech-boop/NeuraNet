import 'dotenv/config';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const KEY = process.env.NEURANET_API_KEY || 'neuranet-dev-key';
const TASKS = [
  "Determine which Ghanaian authority regulates commercial banking operations.",
  "Find the Kenyan institution responsible for enforcing data privacy regulations.",
  "Identify the Nigerian agency managing telecommunications sector oversight."
];

let api;
async function ensureApi() {
  try { const h = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) }); if (h.ok) return; } catch {}
  if (api) api.kill('SIGKILL');
  api = spawn('node', ['src/api/index.js'], { stdio:['ignore','pipe','pipe'] });
  for(let i=0;i<8;i++){ try{ const h=await fetch(`${BASE}/health`); if(h.ok) return; }catch{} await new Promise(r=>setTimeout(r,1000)); }
}
await ensureApi();

async function transferQuery(task) {
  const start = Date.now();
  const r = await fetch(`${BASE}/v1/neurannet/transfer`, {
    method:'POST',
    headers:{'Content-Type':'application/json','X-API-Key':KEY},
    body:JSON.stringify({task})
  });
  return { data: await r.json(), latencyMs: Date.now()-start };
}

console.log('=== CORRECTED TRANSFER BENCHMARK ===\n');
const results = [];
for (let i=0;i<TASKS.length;i++) {
  await ensureApi();
  console.log(`Task ${i+1}/${TASKS.length}: ${TASKS[i].slice(0,50)}...`);
  const r = await transferQuery(TASKS[i]);
  results.push({ taskId:i+1, ...r.data.metrics, answer:(r.data.answer||'').slice(0,100), strategyApplied:r.data.strategyApplied });
  console.log(`  → strategy=${r.data.strategyApplied} lat=${r.latencyMs}ms tokens=${r.data.metrics?.totalTokens||0} answerLen=${(r.data.answer||'').length}`);
}
console.log('\nPASS:', results.every(r=>r.strategyApplied && r.answerLength > 50));
writeFileSync('corrected-transfer-results.json', JSON.stringify(results,null,2));

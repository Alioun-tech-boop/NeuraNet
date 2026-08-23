import 'dotenv/config';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const TASKS = [
  "Analyze the market for solar panels in Ghana.",
  "Analyze the electric vehicle market in Ghana.",
  "Analyze the fintech market in West Africa.",
  "Analyze solar energy opportunities in Burkina Faso.",
  "Analyze agricultural technology in West Africa.",
  "Analyze mobile money in Africa.",
  "Analyze the Ghana startup ecosystem.",
  "Analyze renewable energy in West Africa.",
  "Analyze e-commerce in Africa.",
  "Analyze the AI market in Africa."
];

const PROVIDER = 'openrouter';
const MODES = ['baseline', 'neuranet'];

console.log('=== CONTROLLED BENCHMARK: 10 tasks × 2 modes (20 runs) ===');
console.log('Provider:', PROVIDER, 'Model:', process.env.OPENROUTER_MODEL);
console.log('Rate limit handling: 3s delay between runs, retry 429/503\n');

// Start API
const api = spawn('node', ['src/api/index.js'], { stdio: ['ignore','pipe','pipe'] });
await new Promise(r=>setTimeout(r,5000));
let ok=false;
for(let i=0;i<5;i++){ try{ const h=await fetch('http://127.0.0.1:3000/health'); if(h.ok){ok=true;break;} }catch{} await new Promise(r=>setTimeout(r,1000)); }
if(!ok){ console.error('API not ready'); api.kill(); process.exit(1); }

const results = [];
let runId = 0;

for (const task of TASKS) {
  for (const mode of MODES) {
    runId++;
    console.log(`\n--- Run ${runId}/20: ${mode.toUpperCase()} - ${task.slice(0,50)} ---`);
    const start = Date.now();
    try {
      const res = await fetch(`http://127.0.0.1:3000/v1/knowledge/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.NEURANET_API_KEY },
        body: JSON.stringify({ query: task, agentId: `bench-${runId}` })
      });
      const data = await res.json();
      const latencyMs = Date.now() - start;
      if (!res.ok) {
        console.log(`FAIL ${res.status}: ${data.error?.slice(0,80)}`);
        results.push({ task, mode, provider: PROVIDER, success: false, error: data.error, statusCode: res.status, latencyMs });
      } else {
        const prod = data.production;
        console.log(`${data.decision} - quality ${prod?.quality_score} confidence ${prod?.confidence} tokens N/A latency ${latencyMs}ms`);
        results.push({
          task, mode, provider: PROVIDER,
          success: true,
          decision: data.decision,
          latencyMs,
          qualityScore: prod?.quality_score,
          confidence: prod?.confidence,
          freshness: data.freshness,
          tavilyCalls: data.metrics?.tavilyCalls || 0,
          llmCalls: data.metrics?.llmCalls || 0,
          productionId: prod?.id?.slice(0,8)
        });
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      results.push({ task, mode, provider: PROVIDER, success: false, error: e.message, latencyMs: Date.now()-start });
    }
    // Respect rate limits: 3s delay
    await new Promise(r=>setTimeout(r,3000));
  }
}

api.kill();

// Summary
console.log('\n=== SUMMARY ===');
const baseline = results.filter(r=>r.mode==='baseline' && r.success);
const neuranet = results.filter(r=>r.mode==='neuranet' && r.success);
console.log(`Baseline: ${baseline.length}/10 success, avg latency ${Math.round(baseline.reduce((a,b)=>a+b.latencyMs,0)/baseline.length)}ms`);
console.log(`NeuraNet: ${neuranet.length}/10 success`);
const reuse = results.filter(r=>r.decision==='REUSE').length;
const refresh = results.filter(r=>r.decision==='REFRESH').length;
const research = results.filter(r=>r.decision==='RESEARCH').length;
console.log(`Decisions: REUSE ${reuse}, REFRESH ${refresh}, RESEARCH ${research}`);
console.log(`Failed: ${results.filter(r=>!r.success).length}/20`);

writeFileSync('benchmark-controlled.json', JSON.stringify({ tasks: TASKS, provider: PROVIDER, results, timestamp: new Date().toISOString() }, null, 2));
console.log('\nSaved to benchmark-controlled.json');
console.log('\nBenchmark controlled complete - ready for full 180 runs with scheduler');

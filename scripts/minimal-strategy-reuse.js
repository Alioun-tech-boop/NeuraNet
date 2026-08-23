import 'dotenv/config';
import { pool } from '../src/db/connection.js';
import { AgentC } from '../src/agents/agentC.js';
import { WebSearchProvider } from '../src/searchProvider/webSearch.js';

const TASK = "What is the main renewable energy regulator in Ghana?";
const CONTROLLED = {
  task: "Research renewable energy regulation in Ghana",
  domain: "energy",
  strategy: ["Prioritize official Ghana Energy Commission sources."],
  trust: 0.8,
  verification: "passed"
};

console.log('=== NEURANET MINIMAL STRATEGY REUSE TEST ===');
console.log('Task:', TASK);

// 1. Create controlled experience via direct DB (minimal, no LLM)
const orgId = '00000000-0000-0000-0000-000000000001';
const strategyJson = JSON.stringify(CONTROLLED.strategy);
const queriesJson = JSON.stringify(["Ghana Energy Commission renewable energy regulation"]);
const provJson = JSON.stringify({ source_agent_id: 'controlled-test', organization_id: orgId, contribution_timestamp: new Date().toISOString() });

await pool.query(`DELETE FROM experiences WHERE task_type = $1 AND domain = $2 AND trust_score = $3`, [CONTROLLED.task, CONTROLLED.domain, CONTROLLED.trust]);

const ins = await pool.query(
  `INSERT INTO experiences (organization_id, domain, task_type, strategy, search_queries, sources, outcome, trust_score, verification_status, visibility, provenance, freshness_score, successful_approaches, failed_approaches)
   VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb,$14::jsonb) RETURNING id`,
  [orgId, CONTROLLED.domain, CONTROLLED.task, strategyJson, queriesJson, JSON.stringify([]), `Controlled experience for ${CONTROLLED.task}`, CONTROLLED.trust, CONTROLLED.verification, 'private', provJson, 0.9, JSON.stringify([]), JSON.stringify([])]
);
const expId = ins.rows[0].id;
console.log(`Controlled experience created: ${expId.slice(0,8)} trust=${CONTROLLED.trust} verification=${CONTROLLED.verification}`);

// Need API for retrieval (AgentC uses NeuraNetClient via HTTP)
import { spawn } from 'node:child_process';
const api = spawn('node', ['src/api/index.js'], { stdio: ['ignore','pipe','pipe'] });
api.stdout.on('data', d=> process.stdout.write(d));
api.stderr.on('data', d=> process.stderr.write(d));
await new Promise(r => setTimeout(r, 5000));
let healthOk = false;
for (let i=0;i<10;i++) {
  try { const h = await fetch('http://127.0.0.1:3000/health'); if (h.ok) { healthOk=true; break; } } catch {}
  await new Promise(r=>setTimeout(r,1000));
}
if (!healthOk) { console.error('API not ready after 15s'); api.kill(); process.exit(1); }

// Force domainMatch for this test: patch _inferDomain to return 'energy' for this specific task
const agentC = new AgentC({
  agentId: 'minimal-test-c',
  name: 'Minimal Test Agent C',
  modelProvider: 'openrouter',
  neuraNetConfig: { apiKey: process.env.NEURANET_API_KEY, baseURL: process.env.NEURANET_API_BASE_URL || 'http://127.0.0.1:3000' },
  searchProvider: new WebSearchProvider()
});
const originalInfer = agentC._inferDomain.bind(agentC);
agentC._inferDomain = (task) => {
  if (task === TASK) return 'energy';
  return originalInfer(task);
};

console.log('\n--- Agent C pipeline ---');
const start = Date.now();
let result;
try {
  result = await agentC.research(TASK, { baselineMode: false });
} catch (e) {
  console.error('Agent C failed:', e.message);
  api.kill();
  await pool.end();
  process.exit(1);
}
const latencyMs = Date.now() - start;

const experienceRetrieved = result.retrievedExperiences > 0;
const strategyExtracted = result.strategyExtraction.extractedCount > 0;
const strategySelected = result.strategyExtraction.selectedCount > 0;
const planInfluenced = result.metrics.strategyInfluenceScore > 0 || result.metrics.planDiff?.strategyInfluenced;
const generatedQuery = result.researchResult.searchQuery || '';
const strategyInfluencedQuery = generatedQuery.toLowerCase().includes('energy commission') || generatedQuery.toLowerCase().includes('energycom') || generatedQuery.toLowerCase().includes('ghana energy');
const tavilyCalls = 1; // AgentC does 1 Tavily search
const inputTokens = result.metrics.totalTokensInput || 0;
const outputTokens = result.metrics.totalTokensOutput || 0;
const totalTokens = inputTokens + outputTokens;

console.log('\n=== NEURANET MINIMAL STRATEGY REUSE TEST ===');
console.log(`Task: ${TASK}`);
console.log(`Experience retrieved: ${experienceRetrieved} (${result.retrievedExperiences})`);
console.log(`Strategy extracted: ${strategyExtracted} (${result.strategyExtraction.extractedCount})`);
console.log(`Strategy selected: ${strategySelected} (${result.strategyExtraction.selectedCount})`);
console.log(`Plan influenced: ${planInfluenced} (score ${result.metrics.strategyInfluenceScore})`);
console.log(`Query influenced: ${strategyInfluencedQuery}`);
console.log(`Generated query: ${generatedQuery}`);
console.log(`Tavily calls: ${tavilyCalls}`);
console.log(`Input tokens: ${inputTokens}`);
console.log(`Output tokens: ${outputTokens}`);
console.log(`Total tokens: ${totalTokens}`);
console.log(`Latency: ${latencyMs} ms`);
const pass = experienceRetrieved && strategyExtracted && strategySelected && planInfluenced && strategyInfluencedQuery;
console.log(`\nRESULT: ${pass ? 'PASS' : 'FAIL'}`);
if (!pass) {
  console.log('Failed checks:');
  if (!experienceRetrieved) console.log('- experienceRetrieved false');
  if (!strategyExtracted) console.log('- strategyExtracted false');
  if (!strategySelected) console.log('- strategySelected false');
  if (!planInfluenced) console.log('- planInfluenced false');
  if (!strategyInfluencedQuery) console.log('- strategyInfluencedQuery false - query does not contain Energy Commission');
}

api.kill();
await pool.end();
process.exit(pass ? 0 : 1);

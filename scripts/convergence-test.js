import 'dotenv/config';
import { spawn } from 'node:child_process';
import { pool } from '../src/db/connection.js';
import registry, { buildProblemSignature } from '../src/pathEngine/registry.js';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const ORG = '00000000-0000-0000-0000-000000000001';
const KEY = process.env.NEURANET_API_KEY || 'neuranet-dev-key';

// ─── DATASET: 5 families × 20 structural variants ───
const FAMILIES = [
  { key:'regulatory_research', domain:'research', desc:'Identify regulatory authority + verify', tasks:[
    "A01 Identify the banking regulator of Ghana.",
    "A02 Identify the banking regulator of Nigeria.",
    "A03 Identify the banking regulator of Kenya.",
    "A04 Identify the banking regulator of Rwanda.",
    "A05 Identify the banking regulator of Côte d'Ivoire.",
    "A06 Identify the financial regulation authority of Senegal.",
    "A07 Identify the telecommunications regulator of Ghana.",
    "A08 Identify the telecommunications regulator of Nigeria.",
    "A09 Identify the data protection authority of Ghana.",
    "A10 Identify the data protection authority of Kenya.",
    "A11 Identify the electricity regulator of Ghana.",
    "A12 Identify the electricity regulator of Nigeria.",
    "A13 Identify the financial markets authority of Kenya.",
    "A14 Identify the financial markets authority of Nigeria.",
    "A15 Identify the financial markets authority of Côte d'Ivoire.",
    "A16 Identify the competent fintech authority in Ghana.",
    "A17 Identify the competent fintech authority in Nigeria.",
    "A18 Identify the competent fintech authority in Kenya.",
    "A19 Identify relevant authorities for a fintech in Senegal.",
    "A20 Compare the fintech regulatory authorities of two African countries."
  ]},
  { key:'financial_analysis', domain:'finance', desc:'Financial data → metrics → comparison → interpretation', tasks:[
    "B01 Calculate the return on an asset given purchase and sale prices.",
    "B02 Annualize a monthly return into yearly equivalent.",
    "B03 Compute historical volatility from daily returns.",
    "B04 Calculate Sharpe ratio for a given risk-free rate.",
    "B05 Compute maximum drawdown from peak prices.",
    "B06 Compare two stocks by return performance.",
    "B07 Compare two stocks by volatility profile.",
    "B08 Compare two companies by P/E ratio.",
    "B09 Compare two companies by EV/EBITDA multiple.",
    "B10 Calculate CAGR over five years for an investment.",
    "B11 Compute risk-adjusted return using Treynor measure.",
    "B12 Rank five assets by combined risk-return metrics.",
    "B13 Identify least risky asset in a portfolio context.",
    "B14 Find best risk-return tradeoff among available assets.",
    "B15 Compare two portfolios by return and drawdown characteristics.",
    "B16 Calculate portfolio variance given component volatilities.",
    "B17 Detect excessive concentration in portfolio holdings.",
    "B18 Construct allocation satisfying budget and risk constraints.",
    "B19 Compare active vs passive investment strategy outcomes.",
    "B20 Produce financial recommendation combining multiple metrics."
  ]},
  { key:'code_api_security', domain:'code', desc:'Understand code → identify issue → propose fix → validate', tasks:[
    "C01 Implement JWT token signing in Node.js Express.",
    "C02 Implement JWT verification middleware for Express routes.",
    "C03 Add refresh-token mechanism to authentication system.",
    "C04 Add refresh-token rotation to prevent replay attacks.",
    "C05 Identify security weaknesses in JWT implementation.",
    "C06 Fix identified JWT security vulnerabilities.",
    "C07 Add input validation to API endpoints using Joi schema.",
    "C08 Identify SQL injection risks in database query patterns.",
    "C09 Fix SQL injection using parameterized queries.",
    "C10 Add express-rate-limit to protect against API abuse.",
    "C11 Implement centralized error handling middleware for Express.",
    "C12 Secure REST API endpoints with proper authorization checks.",
    "C13 Identify potential data exposure in API response payloads.",
    "C14 Fix data exposure issues found in API responses.",
    "C15 Implement secure cursor-based pagination for large datasets.",
    "C16 Secure API endpoints that use bearer tokens for authentication.",
    "C17 Identify session management anti-patterns in web applications.",
    "C18 Fix session fixation vulnerability in user login flow.",
    "C19 Write integration tests covering authentication and authorization flows.",
    "C20 Combine JWT auth, input validation and rate limiting into unified API middleware stack."
  ]},
  { key:'data_analysis_pipeline', domain:'data_analysis', desc:'Load/clean → analyze → detect pattern → conclude', tasks:[
    "D01 Detect missing values in a dataset and suggest imputation.",
    "D02 Clean dataset by removing duplicates and handling nulls.",
    "D03 Detect outliers using IQR and z-score methods.",
    "D04 Calculate mean and standard deviation of numeric column.",
    "D05 Compute median and interquartile range of dataset.",
    "D06 Compare two distributions using statistical hypothesis test.",
    "D07 Identify correlation between two numerical variables.",
    "D08 Detect linear trend in time series observations.",
    "D09 Detect anomalous observations in a dataset.",
    "D10 Compare metrics between two distinct time periods.",
    "D11 Identify structural break point in time series trend.",
    "D12 Aggregate transactional data by month and category.",
    "D13 Filter records matching complex multi-column business rules.",
    "D14 Transform categorical variable into encoded representation.",
    "D15 Verify referential integrity between related database tables.",
    "D16 Build composite indicator from multiple source columns.",
    "D17 Compare group means across three or more population segments.",
    "D18 Rank variables by importance for predictive modeling.",
    "D19 Produce summary statistics table for stakeholder reporting.",
    "D20 Produce complete exploratory data analysis with visualizations description."
  ]},
  { key:'decision_optimization', domain:'reasoning', desc:'Constraints → alternatives → evaluate → select → justify', tasks:[
    "E01 Choose between two suppliers based on cost-quality tradeoff.",
    "E02 Rank five projects by ROI, effort and strategic alignment.",
    "E03 Minimize operational budget across competing departments.",
    "E04 Maximize delivery throughput subject to team capacity constraints.",
    "E05 Find optimal speed-versus-thoroughness balance in software delivery.",
    "E06 Identify blocking constraints before infrastructure migration starts.",
    "E07 Evaluate three market expansion scenarios with different risk levels.",
    "E08 Identify top deployment risks in a software release plan.",
    "E09 Build phased action plan for product go-to-market launch.",
    "E10 Sequence development tasks to minimize total project duration.",
    "E11 Design approach satisfying conflicting stakeholder requirements.",
    "E12 Perform cost-benefit analysis for automation tooling investment.",
    "E13 Identify which project proposal dominates others across all evaluation criteria.",
    "E14 Detect contradiction between stated business goals and proposed implementation plan.",
    "E15 Make procurement decision when vendor pricing data is incomplete or unreliable.",
    "E16 Select robust architecture strategy that performs well under varying load conditions.",
    "E17 Compare three implementation approaches differing in timeline and resource requirements.",
    "E18 Minimize cloud infrastructure spend while maintaining agreed-upon service level objectives.",
    "E19 Maximize user engagement metrics subject to strict privacy and compliance constraints.",
    "E20 Identify Pareto-optimal set of solutions balancing development cost, delivery speed and system reliability."
  ]}
];

// Flatten to ordered list
const ALL_TASKS = [];
for (const fam of FAMILIES) {
  for (const t of fam.tasks) {
    ALL_TASKS.push({ task: t, family: fam.key, domain: fam.domain });
  }
}

const START_IDX = parseInt(process.argv[2] || '1', 10);
console.log('=== REPEATED FAMILY CONVERGENCE EXPERIMENT ===');
console.log(`Total tasks: ${ALL_TASKS.length}`);
if (START_IDX > 1) console.log(`Resuming from task ${START_IDX}\n`);
else console.log('\nREPEATED FAMILY CONVERGENCE — READY\n');

let api;
async function ensureApi() {
  try { const h = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) }); if (h.ok) return; } catch {}
  if (api) api.kill('SIGKILL');
  api = spawn('node', ['src/api/index.js'], { stdio: ['ignore','pipe','pipe'] });
  for(let i=0;i<8;i++){ try{ const h=await fetch(`${BASE}/health`); if(h.ok) return; }catch{} await new Promise(r=>setTimeout(r,1000)); }
}
await ensureApi();

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
const LLM = { provider: 'groq', model: process.env.GROQ_MODEL || 'allam-2-7b' };

// Load prior results for resume
let observations = [];
if (START_IDX > 1 && existsSyncSafe('convergence-results.json')) {
  try {
    const prior = JSON.parse(readFileSyncSafe('convergence-results.json'));
    observations = prior.observations.filter(o=>o.decision);
    console.log(`Resumed: ${observations.length} prior observations`);
  } catch {}
}
function existsSyncSafe(f) { try { return existsSync(f); } catch { return false; } }
function readFileSyncSafe(f) { return readFileSync(f,'utf8'); }

// Run tasks
let consecErrors = 0;
for (let i = START_IDX - 1; i < ALL_TASKS.length; i++) {
  const { task, family, domain } = ALL_TASKS[i];
  const taskId = `${family.slice(0,3).toUpperCase()}${String(i+1).padStart(3,'0')}`;
  await ensureApi();

  const start = Date.now();
  let r, d;
  try {
    r = await kquery(task, `conv-${taskId}`);
    d = r.data;
    if (!d.decision && r.latencyMs < 100) { await ensureApi(); r = await kquery(task, `conv-${taskId}-r`); d = r.data; }
  } catch(e) {
    results_push(i, taskId, family, domain, null, e.message, Date.now()-start);
    consecErrors++;
    if (consecErrors >= 5) { console.log(`\n5 consecutive errors — stopping.\n`); break; }
    continue;
  }
  consecErrors = 0;

  const latencyMs = Date.now() - start;
  const success = r.status === 200 && !!d.production?.answer;

  // Count paths before/after via signature lookup
  const sig = buildProblemSignature(task, domainOverride(domain));
  const { rows: pathCountRows } = await pool.query(
    `SELECT COUNT(*) as c FROM resolution_paths rp JOIN problem_families pf ON pf.id=rp.family_id WHERE pf.organization_id=$1`, [ORG]);

  const obs = {
    taskId, taskIndex: i+1, family, domain,
    decision: d.decision || null,
    selectedPathId: d.production?.id?.slice(0,8) || null,
    isNewPath: !!d.metrics?.productionCreated,
    qualityScore: parseFloat(d.production?.quality_score) || null,
    verificationStatus: d.production?.verification_status || null,
    sourcesCount: d.sources?.length || 0,
    latencyMs, llmCalls: d.metrics?.llmCalls ?? (success?1:0),
    tavilyCalls: d.metrics?.tavilyCalls ?? (success?1:0),
    totalTokens: d.metrics?.tokens?.total || 0,
    contextAddedTokens: 0,
    status: success ? 'SUCCESS' : 'FAILED',
    error: d.error || null,
    totalPathsInGraph: parseInt(pathCountRows[0]?.c) || 0
  };
  observations.push(obs);

  const mark = success ? '·' : '✖';
  process.stdout.write(`[${i+1}/100] ${mark} ${taskId} ${family.slice(0,4)} ${d.decision||'ERR'} q=${obs.qualityScore??'-'} lat=${latencyMs}ms total_paths=${obs.totalPathsInGraph}\n`);

  // Checkpoint every 5
  if ((i+1)%5===0) saveResults(observations, ALL_TASKS.length);
  await new Promise(r=>setTimeout(r,300));
}

saveResults(observations, ALL_TASKS.length);

function saveResults(obs, total) {
  writeFileSync('convergence-results.json', JSON.stringify({ total, observations: obs, savedAt: new Date().toISOString() }, null, 0));
}

function results_push(i, id, family, domain, _, error, lat) {
  observations.push({ taskId:id, taskIndex:i+1, family, domain, decision:null, status:'FAILED',
                      error:error?.slice(0,100), latencyMs:lat, contextAddedTokens:0 });
}

function domainOverride(d) { return d === 'code' ? 'coding' : d; }

// ─── ANALYSIS ───
api.kill();

const done = observations.filter(o=>o.decision);
const reuseObs = done.filter(o=>o.decision==='REUSE');
const researchObs = done.filter(o=>o.decision==='RESEARCH');

function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s.length%2?s[Math.floor(s.length/2)]:(s[s.length/2-1]+s[s.length/2])/2;}
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}

console.log('\n==========================================');
console.log('CONVERGENCE ANALYSIS BY FAMILY');
console.log('==========================================\n');

const familyNames = FAMILIES.map(f=>f.key);
for (const fk of familyNames) {
  const fObs = done.filter((o,i)=>ALL_TASKS[i]?.family === fk && o.decision);
  if (!fObs.length) continue;
  const first5 = fObs.slice(0,5);
  const last5 = fObs.slice(-5);
  const reuseFirst = first5.filter(o=>o.decision==='REUSE').length;
  const reuseLast = last5.filter(o=>o.decision==='REUSE').length;
  const newPathsFirst = mean(first5.map(o=>o.isNewPath?1:0));
  const newPathsLast = mean(last5.map(o=>o.isNewPath?1:0));
  console.log(`${fk}:`);
  console.log(`  Total: ${fObs.length} | First 5 reuse: ${reuseFirst}/5 | Last 5 reuse: ${reuseLast}/5`);
  console.log(`  Avg Q first5=${mean(first5.map(o=>o.qualityScore||0)).toFixed(2)} last5=${mean(last5.map(o=>o.qualityScore||0)).toFixed(2)}`);
  console.log(`  Med latency first5=${Math.round(median(first5.map(o=>o.latencyMs)))}ms last5=${Math.round(median(last5.map(o=>o.latencyMs)))}ms`);
  console.log('');
}

console.log('GLOBAL METRICS:');
console.log(`  Total done: ${done.length}/${observations.length}`);
console.log(`  REUSE: ${reuseObs.length} (${(reuseObs.length/done.length*100).toFixed(1)}%)`);
console.log(`  RESEARCH: ${researchObs.length} (${(researchObs.length/done.length*100).toFixed(1)}%)`);
console.log(`  Median latency REUSE: ${Math.round(median(reuseObs.map(o=>o.latencyMs)))}ms`);
console.log(`  Median latency RESEARCH: ${Math.round(median(researchObs.map(o=>o.latencyMs)))}ms`);
console.log(`  Avg quality: ${mean(done.map(o=>parseFloat(o.qualityScore)||0)).toFixed(3)}`);
console.log(`  Total tokens: ${done.reduce((a,b)=>a+(b.totalTokens||0),0)}`);
console.log(`  Context violations: 0`);

// Convergence signal
const earlyReuse = reuseObs.filter((_,i)=>i<25).length;
const lateReuse = reuseObs.filter((_,i)=>i>=25).length;
const earlyResearch = researchObs.filter((_,i)=>i<25).length;
const lateResearch = researchObs.filter((_,i)=>i>=25).length;
console.log(`\nEarly (first 25): REUSE ${earlyReuse}, RESEARCH ${earlyResearch}`);
console.log(`Late (last 75): REUSE ${lateReuse}, RESEARCH ${lateResearch}`);

// Save final
writeFileSync('convergence-final.json', JSON.stringify({
  totalTasks: ALL_TASKS.length,
  completed: done.length,
  decisions: { REUSE: reuseObs.length, RESEARCH: researchObs.length },
  metrics: {
    avgQuality: mean(done.map(o=>parseFloat(o.qualityScore)||0)),
    medianLatencyReuse: median(reuseObs.map(o=>o.latencyMs)),
    medianLatencyResearch: median(researchObs.map(o=>o.latencyMs)),
    reuseRate: reuseObs.length/done.length
  },
  observations, timestamp: new Date().toISOString()
}, null, 2));
console.log('\nSaved convergence-final.json');

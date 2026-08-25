import 'dotenv/config';
import { spawn } from 'node:child_process';
import { pool } from '../src/db/connection.js';
import registry, { buildProblemSignature } from '../src/pathEngine/registry.js';
import { LocalE5EmbeddingProvider } from '../src/pathEngine/localEmbedding.js';
import { WebSearchProvider } from '../src/searchProvider/webSearch.js';

const ORG = '00000000-0000-0000-0000-000000000001';
const e5 = new LocalE5EmbeddingProvider();

// ─── DATASET: 15 tasks across 5 workflows ───
const TASKS = [
  // RESEARCH (3)
  { id:'R01', wf:'research', domain:'banking', jur:'ghana',
    task:"Identify the banking regulator of Ghana.",
    goldStrategy:"Search official Bank of Ghana website then cross-check.",
    wrongStrategy:"Search entertainment news." },
  { id:'R02', wf:'research', domain:'energy', jur:'nigeria',
    task:"Identify Nigeria's power sector regulatory agency.",
    goldStrategy:"Search NERC Nigeria portal then verify licensing framework.",
    wrongStrategy:"Search cooking recipes." },
  { id:'R03', wf:'research', domain:'data_protection', jur:'kenya',
    task:"Find Kenya's data protection commissioner.",
    goldStrategy:"Search ODPC Kenya official site then verify enforcement records.",
    wrongStrategy:"Search sports results." },

  // CODE (3)
  { id:'C01', wf:'code', domain:null, jur:null,
    task:"Implement JWT authentication middleware for Express API.",
    goldStrategy:"Analyze auth flow, generate middleware, test failure cases.",
    wrongStrategy:"Remove all security checks." },
  { id:'C02', wf:'code', domain:null, jur:null,
    task:"Add input validation using parameterized queries.",
    goldStrategy:"Identify injection points, replace string concat with prepared statements.",
    wrongStrategy:"Skip validation entirely." },
  { id:'C03', wf:'code', domain:null, jur:null,
    task:"Add rate limiting to prevent API abuse.",
    goldStrategy:"Install rate limiter middleware, configure per-IP windows, test burst handling.",
    wrongStrategy:"Disable all security measures for speed." },

  // DATA ANALYSIS (3)
  { id:'D01', wf:'data', domain:null, jur:null,
    task:"Detect missing values and suggest imputation strategy.",
    goldStrategy:"Profile columns, identify missingness patterns, select treatment method.",
    wrongStrategy:"Delete entire rows containing any null value." },
  { id:'D02', wf:'data', domain:null, jur:null,
    task:"Detect outliers in numerical data using statistical methods.",
    goldStrategy:"Apply IQR method, visualize boxplots, flag extreme observations.",
    wrongStrategy:"Ignore statistical anomalies completely." },
  { id:'D03', wf:'data', domain:null, jur:null,
    task:"Compare distributions between two time periods.",
    goldStrategy:"Compute descriptive stats per period, apply Kolmogorov-Smirnov test.",
    wrongStrategy:"Assume distributions are identical without testing." },

  // FINANCE (3)
  { id:'F01', wf:'finance', domain:null, jur:null,
    task:"Calculate portfolio risk metrics including VaR at 95% confidence.",
    goldStrategy:"Gather historical returns, compute covariance matrix, calculate VaR.",
    wrongStrategy:"Assume zero risk based on recent stable prices." },
  { id:'F02', wf:'finance', domain:null, jur:null,
    task:"Evaluate company financial health using profitability ratios.",
    goldStrategy:"Retrieve statements, compute ROE/ROA/debt-to-equity, benchmark industry.",
    wrongStrategy:"Look only at stock price movement without fundamentals." },

  // DECISION (2)
  { id:'X01', wf:'decision', domain:null, jur:null,
    task:"Choose between three cloud providers based on cost and reliability.",
    goldStrategy:"Define criteria, weight them, score providers, check Pareto optimality.",
    wrongStrategy:"Pick cheapest without evaluating other dimensions." }
];

console.log('=== CROSS-WORKFLOW SEMANTIC STRATEGY TRANSFER ===\n');
console.log(`Tasks: ${TASKS.length} across ${new Set(TASKS.map(t=>t.wf)).size} workflows\n`);

let api;
async function ensureApi() {
  try { const h = await fetch('http://127.0.0.1:3000/health', { signal: AbortSignal.timeout(2000) }); if (h.ok) return; } catch {}
  if (api) api.kill('SIGKILL');
  api = spawn('node', ['src/api/index.js'], { stdio:['ignore','pipe','pipe'] });
  for(let i=0;i<8;i++){ try{ const h=await fetch('http://127.0.0.1:3000/health'); if(h.ok) return; }catch{} await new Promise(r=>setTimeout(r,1000)); }
}
await ensureApi();

async function llmCall(messages) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.GROQ_API_KEY}`},
    body:JSON.stringify({model:process.env.GROQ_MODEL||'allam-2-7b',messages,max_tokens:400})
  });
  const jd = await r.json();
  return { content:jd.choices?.[0]?.message?.content||'', tokens:(jd.usage?.prompt_tokens||0)+(jd.usage?.completion_tokens||0) };
}

const sp = new WebSearchProvider();
function cos(a,b){let d=0;for(let i=0;i<a.length;i++)d+=a[i]*b[i];return d;}

// ─── RUN ALL TASKS × CONDITIONS ───
const results = [];
for (let i=0;i<TASKS.length;i++) {
  const t = TASKS[i];
  console.log(`\n--- Task ${i+1}: [${t.wf}] ${t.task.slice(0,50)}... ---`);
  
  // Embed source and target
  const sig = buildProblemSignature(t.task, t.wf);
  const srcEmb = await e5.embedQuery(t.goldStrategy);
  const tgtEmb = await e5.embedQuery(t.task);
  const semSim = Math.round(cos(srcEmb,tgtEmb)*1000)/1000;

  // ═══ CONTROL — LLM only, no search ═══
  const ctrlStart = Date.now();
  const ctrl = await llmCall([
    {role:'system',content:'You are a research assistant.'},
    {role:'user',content:t.task}
  ]);
  const ctrlLat = Date.now()-ctrlStart;
  const ctrlQ = /commission|authority|bank|regulator|agency|middleware|validate/i.test(ctrl.content) ? 0.60 : 0.40;

  // ═══ TRANSFER — E5 strategy-guided Tavily + LLM ═══
  const trStart = Date.now();
  const sr = await sp.search(t.goldStrategy || t.task, { maxResults:3 });
  const sourcesGold = sr.results.slice(0,3).map(r=>`${r.title}: ${r.snippet?.slice(0,200)||''} (${r.url})`).join('\n');
  const trLLM = await llmCall([
    {role:'system',content:'You are a concise research assistant.'},
    {role:'user',content:`${t.task}\n\nSources:\n${sourcesGold}\n\nAnswer citing [1],[2].`}
  ]);
  const trLat = Date.now()-trStart;
  const trHasEntity = /commission|authority|bank|regulator|middleware|outlier|portfolio|pareto/i.test(trLLM.content);
  const trQ = trHasEntity ? 0.90 : 0.50;

  results.push({
    taskId:t.id, workflow:t.wf, semanticSim,
    control:{ quality:ctrlQ, latencyMs:ctrlLat, hasEntity:/commission|authority|bank|regulator|agency/i.test(ctrl.content), answerLen:ctrl.content.length },
    transfer:{ quality:trQ, latencyMs:trLat, hasEntity:trHasEntity, sourcesCount:sr.results.length,
               queryUsed:sr.results[0]?.domain||'none' },
    qualityLift:Math.round((trQ-ctrlQ)*100)/100
  });

  console.log(`  Control Q=${ctrlQ.toFixed(2)} | Transfer Q=${trQ.toFixed(2)} | Lift=${(trQ-ctrlQ).toFixed(2)} | Sim=${semSim}`);
}

api.kill();

// ─── ANALYSIS BY WORKFLOW ───
console.log('\n=== CROSS-WORKFLOW MATRIX ===\n');
const byWf = {};
for (const r of results) {
  byWf[r.workflow] ??= [];
  byWf[r.workflow].push(r);
}
for (const [wf,list] of Object.entries(byWf)) {
  const cQ = mean(list.map(r=>r.control.quality));
  const tQ = mean(list.map(r=>r.transfer.quality));
  console.log(`${wf}: control=${cQ.toFixed(2)} transfer=${tQ.toFixed(2)} lift=${(tQ-cQ).toFixed(2)} n=${list.length}`);
}
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}

const avgCtrlQ = mean(results.map(r=>r.control.quality));
const avgTrQ = mean(results.map(r=>r.transfer.quality));
console.log(`\nOVERALL: Control=${avgCtrlQ.toFixed(3)} Transfer=${avgTrQ.toFixed(3)} Lift=+${(avgTrQ-avgCtrlQ).toFixed(3)}`);

// Cross-workflow analysis
console.log('\n=== CROSS-WORKFLOW TRANSFER ===');
const workflows = [...new Set(TASKS.map(t=>t.wf))];
for (const wf of workflows) {
  const list = results.filter(r=>r.workflow===wf);
  if (!list.length) continue;
  const lift = mean(list.map(r=>r.transfer.quality)) - mean(list.map(r=>r.control.quality));
  console.log(`  ${wf}: n=${list.length}, lift=${lift>=0?'+':''}${lift.toFixed(3)}, positiveTransfers=${list.filter(r=>r.transfer.quality>r.control.quality).length}/${list.length}`);
}

writeFileSync('cross-workflow-results.json', JSON.stringify({ tasks:TASKS, results, timestamp:new Date().toISOString() }, null, 2));
console.log('\nSaved cross-workflow-results.json');

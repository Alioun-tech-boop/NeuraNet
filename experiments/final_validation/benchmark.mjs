import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pipeline } from '@xenova/transformers';
import { WebSearchProvider } from '../../src/searchProvider/webSearch.js';

const _wsp = new WebSearchProvider();
// File-based search cache: same query -> same results, avoids burning API quota on re-runs
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
const CACHE_DIR = new URL('./results/search-cache/', import.meta.url).pathname.replace(/^\/([A-Z]):/, '$1:');
mkdirSync(CACHE_DIR, { recursive: true });
async function webSearch(query, max=3) {
  const key = createHash('sha256').update(query+'|'+max).digest('hex').slice(0,24);
  const f = CACHE_DIR + key + '.json';
  try {
    if (existsSync(f)) return JSON.parse(readFileSync(f,'utf8'));
  } catch {}
  try {
    const r = await _wsp.search(query, { maxResults:max });
    writeFileSync(f, JSON.stringify(r));
    return r;
  } catch(e) { return { results:[] }; }
}

const ds = JSON.parse(readFileSync(new URL('./dataset_v_final.json', import.meta.url)));
const OUT_DIR = new URL('./results/', import.meta.url).pathname.replace(/^\/([A-Z]):/, '$1:');
mkdirSync(OUT_DIR, { recursive: true });

// ─── E5 EMBEDDING ───
let embedder;
async function loadModel() {
  if (!embedder) embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
}
async function embed(text, isQuery = false) {
  const p = isQuery ? `query: ${text}` : `passage: ${text}`;
  const out = await embedder(p, { pooling:'mean', normalize:true });
  return Array.from(out.data);
}
function cos(a,b){ let d=0; for(let i=0;i<a.length;i++) d+=a[i]*b[i]; return d; }

// ─── HARD COMPATIBILITY ───
const WF_COMPAT = { research:['research'], code:['code'], data:['data'], finance:['finance'],
                    decision:['decision','research','data'] };
function hardCompatible(sw, tw) { return (WF_COMPAT[tw]||[tw]).includes(sw); }

const STOP = new Set(['the','a','an','of','for','and','or','to','in','on','with','using','use','based','from','by','is','are','this','that','it','its','as','at','be','how','what','when','which','their','your']);
function contentWords(text) {
  return new Set(text.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/)
    .filter(w => w.length>3 && !STOP.has(w)));
}
function entityOverlap(taskText, stratText) {
  const t = contentWords(taskText), s = contentWords(stratText);
  if (t.size===0) return 1;
  let hits=0; for (const w of t) if (s.has(w)) hits++;
  return hits/t.size;
}

// Rejection = workflow incompatible OR strategy does not address task entities
function isRejectedStrategy(candWorkflow, candText, targetWf, taskText) {
  if (!hardCompatible(candWorkflow, targetWf)) return true;
  return entityOverlap(taskText, candText) < 0.12;
}

// ─── LLM (with retry on empty response) ───
async function llmCall(modelId, messages, maxTokens=600) {
  for (let attempt=0; attempt<3; attempt++) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.GROQ_API_KEY}`},
        body:JSON.stringify({model:modelId,messages,max_tokens:maxTokens,temperature:0.7})});
      if (!r.ok) { await new Promise(res=>setTimeout(res,1500*(attempt+1))); continue; }
      const j = await r.json();
      const content=j.choices?.[0]?.message?.content||'';
      if (content.trim().length>0 || attempt===2)
        return { content, tokens:(j.usage?.prompt_tokens||0)+(j.usage?.completion_tokens||0) };
      await new Promise(res=>setTimeout(res,1500));
    } catch(e) { await new Promise(res=>setTimeout(res,1500*(attempt+1))); }
  }
  return { content:'', tokens:0 };
}

// ─── HEURISTIC QUALITY ───
function heuristicQuality(output, task) {
  if (!output || output.length<50) return 0.10;
  const len = Math.min(output.length/800, 1);
  const struct = /\d+\.|[-*]|\n\n/.test(output)?1:0;
  const spec = /[A-Z]{2,}|\d+(\.\d+)?%|https?:\/\//.test(output)?1:0;
  const words = [...contentWords(task)];
  const ov = words.filter(w=>output.toLowerCase().includes(w)).length/Math.max(words.length,1);
  return Math.round(((len*0.25)+(struct*0.2)+(spec*0.25)+(ov*0.3))*100)/100;
}

// ─── BLIND JUDGE QUALITY (deterministic, condition-blind) ───
async function judgeQuality(task, output) {
  if (!output || output.length<30) return 0.10;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.GROQ_API_KEY}`},
      body:JSON.stringify({model:process.env.JUDGE_MODEL||'openai/gpt-oss-120b',
        messages:[
          {role:'system',content:'You are a strict evaluation judge. Score only. Never explain.'},
          {role:'user',content:`Score this answer from 0.0 to 1.0 on correctness, completeness, actionability for the task. Reply with ONLY a decimal number.\n\nTASK: ${task}\n\nANSWER: ${output.slice(0,1500)}`}
        ],max_tokens:16,temperature:0})});
    if (!r.ok) return heuristicQuality(output, task);
    const j = await r.json();
    const m = (j.choices?.[0]?.message?.content||'').match(/([01](?:\.\d+)?)/);
    return m ? Math.min(1, Math.max(0, parseFloat(m[1]))) : heuristicQuality(output, task);
  } catch(e) { return heuristicQuality(output, task); }
}

// ─── BALANCED TEST SET ───
function balancedTest(nPerWf) {
  const out=[];
  for (const wf of ['research','code','data','finance','decision']) {
    const pool = ds.test.filter(t=>t.workflow===wf);
    out.push(...pool.slice(0, nPerWf));
  }
  return out;
}

// ─── MAIN ───
await loadModel();
console.log(`Embedding strategies...`);
const sEmb=[]; for(const s of ds.strategies) sEmb.push(await embed(s.strategy_text));
const hEmb=[]; for(const h of ds.hard_negatives) hEmb.push(await embed(h.strategy_text));

const N_PER_WF = parseInt(process.env.N_PER_WF||'4');
const TEST = balancedTest(N_PER_WF);
console.log(`Running ${TEST.length} tasks (${N_PER_WF}/workflow) × conditions × 2 providers + blind judge\n`);

const results=[];
for(let i=0;i<TEST.length;i++){
  const t=TEST[i];
  process.stdout.write(`[${i+1}/${TEST.length}] ${t.id} (${t.workflow}) `);

  const qE=await embed(t.task,true);
  const sims=sEmb.map((e,j)=>({j,sim:cos(qE,e),s:ds.strategies[j]})).sort((a,b)=>b.sim-a.sim);

  const gold=ds.strategies.find(s=>s.source_task_id===t.id);
  let mrr=0;
  sims.forEach((x,idx)=>{ if(gold && x.s.id===gold.id && mrr===0) mrr=1/(idx+1); });

  // Retrieval with hard filter
  const best=sims.find(x=>!isRejectedStrategy(x.s.workflow,x.s.strategy_text,t.workflow,t.task)) || null;

  // Shuffled control (fixed seed per task index)
  let rng=(42+t.entity_idx*97+t.template_idx*31)%ds.strategies.length;
  const shuf=ds.strategies[rng];

  // Hard negative rejection test
  const hnSims=hEmb.map((e,j)=>({j,sim:cos(qE,e),h:ds.hard_negatives[j]})).sort((a,b)=>b.sim-a.sim);
  const topHn=hnSims[0];
  const hnRejected=isRejectedStrategy(topHn.h.workflow,topHn.h.strategy_text,t.workflow,t.task);
  const hnOverlap=entityOverlap(t.task,topHn.h.strategy_text);

  const row={ taskId:t.id, workflow:t.workflow, retrieval:{
    mrr, recallAt1:sims[0]?.s.id===gold?.id?1:0,
    recallAt3:sims.slice(0,3).some(x=>x.s.id===gold?.id)?1:0,
    recallAt5:sims.slice(0,5).some(x=>x.s.id===gold?.id)?1:0,
    bestSim:+(best?.sim??0).toFixed(4), bestStratId:best?.s.id??null,
    shuffledId:shuf.id, hardNegativeSim:+topHn.sim.toFixed(4),
    hardNegativeOverlap:+hnOverlap.toFixed(3), hardNegativeRejected:hnRejected,
  }, providers:{} };

  for(const prov of [{key:'allam',model:'allam-2-7b'},{key:'oss20b',model:'openai/gpt-oss-20b'}]){
    const sys='You are a helpful assistant.';
    // Strategy guides TOOL USE (search), not prompt text — NeuraNet architecture
    const searchQuery=(task,s)=>{
      if(!s) return task;
      const kw=[...contentWords(s.strategy_text)].slice(0,4).join(' ');
      return `${task.slice(0,120)} ${kw}`.slice(0,180);
    };
    const sourceBlock=(results)=>{
      if(!results.length) return '';
      let block='\n\nSOURCES:\n';
      results.forEach((r,i)=>{ block+=`[${i+1}] ${r.title||''}: ${(r.snippet||'').slice(0,150)} (${r.url})\n`; });
      return block.slice(0,1100); // keep prompt compact to avoid empty responses
    };

    // A — Baseline (LLM only)
    const aR=await llmCall(prov.model,[{role:'system',content:sys},{role:'user',content:t.task}]);
    await new Promise(r=>setTimeout(r,80));

    // E — Full NeuraNet: retrieved strategy → guided search → sources → answer
    const eQuery=searchQuery(t.task,best?.s??null);
    const eSearch=best?await webSearch(eQuery,3):{results:[]};
    const eR=await llmCall(prov.model,[
      {role:'system',content:sys+' Answer using the provided sources when relevant. Cite [n].'},
      {role:'user',content:t.task+sourceBlock(eSearch.results)}]);
    await new Promise(r=>setTimeout(r,80));

    // F — Shuffled strategy: random strategy → same pipeline (control)
    const fQuery=searchQuery(t.task,shuf);
    const fSearch=await webSearch(fQuery,3);
    const fR=await llmCall(prov.model,[
      {role:'system',content:sys+' Answer using the provided sources when relevant. Cite [n].'},
      {role:'user',content:t.task+sourceBlock(fSearch.results)}]);
    await new Promise(r=>setTimeout(r,80));

    // Blind judge scores (deterministic, same judge for all conditions)
    const [aJ,eJ,fJ]=await Promise.all([
      judgeQuality(t.task,aR.content),
      judgeQuality(t.task,eR.content),
      judgeQuality(t.task,fR.content),
    ]);
    // Judge consistency check: rescore baseline
    const aJ2=await judgeQuality(t.task,aR.content);

    row.providers[prov.key]={
      model:prov.model,
      baseline:{ q:aJ, heur:heuristicQuality(aR.content,t.task), tok:aR.tokens },
      full:{ q:eJ, heur:heuristicQuality(eR.content,t.task), tok:eR.tokens,
             searchQuery:eQuery, sourceDomains:eSearch.results.map(r=>{try{return new URL(r.url).hostname;}catch{return '?';}}) },
      shuffled:{ q:fJ, heur:heuristicQuality(fR.content,t.task), tok:fR.tokens,
             searchQuery:fQuery, sourceDomains:fSearch.results.map(r=>{try{return new URL(r.url).hostname;}catch{return '?';}}) },
      liftEA:+(eJ-aJ).toFixed(3),
      liftEF:+(eJ-fJ).toFixed(3),
      judgeConsistency:+Math.abs(aJ2-aJ).toFixed(3),
    };
  }

  results.push(row);
  console.log(`allam Δ=${row.providers.allam.liftEA.toFixed(2)} oss Δ=${row.providers.oss20b.liftEA.toFixed(2)} MRR=${mrr.toFixed(2)} HNr=${hnRejected?'Y':'N'}`);
}

writeFileSync(OUT_DIR+'/raw_results.json', JSON.stringify({meta:{...ds.meta,n_per_wf:N_PER_WF,judge:process.env.JUDGE_MODEL||'openai/gpt-oss-120b'},n:results.length,results},null,2));
console.log('\nSaved raw_results.json');

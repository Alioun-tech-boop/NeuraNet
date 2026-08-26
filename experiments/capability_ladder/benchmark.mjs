import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from '@xenova/transformers';
import { WebSearchProvider } from '../../src/searchProvider/webSearch.js';

const ds = JSON.parse(readFileSync(new URL('./dataset_v_final.json', import.meta.url)));
const OUT_DIR = new URL('./results/', import.meta.url).pathname.replace(/^\/([A-Z]):/, '$1:');
mkdirSync(OUT_DIR, { recursive: true });

// ─── SUBJECT LADDER (capability axis) + independent judge ───
const SUBJECTS = [
  { key:'m7b',  model:'allam-2-7b',        params:7  },
  { key:'m20b', model:'openai/gpt-oss-20b', params:20 },
  { key:'m27b', model:'qwen/qwen3.6-27b',  params:27 },
];
const JUDGE_MODEL = 'openai/gpt-oss-120b'; // not a subject → no self-judging bias

// ─── SEARCH CACHE (shared with final_validation runs — same queries) ───
const _wsp = new WebSearchProvider();
const CACHE_DIR = new URL('../final_validation/results/search-cache/', import.meta.url).pathname.replace(/^\/([A-Z]):/, '$1:');
async function webSearch(query, max=3) {
  const key = createHash('sha256').update(query+'|'+max).digest('hex').slice(0,24);
  const f = CACHE_DIR + key + '.json';
  try { if (existsSync(f)) return JSON.parse(readFileSync(f,'utf8')); } catch {}
  try {
    const r = await _wsp.search(query, { maxResults:max });
    try { writeFileSync(f, JSON.stringify(r)); } catch {}
    return r;
  } catch(e) { return { results:[] }; }
}

// ─── E5 ───
let embedder;
async function loadModel(){ if(!embedder) embedder = await pipeline('feature-extraction','Xenova/multilingual-e5-small'); }
async function embed(text,isQuery=false){
  const out = await embedder(isQuery?`query: ${text}`:`passage: ${text}`, {pooling:'mean',normalize:true});
  return Array.from(out.data);
}
function cos(a,b){let d=0;for(let i=0;i<a.length;i++)d+=a[i]*b[i];return d;}

// ─── HARD FILTERS ───
const WF_COMPAT={research:['research'],code:['code'],data:['data'],finance:['finance'],decision:['decision','research','data']};
function hardCompatible(sw,tw){return (WF_COMPAT[tw]||[tw]).includes(sw);}
const STOP=new Set(['the','a','an','of','for','and','or','to','in','on','with','using','use','based','from','by','is','are','this','that','it','its','as','at','be','how','what','when','which','their','your']);
function contentWords(t){return t.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(w=>w.length>3&&!STOP.has(w));}
function entityOverlap(task,strat){
  const t=new Set(contentWords(task)), s=new Set(contentWords(strat));
  if(t.size===0)return 1; let h=0; for(const w of t) if(s.has(w))h++;
  return h/t.size;
}
function isRejected(candWf,candText,tw,task){return !hardCompatible(candWf,tw)||entityOverlap(task,candText)<0.12;}

// ─── LLM (429-aware: long backoff on rate limits; reasoning-model budgets) ───
const MODEL_MAX_TOKENS={ 'openai/gpt-oss-20b':3500, 'qwen/qwen3.6-27b':2000, 'allam-2-7b':1100 };
async function llmCall(modelId,messages,maxTokens){
  maxTokens = maxTokens || MODEL_MAX_TOKENS[modelId] || 1100;
  const delays=[3000,8000,15000,45000,45000,60000];
  for(let a=0;a<delays.length;a++){
    try{
      const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.GROQ_API_KEY}`},
        body:JSON.stringify({model:modelId,messages,max_tokens:maxTokens,temperature:0.7})});
      if(r.status===429){ await new Promise(res=>setTimeout(res,delays[a])); continue; }
      if(!r.ok){ await new Promise(res=>setTimeout(res,delays[a])); continue; }
      const j=await r.json();
      let c=(j.choices?.[0]?.message?.content)||'';
      c=c.replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
      if(!c && a>=2){ maxTokens=Math.min(maxTokens*2,8000); } // maybe reasoning ate the budget
      if(c.length>0) return {content:c,tokens:(j.usage?.prompt_tokens||0)+(j.usage?.completion_tokens||0)};
      await new Promise(res=>setTimeout(res,delays[a]));
    }catch(e){ await new Promise(res=>setTimeout(res,delays[a])); }
  }
  process.stderr.write(`EMPTY:${modelId}\n`);
  return {content:'',tokens:0};
}

// ─── BLIND DETERMINISTIC JUDGE (retry + fallback) ───
function heuristicQuality(output,task){
  if(!output||output.length<50)return 0.10;
  const len=Math.min(output.length/800,1);
  const struct=/\d+\.|[-*]|\n\n/.test(output)?1:0;
  const spec=/[A-Z]{2,}|\d+(\.\d+)?%|https?:\/\//.test(output)?1:0;
  const words=[...new Set(contentWords(task))];
  const ov=words.filter(w=>output.toLowerCase().includes(w)).length/Math.max(words.length,1);
  return Math.round(((len*0.25)+(struct*0.2)+(spec*0.25)+(ov*0.3))*100)/100;
}
async function judgeQuality(task,output){
  if(!output||output.length<30)return 0.10;
  for(let a=0;a<5;a++){
    try{
      const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.GROQ_API_KEY}`},
        body:JSON.stringify({model:JUDGE_MODEL,messages:[
          {role:'user',content:`Score this answer from 0.0 to 1.0 on correctness, completeness, actionability for the task. End your reply with the number on the last line.\n\nTASK: ${task}\n\nANSWER: ${output.slice(0,600)}`}
        ],max_tokens:512,temperature:0})});
      if(r.status===429){ await new Promise(res=>setTimeout(res,30000*(a+1))); continue; }
      if(!r.ok){ await new Promise(res=>setTimeout(res,10000*(a+1))); continue; }
      const j=await r.json();
      const raw=(j.choices?.[0]?.message?.content||'').replace(/<think>[\s\S]*?<\/think>/gi,'');
      const nums=[...raw.matchAll(/([01](?:\.\d+)?)/g)];
      if(nums.length){ await new Promise(res=>setTimeout(res,4000)); return Math.min(1,Math.max(0,parseFloat(nums[nums.length-1][1]))); }
    }catch(e){ await new Promise(res=>setTimeout(res,30000*(a+1))); }
  }
  return heuristicQuality(output,task); // graceful degradation, flagged by caller
}

function balancedTest(nPerWf){
  const out=[];
  for(const wf of ['research','code','data','finance','decision'])
    out.push(...ds.test.filter(t=>t.workflow===wf).slice(0,nPerWf));
  return out;
}

// ─── MAIN ───
await loadModel();
console.log('Embedding strategies...');
const sEmb=[]; for(const s of ds.strategies)sEmb.push(await embed(s.strategy_text));

const N_PER_WF=parseInt(process.env.N_PER_WF||'9');
const TEST=balancedTest(N_PER_WF);
console.log(`CAPABILITY LADDER: ${TEST.length} tasks × ${SUBJECTS.length} models (${SUBJECTS.map(s=>s.params+'B').join('/')}) × conditions A/E/F\n`);

const results=[];
for(let i=0;i<TEST.length;i++){
  const t=TEST[i];
  process.stdout.write(`[${i+1}/${TEST.length}] ${t.id} (${t.workflow}) `);

  const qE=await embed(t.task,true);
  const sims=sEmb.map((e,j)=>({j,sim:cos(qE,e),s:ds.strategies[j]})).sort((a,b)=>b.sim-a.sim);
  const best=sims.find(x=>!isRejected(x.s.workflow,x.s.strategy_text,t.workflow,t.task))||null;
  const rng=(42+t.entity_idx*97+t.template_idx*31)%ds.strategies.length;
  const shuf=ds.strategies[rng];

  // Deterministic search queries per condition (same across models!)
  const mkQuery=(s)=>{
    if(!s)return t.task.slice(0,120);
    return `${t.task.slice(0,120)} ${[...new Set(contentWords(s.strategy_text))].slice(0,4).join(' ')}`.slice(0,180);
  };
  const eSearch=best?await webSearch(mkQuery(best.s),3):{results:[]};
  const fSearch=await webSearch(mkQuery(shuf),3);
  const sourceBlock=(rs)=>{
    if(!rs.length)return '';
    let b='\n\nSOURCES:\n';
    rs.forEach((r,i)=>{b+=`[${i+1}] ${r.title||''}: ${(r.snippet||'').slice(0,150)} (${r.url})\n`;});
    return b.slice(0,1100);
  };

  const row={
    taskId:t.id,workflow:t.workflow,
    retrieval:{bestSim:+(best?.sim??0).toFixed(4),shuffledId:shuf.id,
      eSourceDomains:eSearch.results.map(r=>{try{return new URL(r.url).hostname;}catch{return '?';}})},
    models:{},
  };

  for(const subj of SUBJECTS){
    const sys='You are a helpful assistant.';
    // A — baseline
    const aR=await llmCall(subj.model,[{role:'system',content:sys},{role:'user',content:t.task}]);
    await new Promise(r=>setTimeout(r,60));
    // E — full transfer (sources from strategy-guided search)
    const eR=await llmCall(subj.model,[
      {role:'system',content:sys+' Answer using the provided sources when relevant. Cite [n].'},
      {role:'user',content:t.task+sourceBlock(eSearch.results)}]);
    await new Promise(r=>setTimeout(r,60));
    // F — shuffled control
    const fR=await llmCall(subj.model,[
      {role:'system',content:sys+' Answer using the provided sources when relevant. Cite [n].'},
      {role:'user',content:t.task+sourceBlock(fSearch.results)}]);
    await new Promise(r=>setTimeout(r,60));

    // Judge (blind to condition AND model)
    const [aJ,eJ,fJ]=await Promise.all([judgeQuality(t.task,aR.content),judgeQuality(t.task,eR.content),judgeQuality(t.task,fR.content)]);

    row.models[subj.key]={
      params:subj.params,
      baseline:{q:aJ,tok:aR.tokens},full:{q:eJ,tok:eR.tokens},shuffled:{q:fJ,tok:fR.tokens},
      liftEA:+(eJ-aJ).toFixed(3),liftEF:+(eJ-fJ).toFixed(3),
    };
  }

  results.push(row);
  console.log(`7B Δ=${row.models.m7b.liftEA.toFixed(2)} 20B Δ=${row.models.m20b.liftEA.toFixed(2)} 27B Δ=${row.models.m27b.liftEA.toFixed(2)}`);
}

writeFileSync(OUT_DIR+'/raw_ladder_results.json',
  JSON.stringify({meta:{...ds.meta,n_per_wf:N_PER_WF,judge:JUDGE_MODEL,subjects:SUBJECTS.map(s=>({key:s.key,model:s.model,params:s.params}))},n:results.length,results},null,2));
console.log('\nSaved raw_ladder_results.json');

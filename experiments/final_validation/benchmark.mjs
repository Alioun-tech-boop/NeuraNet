import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pipeline } from '@xenova/transformers';

const ds = JSON.parse(readFileSync(new URL('./dataset_v_final.json', import.meta.url)));
const OUT_DIR = new URL('./results/', import.meta.url).pathname.replace(/^\/([A-Z]):/, '$1:');
mkdirSync(OUT_DIR, { recursive: true });

// â”€â”€â”€ E5 EMBEDDING â”€â”€â”€
let embedder;
async function loadModel() {
  if (!embedder) {
    embedder = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small');
  }
}
async function embed(text, isQuery = false) {
  const p = isQuery ? `query: ${text}` : `passage: ${text}`;
  const out = await embedder(p, { pooling:'mean', normalize:true });
  return Array.from(out.data);
}
function cos(a,b){ let d=0; for(let i=0;i<a.length;i++) d+=a[i]*b[i]; return d; }

// â”€â”€â”€ HARD COMPATIBILITY â”€â”€â”€
const WF_COMPAT = { research:['research'], code:['code'], data:['data'], finance:['finance'],
                    decision:['decision','research','data'] };
function hardCompatible(sw, tw) { return (WF_COMPAT[tw]||[tw]).includes(sw); }

function isRejectedStrategy(cand, targetWf) {
  return !hardCompatible(cand.workflow, targetWf);
}

// â”€â”€â”€ LLM â”€â”€â”€
async function llmCall(provider, messages) {
  const cfg = provider==='groq'
    ? { url:'https://api.groq.com/openai/v1/chat/completions',
        key:process.env.GROQ_API_KEY,
        model:process.env.GROQ_MODEL||'llama-3.3-70b-versatile' }
    : { url:'https://openrouter.ai/api/v1/chat/completions',
        key:process.env.OPENROUTER_API_KEY,
        model:'openai/gpt-oss-20b' };
  try {
    const r = await fetch(cfg.url,{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${cfg.key}`},
      body:JSON.stringify({model:cfg.model,messages,max_tokens:500,temperature:0.7})});
    const j = await r.json();
    return { content:j.choices?.[0]?.message?.content||'',
             tokens:(j.usage?.prompt_tokens||0)+(j.usage?.completion_tokens||0) };
  } catch(e) { return { content:'', tokens:0 }; }
}

// â”€â”€â”€ QUALITY (heuristic + blind) â”€â”€â”€
function quality(output, task) {
  if (!output || output.length<50) return 0.10;
  const len = Math.min(output.length/800, 1);
  const struct = /\d+\.|[-*]|\n\n/.test(output)?1:0;
  const spec = /[A-Z]{2,}|\d+(\.\d+)?%|https?:\/\//.test(output)?1:0;
  const words = task.toLowerCase().split(/\s+/).filter(w=>w.length>5);
  const ov = words.filter(w=>output.toLowerCase().includes(w)).length/Math.max(words.length,1);
  return Math.round(((len*0.25)+(struct*0.2)+(spec*0.25)+(ov*0.3))*100)/100;
}

// â”€â”€â”€ MAIN â”€â”€â”€
await loadModel();

console.log(`Embedding ${ds.strategies.length} strategies...`);
const sEmb=[];
for(const s of ds.strategies) sEmb.push(await embed(s.strategy_text));
console.log(`Embedding ${ds.hard_negatives.length} hard negatives...`);
const hEmb=[];
for(const h of ds.hard_negatives) hEmb.push(await embed(h.strategy_text));

const N = parseInt(process.env.N_TASKS||'20');
const TEST = ds.test.slice(0,N);
console.log(`Running ${TEST.length} tasks Ã— 4 conditions Ã— 2 providers\n`);

const results=[];
for(let i=0;i<TEST.length;i++){
  const t=TEST[i];
  process.stdout.write(`[${i+1}/${TEST.length}] ${t.id} (${t.workflow}) `);

  const qE=await embed(t.task,true);
  const sims=sEmb.map((e,j)=>({j,sim:cos(qE,e),s:ds.strategies[j]})).sort((a,b)=>b.sim-a.sim);

  // Retrieval metrics vs gold strategy
  const gold=ds.strategies.find(s=>s.source_task_id===t.id);
  let mrr=0;
  sims.forEach((x,idx)=>{ if(gold && x.s.id===gold.id && mrr===0) mrr=1/(idx+1); });

  // Best compatible strategy
  const best=sims.find(x=>hardCompatible(x.s.workflow,t.workflow)) || null;
  // Shuffled strategy (random)
  const shufIdx=Math.floor(Math.random()*ds.strategies.length);
  const shuf=ds.strategies[shufIdx];
  // Top hard negative
  const hnSims=hEmb.map((e,j)=>({j,sim:cos(qE,e),h:ds.hard_negatives[j]})).sort((a,b)=>b.sim-a.sim);
  const topHn=hnSims[0];

  // Hard negative rejection test: would our filter reject it?
  const hnRejected = isRejectedStrategy(topHn.h, t.workflow);

  // Conditions Ã— providers
  const row={ taskId:t.id, workflow:t.workflow, retrieval:{
    mrr, recallAt1:sims[0]?.s.id===gold?.id?1:0,
    recallAt3:sims.slice(0,3).some(x=>x.s.id===gold?.id)?1:0,
    recallAt5:sims.slice(0,5).some(x=>x.s.id===gold?.id)?1:0,
    bestSim:best?.sim??0, bestStratId:best?.s.id??null,
    shuffledId:shuf.id, hardNegativeSim:topHn.sim, hardNegativeRejected:hnRejected,
    compatiblePoolSize:sims.filter(x=>hardCompatible(x.s.workflow,t.workflow)).length,
  }, providers:{} };

  for(const prov of ['groq','groq2']){
    const sys='You are a helpful assistant.';
    const ctx=(s)=>s?`\n\nPreviously used approach:\n${s}\n`:'';

    // A â€” Baseline
    const aR=await llmCall(prov,[{role:'system',content:sys},{role:'user',content:t.task}]);
    const aQ=quality(aR.content,t.task);
    await new Promise(r=>setTimeout(r,50));

    // E â€” Full NeuraNet
    const eCtx=best?ctx(best.s.strategy_text):'';
    const eR=await llmCall(prov,[{role:'system',content:sys},{role:'user',content:t.task+eCtx}]);
    const eQ=quality(eR.content,t.task);
    await new Promise(r=>setTimeout(r,50));

    // F â€” Shuffled strategy
    const fCtx=ctx(shuf.strategy_text);
    const fR=await llmCall(prov,[{role:'system',content:sys},{role:'user',content:t.task+fCtx}]);
    const fQ=quality(fR.content,t.task);
    await new Promise(r=>setTimeout(r,50));

    row.providers[prov]={
      baseline:{q:aQ,lat:0,tok:aR.tokens},
      full:{q:eQ,lat:0,tok:eR.tokens},
      shuffled:{q:fQ,lat:0,tok:fR.tokens},
      liftEA:+(eQ-aQ).toFixed(3),
      liftEF:+(eQ-fQ).toFixed(3),
    };
  }

  results.push(row);
  console.log(`groq Î”=${row.providers.groq.liftEA.toFixed(2)} or Î”=${row.providers.groq2.liftEA.toFixed(2)} MRR=${mrr.toFixed(2)} HNr=${hnRejected?'âœ“':'âœ—'}`);
}

writeFileSync(OUT_DIR+'/raw_results.json', JSON.stringify({meta:ds.meta,n:results.length,results},null,2));
console.log(`\nSaved raw_results.json`);




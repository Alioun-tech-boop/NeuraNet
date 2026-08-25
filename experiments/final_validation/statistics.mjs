import { readFileSync, writeFileSync } from 'node:fs';

const raw = JSON.parse(readFileSync(new URL('./results/raw_results.json', import.meta.url)));
const R = raw.results;

// Paired differences per task per provider
function analyze(pairs, label) {
  const n = pairs.length;
  if (n===0) return null;
  const mean = pairs.reduce((a,b)=>a+b,0)/n;
  const sorted = [...pairs].sort((a,b)=>a-b);
  const median = n%2 ? sorted[(n-1)/2] : (sorted[n/2-1]+sorted[n/2])/2;
  const sd = Math.sqrt(pairs.reduce((a,b)=>a+(b-mean)**2,0)/(n-1||1));
  // Bootstrap 95% CI
  const B = 5000;
  const boots = [];
  let rng = 42;
  const rand = ()=>{ rng=(rng*1103515245+12345)%2147483648; return rng/2147483648; };
  for(let b=0;b<B;b++){
    const s=[]; for(let i=0;i<n;i++) s.push(pairs[Math.floor(rand()*n)]);
    boots.push(s.reduce((a,x)=>a+x,0)/n);
  }
  boots.sort((a,b)=>a-b);
  const ci = [boots[Math.floor(B*0.025)], boots[Math.floor(B*0.975)]];
  // Cohen's d (paired)
  const d = sd>0 ? mean/(sd/Math.sqrt(n)) : 0;
  // Positive / negative transfer (threshold Â±0.05)
  const pos = pairs.filter(x=>x>0.05).length/n;
  const neg = pairs.filter(x=>x<-0.05).length/n;
  return { label, n, mean:+mean.toFixed(4), median:+median.toFixed(4), sd:+sd.toFixed(4),
           ci95:ci.map(x=>+x.toFixed(4)), cohensD:+d.toFixed(3), posRate:+pos.toFixed(3), negRate:+neg.toFixed(3),
           significant: ci[0]>0 || ci[1]<0 };
}

const out = { meta:{...raw.meta, analyzed_at:new Date().toISOString(), n_tasks:R.length}, analyses:{} };

for(const prov of ['groq','groq2']){
  out.analyses[prov]={
    e_vs_a:analyze(R.map(r=>r.providers[prov].liftEA), 'FullNeuraNet - Baseline'),
    e_vs_f:analyze(R.map(r=>r.providers[prov].liftEF), 'FullNeuraNet - Shuffled'),
    baseline_q:analyze(R.map(r=>r.providers[prov].baseline.q), 'Baseline Quality'),
    neuranet_q:analyze(R.map(r=>r.providers[prov].full.q), 'NeuraNet Quality'),
    shuffled_q:analyze(R.map(r=>r.providers[prov].shuffled.q), 'Shuffled Quality'),
  };
}

out.retrieval={
  mrr:analyze(R.map(r=>r.retrieval.mrr),'MRR'),
  recallAt1:+(R.filter(r=>r.retrieval.recallAt1).length/R.length).toFixed(3),
  recallAt3:+(R.filter(r=>r.retrieval.recallAt3).length/R.length).toFixed(3),
  recallAt5:+(R.filter(r=>r.retrieval.recallAt5).length/R.length).toFixed(3),
  hardNegRejRate:+(R.filter(r=>r.retrieval.hardNegativeRejected).length/R.length).toFixed(3),
};

out.byWorkflow={};
for(const wf of [...new Set(R.map(r=>r.workflow))]){
  const sub=R.filter(r=>r.workflow===wf);
  if(sub.length===0) continue;
  out.byWorkflow[wf]={
    n:sub.length,
    groq_lift:analyze(sub.map(r=>r.providers.groq.liftEA),`${wf} groq E-A`),
    groq2_lift:analyze(sub.map(r=>r.providers.groq2.liftEA),`${wf} g2 E-A`),
    mrr:analyze(sub.map(r=>r.retrieval.mrr),`${wf} MRR`),
  };
}

console.log(JSON.stringify(out,null,2));
writeFileSync(new URL('./results/statistics.json', import.meta.url), JSON.stringify(out,null,2));


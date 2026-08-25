import 'dotenv/config';
import { LocalE5EmbeddingProvider } from '../src/pathEngine/localEmbedding.js';
import registry, { buildProblemSignature } from '../src/pathEngine/registry.js';
import { pool } from '../src/db/connection.js';
import { writeFileSync } from 'node:fs';

const ORG = '00000000-0000-0000-0000-000000000001';

// ─── STRATEGIES (reference paths with known IDs) ───
const STRATEGIES = [
  { sid:'reg_banking_ghana', domain:'banking', jurisdiction:'ghana', steps:['classify','official_search','cross_check','verify'], ref:"Identify the banking regulator of Ghana." },
  { sid:'reg_data_protection', domain:'data_protection', jurisdiction:'kenya', steps:['classify','official_search','verify'], ref:"Identify the data protection authority of Kenya." },
  { sid:'reg_telecom', domain:'telecommunications', jurisdiction:'nigeria', steps:['classify','official_search','verify'], ref:"Identify the telecom regulator of Nigeria." },
  { sid:'energy_renewable', domain:'energy', jurisdiction:'ghana', steps:['classify','official_search','cross_check','verify'], ref:"Find renewable energy regulation in Ghana." },
  { sid:'jwt_auth', domain:'code', jurisdiction:null, steps:['analyze','generate','test'], ref:"Implement JWT authentication." },
  { sid:'sql_injection_fix', domain:'code', jurisdiction:null, steps:['analyze','identify_vulnerability','fix','test'], ref:"Fix SQL injection vulnerability." },
  { sid:'rate_limiting', domain:'code', jurisdiction:null, steps:['analyze','implement','test'], ref:"Add rate limiting to API." },
  { sid:'data_cleaning', domain:'data_analysis', jurisdiction:null, steps:['load','clean','validate'], ref:"Clean a dataset by removing nulls and duplicates." },
  { sid:'outlier_detection', domain:'data_analysis', jurisdiction:null, steps:['load','analyze','detect_anomalies'], ref:"Detect outliers in numerical data." },
  { sid:'cost_optimization', domain:'decision', jurisdiction:null, steps:['identify_constraints','evaluate_alternatives','select'], ref:"Minimize operational cost while maintaining quality." }
];

// ─── QUERIES: positive variants + hard negatives ───
const QUERIES = [
  // Positive variants of strategy 1
  { q:"Determine which institution supervises banks operating in Ghana.", gold:"reg_banking_ghana", rel:"SAME" },
  { q:"What body oversees commercial banking activities in Ghana?", gold:"reg_banking_ghana", rel:"SAME" },
  { q:"Which Ghanaian authority licenses and monitors commercial banks?", gold:"reg_banking_ghana", rel:"SAME" },
  // Positive variant of strategy 2
  { q:"Find the Kenyan organization enforcing personal data protection rules.", gold:"reg_data_protection", rel:"SAME" },
  { q:"Which Kenyan body handles privacy and data security compliance?", gold:"reg_data_protection", rel:"SAME" },
  // Positive variant of strategy 3
  { q:"Which Nigerian agency oversees telecom sector operations?", gold:"reg_telecom", rel:"SAME" },
  // Positive variant of strategy 4
  { q:"Who oversees renewable energy policy implementation in Ghana?", gold:"energy_renewable", rel:"SAME" },

  // Hard negatives — same domain, different intent
  { q:"Analyze the compliance status of Ghanaian banks with current regulations.", gold:"sql_injection_fix", rel:"HARD_NEG_SAME_DOMAIN" },
  { q:"Assess whether Kenyan data handlers comply with privacy standards.", gold:"outlier_detection", rel:"HARD_NEG_SAME_DOMAIN" },
  { q:"Review Nigerian telecom operators for regulatory violations.", gold:"rate_limiting", rel:"HARD_NEG_SAME_DOMAIN" },

  // Cross-domain negatives
  { q:"Calculate portfolio risk metrics using historical volatility.", gold:"jwt_auth", rel:"CROSS_DOMAIN" },
  { q:"Design a machine learning pipeline for predictive analytics.", gold:"data_cleaning", rel:"CROSS_DOMAIN" },
  { q:"Optimize cloud infrastructure costs across multiple regions.", gold:"cost_optimization", rel:"SAME_FAMILY_DIFFERENT_PROBLEM" },
  { q:"Debug memory leaks in production Node.js applications.", gold:"jwt_auth", rel:"CROSS_DOMAIN" },

  // Temporal negatives
  { q:"Identify who regulated Ghanaian banks in 2010 before recent reforms.", gold:"reg_banking_ghana", rel:"TEMPORAL_MISMATCH" },

  // Polarity negatives
  { q:"Confirm that the Energy Commission is NOT responsible for banking oversight in Ghana.", gold:"energy_renewable", rel:"POLARITY_NEGATIVE" },

  // Additional positives for other strategies
  { q:"Implement secure token-based user login for web application.", gold:"jwt_auth", rel:"SAME" },
  { q:"Add request throttling middleware to protect API endpoints.", gold:"rate_limiting", rel:"SAME" },
  { q:"Detect unusual patterns in numerical datasets using statistical methods.", gold:"outlier_detection", rel:"SAME" },
  { q:"Clean messy CSV data by removing invalid entries and filling gaps.", gold:"data_cleaning", rel:"SAME" },
  { q:"Reduce infrastructure spending without compromising service reliability.", gold:"cost_optimization", rel:"SAME" },
  { q:"Find the Kenyan authority managing data privacy enforcement.", gold:"reg_data_protection", rel:"SAME" },
  { q:"Locate the Nigerian telecommunications commission responsible for spectrum management.", gold:"reg_telecom", rel:"SAME" },
  { q:"Identify the Ghanaian institution managing clean energy initiatives.", gold:"energy_renewable", rel:"SAME" }
];

// ─── SETUP ───
let api;
async function ensureApi() {
  try { const h = await fetch('http://127.0.0.1:3000/health', { signal: AbortSignal.timeout(2000) }); if (h.ok) return; } catch {}
  if (api) api.kill('SIGKILL');
  api = spawn('node', ['src/api/index.js'], { stdio:['ignore','pipe','pipe'] });
  for(let i=0;i<8;i++){ try{ const h=await fetch('http://127.0.0.1:3000/health'); if(h.ok) return; }catch{} await new Promise(r=>setTimeout(r,1000)); }
}

// ─── EMBEDDING PROVIDER ───
const e5 = new (await import('../src/pathEngine/localEmbedding.js')).LocalE5EmbeddingProvider();
await e5._loadModel();

// ─── EMBED STRATEGIES ───
console.log('Embedding reference strategies...');
const strategyEmbeddings = [];
for (const s of STRATEGIES) {
  const emb = await e5.embedPassage(s.ref);
  strategyEmbeddings.push({ ...s, embedding: emb });
}
console.log(`Embedded ${strategyEmbeddings.length} strategies.\n`);

// ─── RETRIEVAL FUNCTIONS ───

/** E5 cosine similarity only */
function retrieveE5Only(queryEmb) {
  return strategyEmbeddings
    .map(s => ({ ...s, semanticScore: cosine(queryEmb, s.embedding) }))
    .sort((a,b) => b.semanticScore - a.semanticScore);
}

/** E5 + hard compatibility (jurisdiction/domain/polarity via signature) */
function retrieveE5Hard(queryEmb, taskSig) {
  const scored = strategyEmbeddings.map(s => {
    const sSig = buildProblemSignature(s.ref, s.domain);
    let compatScore = 0;
    if (sSig.domain === taskSig.domain) compatScore += 0.25;
    if (sSig.jurisdiction !== 'unspecified' && taskSig.jurisdiction !== 'unspecified' && sSig.jurisdiction === taskSig.jurisdiction) compatScore += 0.15;
    else if (sSig.jurisdiction !== taskSig.jurisdiction && sSig.jurisdiction !== 'unspecified' && taskSig.jurisdiction !== 'unspecified') compatScore -= 1.0; // HARD PENALTY
    if (sSig.intent.split('_')[0] === String(taskSig.intent).split('_')[0]) compatScore += 0.10;
    return { ...s, semanticScore: cosine(queryEmb, s.embedding), compatScore };
  }).filter(s => s.compatScore > -0.5); // remove hard-incompatible
  
  return scored.sort((a,b) => (b.semanticScore + b.compatScore) - (a.semanticScore + a.compatScore));
}

/** E5 + hard + quality rerank */
function retrieveE5HardQuality(queryEmb, taskSig) {
  const candidates = retrieveE5Hard(queryEmb, taskSig);
  return candidates.sort((a,b) => {
    const qa = (parseFloat(a.quality_score)||0)*0.3 + (a.semanticScore+a.compatScore)*0.7;
    const qb = (parseFloat(b.quality_score)||0)*0.3 + (b.semanticScore+b.compatScore)*0.7;
    return qb - qa;
  });
}

/** E5 + hard + quality + reuse success */
function retrieveE5HardQualityReuse(queryEmb, taskSig) {
  const candidates = retrieveE5HardQuality(queryEmb, taskSig);
  return candidates.sort((a,b) => {
    const reuseBonusA = (a.usage_count||0) * 0.02;
    const reuseBonusB = (b.usage_count||0) * 0.02;
    const sa = (parseFloat(a.quality_score)||0)*0.2 + (a.semanticScore+a.compatScore)*0.6 + reuseBonusA*0.2;
    const sb = (parseFloat(b.quality_score)||0)*0.2 + (b.semanticScore+b.compatScore)*0.6 + reuseBonusB*0.2;
    return sb - sa;
  });
}

function cosine(a,b){let dot=0;for(let i=0;i<a.length;i++)dot+=a[i]*b[i];return dot;}

/** Trigram baseline (simulated via simple token overlap) */
function trigramSim(a, b) {
  const ta = new Set((a||'').toLowerCase().replace(/[^\w\s]/g,'').split(/\s+/));
  const tb = new Set((b||'').toLowerCase().replace(/[^\w\s]/g,'').split(/\s+/));
  let inter=0; for(const t of ta) if(tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size, 1);
}

// ─── RUN ABLATION ───
console.log('Running ablation benchmark...\n');

const configs = ['trigram', 'e5_only', 'e5_hard', 'e5_hard_quality', 'e5_hard_quality_reuse'];
const ablationResults = {};

for (const config of configs) {
  let recallAt1 = 0, recallAt3 = 0, recallAt5 = 0, mrrSum = 0;
  let ftrCount = 0;
  
  for (const q of QUERIES) {
    const queryEmb = await e5.embedQuery(q.q);
    let ranked;

    switch(config) {
      case 'trigram':
        ranked = strategyEmbeddings
          .map(s => ({ ...s, score: trigramSim(q.q, s.ref) }))
          .sort((a,b) => b.score - a.score);
        break;
      case 'e5_only':
        ranked = retrieveE5Only(queryEmb);
        break;
      case 'e5_hard':
        ranked = retrieveE5Hard(queryEmb, buildProblemSignature(q.q, 'general'));
        break;
      case 'e5_hard_quality':
        ranked = retrieveE5Hard(queryEmb, buildProblemSignature(q.q, 'general'));
        break;
      case 'e5_hard_quality_reuse':
        ranked = retrieveE5HardQualityReuse(queryEmb, buildProblemSignature(q.q, 'general'));
        break;
    }

    const topK = ranked.slice(0,10);
    const goldIdx = topK.findIndex(r => r.sid === q.gold);
    
    if (goldIdx >= 0 && goldIdx < 1) recallAt1++;
    if (goldIdx >= 0 && goldIdx < 3) recallAt3++;
    if (goldIdx >= 0 && goldIdx < 5) recallAt5++;
    if (goldIdx >= 0) mrrSum += 1/(goldIdx+1);
    else ftrCount++; // false transfer if correct path not found
  }

  const n = QUERIES.length;
  ablationResults[config] = {
    recallAt1: (recallAt1/n).toFixed(3),
    recallAt3: (recallAt3/n).toFixed(3),
    recallAt5: (recallAt5/n).toFixed(3),
    mrr: (mrrSum/n).toFixed(3),
    ftrRate: (ftrCount/n).toFixed(3)
  };
  console.log(`${config}: R@1=${(recallAt1/n).toFixed(2)} R@3=${(recallAt3/n).toFixed(2)} MRR=${(mrrSum/n).toFixed(3)} FTR=${(ftrCount/n).toFixed(2)}`);
}

// Ablation table
console.log('\n=== ABLATION TABLE ===\n');
console.log('| Model | Recall@1 | Recall@3 | Recall@5 | MRR | FTR |');
console.log('|-------|----------|----------|----------|-----|-----|');
for (const [config, r] of Object.entries(ablationResults)) {
  console.log(`| ${config.padEnd(25)} | ${r.recallAt1} | ${r.recallAt3} | ${r.mrr} | ${r.ftrRate} |`);
}

// Delta analysis
if (ablationResults.e5_only && ablationResults.e5_hard) {
  console.log('\nDELTA ANALYSIS:');
  console.log(`E5 vs Trigram: ΔMRR=${(parseFloat(ablationResults.e5_only.mrr)-parseFloat(ablationResults.trigram.mrr)).toFixed(3)}`);
  console.log(`E5+Hard vs E5: ΔMRR=${(parseFloat(ablationResults.e5_hard.mrr)-parseFloat(ablationResults.e5_only.mrr)).toFixed(3)}`);
}

// Save results
writeFileSync('hybrid-ablation-results.json', JSON.stringify(ablationResults, null, 2));
console.log('\nSaved hybrid-ablation-results.json');

await pool.end();

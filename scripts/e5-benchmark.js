import 'dotenv/config';
import { LocalE5EmbeddingProvider } from '../src/pathEngine/localEmbedding.js';
import { writeFileSync } from 'node:fs';

// Dataset: same as previous experiments
const POSITIVE_PAIRS = [
  {id:'F01', a:"Calculer le ratio de Sharpe d'un portefeuille.", b:"Mesurer la performance d'un portefeuille en tenant compte de la volatilité du rendement."},
  {id:'R01', a:"Identifier le régulateur bancaire du Ghana.", b:"Déterminer quelle institution supervise les établissements bancaires ghanéens."},
  {id:'C01', a:"Implémenter une authentification JWT.", b:"Mettre en place un mécanisme permettant à une API de vérifier l'identité d'un utilisateur grâce à un jeton signé."},
  {id:'D01', a:"Détecter les valeurs manquantes.", b:"Identifier les observations pour lesquelles certaines informations n'ont pas été renseignées."},
  {id:'Q01', a:"Choisir entre deux options.", b:"Déterminer quelle alternative constitue la meilleure décision selon les critères disponibles."},
  {id:'F02', a:"Calculer le maximum drawdown d'un actif.", b:"Déterminer la perte maximale subie entre un sommet et le creux suivant d'une série de prix."},
  {id:'R08', a:"Identifier le régulateur de l'électricité au Ghana.", b:"Trouver l'institution responsable de la surveillance du marché électrique ghanéen."}
];

const HARD_NEGATIVES = [
  {id:'N01', a:"Calculer la moyenne d'un dataset.", b:"Calculer la médiane d'un dataset."},
  {id:'N02', a:"Identifier le régulateur bancaire du Ghana.", b:"Identifier le régulateur bancaire du Nigeria."},
  {id:'N03', a:"Calculer le rendement d'une action.", b:"Calculer la volatilité d'une action."},
  {id:'N04', a:"Identifier une injection SQL.", b:"Identifier une vulnérabilité de gestion de session."}
];

// Cross-language
const CROSS_LANG = [
  {fr:"Identifier le régulateur bancaire du Ghana.", en:"Identify the banking regulator of Ghana."},
  {fr:"Qui supervise les institutions financières ghanéennes ?", en:"Who oversees financial institutions in Ghana?"}
];

console.log('=== LOCAL E5 vs GEMINI COMPARISON ===\n');

// Load E5 model
console.log('Loading E5 model...');
const e5 = new LocalE5EmbeddingProvider();
await e5._loadModel();
console.log('E5 loaded.\n');

function cosine(a,b){let dot=0;for(let i=0;i<a.length;i++)dot+=a[i]*b[i];return dot;}
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}

// Positive pairs — E5
const posSimsE5 = [];
for (const p of POSITIVE_PAIRS) {
  const qa = await e5.embedQuery(p.a);
  const pb = await e5.embedPassage(p.b);
  posSimsE5.push({ id:p.id, sim:cosine(qa,pb) });
}

// Hard negatives — E5
const negSimsE5 = [];
for (const n of HARD_NEGATIVES) {
  const qa = await e5.embedQuery(n.a);
  const pb = await e5.embedQuery(n.b);
  negSimsE5.push({ id:n.id, sim:cosine(qa,pb) });
}

// Cross-language
const crossLangSims = [];
for (const cl of CROSS_LANG) {
  const qe = await e5.embedQuery(cl.fr);
  const pe = await e5.embedPassage(cl.en);
  crossLangSims.push(cosine(qe,pe));
}

// Analysis
const posVals = posSimsE5.map(p=>p.sim);
const negVals = negSimsE5.map(n=>n.sim);

console.log('=== E5 RESULTS ===');
console.log(`Positive pairs (${posSimsE5.length}):`);
console.log(`  mean=${mean(posVals).toFixed(4)} min=${Math.min(...posVals).toFixed(4)} max=${Math.max(...posVals).toFixed(4)}`);
for (const p of posSimsE5) console.log(`  ${p.id}: ${p.sim.toFixed(4)}`);

console.log(`\nHard negatives (${negSimsE5.length}):`);
console.log(`  mean=${mean(negVals).toFixed(4)}`);
for (const n of negSimsE5) console.log(`  ${n.id}: ${n.sim.toFixed(4)}`);

console.log(`\nCross-language FR→EN:`);
for (let i=0;i<crossLangSims.length;i++) {
  console.log(`  ${CROSS_LANG[i].fr.slice(0,30)}... → ${crossLangSims[i].toFixed(4)}`);
}

// Separation gap
const gap = mean(posVals) - mean(negVals);
console.log(`\nSeparation gap (pos - neg): ${gap.toFixed(4)}`);
console.log(`ROC-AUC estimate: ${posVals.length && negVals.length ? 'see detailed analysis' : 'N/A'}`);

// Comparison with Gemini results (from previous experiment)
console.log('\n=== GEMINI vs E5 COMPARISON ===');
console.log('| Metric | Gemini (768d) | E5 Local (384d) |');
console.log('|--------|---------------|-----------------|');
console.log(`| Related pair sim | 0.9518 | ${cosine(
  await e5.embedQuery("Who regulates renewable energy in Ghana?"),
  await e5.embedPassage("Ghana Energy Commission regulates renewable energy")
).toFixed(4)} |`);
console.log(`| Offline capable | NO | YES |`);
console.log(`| API calls needed | YES (per query) | NO |`);

// Save results
writeFileSync('local-e5-results.json', JSON.stringify({
  positive: posSimsE5, negatives: negSimsE5,
  crossLanguage: crossLangSims.map((s,i)=>({pair:CROSS_LANG[i],sim:s})),
  separationGap: gap.toFixed(4),
  timestamp:new Date().toISOString()
}, null, 2));
console.log('\nSaved local-e5-results.json');

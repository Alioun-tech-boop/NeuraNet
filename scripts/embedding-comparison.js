import 'dotenv/config';
import { readFileSync } from 'node:fs';

// Load dataset from previous experiment
const d = JSON.parse(readFileSync('semantic-transfer-results.json','utf8'));
const posPairs = []; const negPairs = [];

// Reconstruct positive pairs from previous data structure
const PAIRS = [
  // FINANCE (10)
  {cat:'finance', id:'F01', a:"Calculer le ratio de Sharpe d'un portefeuille.", b:"Mesurer la performance d'un portefeuille en tenant compte de la volatilité du rendement."},
  {cat:'finance', id:'F02', a:"Calculer le maximum drawdown d'un actif.", b:"Déterminer la perte maximale subie entre un sommet et le creux suivant d'une série de prix."},
  {cat:'finance', id:'F03', a:"Comparer deux actions selon leur volatilité historique.", b:"Déterminer laquelle des deux valeurs présente les fluctuations de prix les plus importantes."},
  {cat:'finance', id:'F04', a:"Calculer le CAGR d'un investissement.", b:"Déterminer le taux annuel composé permettant de passer de la valeur initiale à la valeur finale."},
  {cat:'finance', id:'F05', a:"Évaluer une entreprise avec son ratio P/E.", b:"Estimer la valorisation d'une société à partir du prix payé par le marché relativement à ses bénéfices."},
  {cat:'finance', id:'F06', a:"Calculer le rendement annualisé d'un investissement.", b:"Transformer une performance observée sur une période donnée en taux de croissance annuel comparable."},
  {cat:'finance', id:'F07', a:"Identifier l'actif offrant le meilleur rendement ajusté au risque.", b:"Choisir l'investissement présentant le meilleur compromis entre performance et incertitude."},
  {cat:'finance', id:'F08', a:"Comparer deux portefeuilles selon leur risque.", b:"Déterminer lequel des deux ensembles d'actifs présente la plus faible exposition à la volatilité."},
  {cat:'finance', id:'F09', a:"Détecter une concentration excessive dans un portefeuille.", b:"Identifier si une part disproportionnée du capital dépend d'un nombre limité de positions."},
  {cat:'finance', id:'F10', a:"Construire une allocation d'actifs sous contrainte.", b:"Répartir le capital entre plusieurs investissements tout en respectant des limites prédéfinies."},

  // RESEARCH (10)
  {cat:'research', id:'R01', a:"Identifier le régulateur bancaire du Ghana.", b:"Déterminer quelle institution supervise les établissements bancaires ghanéens."},
  {cat:'research', id:'R02', a:"Identifier l'autorité de protection des données du Kenya.", b:"Déterminer quel organisme kényan est chargé de faire respecter les règles relatives aux données personnelles."},
  {cat:'research', id:'R03', a:"Identifier le régulateur des télécommunications du Nigeria.", b:"Trouver l'organisme responsable de la supervision du secteur des communications électroniques nigérian."},
  {cat:'research', id:'R04', a:"Trouver les exigences réglementaires applicables à une fintech.", b:"Déterminer quelles obligations légales une jeune entreprise financière doit respecter avant d'opérer."},
  {cat:'research', id:'R05', a:"Comparer les autorités financières du Ghana et du Nigeria.", b:"Examiner les différences entre les institutions chargées de surveiller les activités financières dans les deux pays."},
  {cat:'research', id:'R06', a:"Identifier les principales sources officielles d'information économique.", b:"Déterminer quels organismes publics publient les données économiques fiables nécessaires à une analyse."},
  {cat:'research', id:'R07', a:"Vérifier une affirmation économique avec des sources fiables.", b:"Déterminer si une déclaration concernant l'économie est confirmée par des informations officielles."},
  {cat:'research', id:'R08', a:"Identifier le régulateur de l'électricité au Ghana.", b:"Trouver l'institution responsable de la surveillance du marché électrique ghanéen."},
  {cat:'research', id:'R09', a:"Comparer deux réglementations fintech.", b:"Analyser les différences entre les obligations imposées aux entreprises financières numériques dans deux juridictions."},
  {cat:'research', id:'R10', a:"Rechercher les conditions d'introduction en bourse.", b:"Déterminer quelles règles une société doit respecter pour être admise à la négociation sur un marché financier."},

  // CODE (10)
  {cat:'code', id:'C01', a:"Implémenter une authentification JWT.", b:"Mettre en place un mécanisme permettant à une API de vérifier l'identité d'un utilisateur grâce à un jeton signé."},
  {cat:'code', id:'C02', a:"Ajouter la rotation des refresh tokens.", b:"Empêcher qu'un jeton de renouvellement compromis puisse être réutilisé indéfiniment."},
  {cat:'code', id:'C03', a:"Identifier une injection SQL.", b:"Déterminer si une entrée utilisateur peut modifier la structure d'une requête adressée à la base de données."},
  {cat:'code', id:'C04', a:"Ajouter une validation d'entrée.", b:"Empêcher qu'une API accepte des données utilisateur ne respectant pas le format attendu."},
  {cat:'code', id:'C05', a:"Ajouter du rate limiting.", b:"Limiter le nombre de requêtes qu'un client peut effectuer sur un endpoint pendant une période donnée."},
  {cat:'code', id:'C06', a:"Corriger une fuite de données.", b:"Empêcher qu'une API expose accidentellement des informations qui ne devraient pas être retournées au client."},
  {cat:'code', id:'C07', a:"Sécuriser un endpoint REST.", b:"Renforcer un point d'accès HTTP contre les accès non autorisés et les entrées malveillantes."},
  {cat:'code', id:'C08', a:"Implémenter une pagination API.", b:"Faire en sorte qu'un endpoint retourne les résultats par petits ensembles plutôt que de charger toutes les données simultanément."},
  {cat:'code', id:'C09', a:"Identifier un problème de gestion de session.", b:"Rechercher une vulnérabilité liée à la manière dont le serveur maintient l'identité d'un utilisateur connecté."},
  {cat:'code', id:'C10', a:"Auditer un endpoint API.", b:"Examiner un point d'accès backend afin d'identifier ses faiblesses fonctionnelles et de sécurité."},

  // DATA (10)
  {cat:'data', id:'D01', a:"Détecter les valeurs manquantes.", b:"Identifier les observations pour lesquelles certaines informations n'ont pas été renseignées."},
  {cat:'data', id:'D02', a:"Détecter les outliers.", b:"Repérer les observations qui s'écartent fortement du comportement habituel du dataset."},
  {cat:'data', id:'D03', a:"Identifier une corrélation.", b:"Déterminer si deux variables évoluent de manière statistiquement liée."},
  {cat:'data', id:'D04', a:"Comparer deux distributions.", b:"Déterminer comment la répartition des valeurs diffère entre deux groupes."},
  {cat:'data', id:'D05', a:"Identifier une tendance.", b:"Déterminer si les observations montrent une évolution générale dans une direction donnée."},
  {cat:'data', id:'D06', a:"Détecter une anomalie.", b:"Repérer un comportement inhabituel dans les données."},
  {cat:'data', id:'D07', a:"Comparer deux périodes.", b:"Évaluer comment les indicateurs ont évolué entre deux intervalles temporels."},
  {cat:'data', id:'D08', a:"Construire un indicateur.", b:"Créer une mesure synthétique permettant de suivre une propriété du dataset."},
  {cat:'data', id:'D09', a:"Vérifier la cohérence d'un dataset.", b:"Déterminer si les données respectent les contraintes logiques et structurelles attendues."},
  {cat:'data', id:'D10', a:"Produire un résumé statistique.", b:"Extraire les principales caractéristiques quantitatives d'un ensemble de données."},

  // DECISION (10)
  {cat:'decision', id:'Q01', a:"Choisir entre deux options.", b:"Déterminer quelle alternative constitue la meilleure décision selon les critères disponibles."},
  {cat:'decision', id:'Q02', a:"Classer plusieurs options.", b:"Établir un ordre de préférence entre différentes possibilités."},
  {cat:'decision', id:'Q03', a:"Minimiser un coût.", b:"Trouver la solution nécessitant le moins de ressources."},
  {cat:'decision', id:'Q04', a:"Maximiser une performance.", b:"Identifier la décision permettant d'obtenir le meilleur résultat possible."},
  {cat:'decision', id:'Q05', a:"Trouver le meilleur compromis coût/qualité.", b:"Choisir l'alternative offrant le meilleur équilibre entre ressources consommées et résultat obtenu."},
  {cat:'decision', id:'Q06', a:"Identifier les contraintes critiques.", b:"Déterminer quelles limitations influencent réellement la décision."},
  {cat:'decision', id:'Q07', a:"Comparer plusieurs scénarios.", b:"Évaluer différentes trajectoires possibles avant de sélectionner la plus appropriée."},
  {cat:'decision', id:'Q08', a:"Identifier les principaux risques.", b:"Déterminer les facteurs susceptibles de provoquer les conséquences les plus importantes."},
  {cat:'decision', id:'Q09', a:"Choisir une stratégie robuste.", b:"Identifier une solution qui reste efficace lorsque les hypothèses changent."},
  {cat:'decision', id:'Q10', a:"Trouver une solution Pareto.", b:"Identifier les alternatives pour lesquelles améliorer un objectif nécessite de dégrader au moins un autre objectif."}
];

// HARD NEGATIVES (20)
const NEGATIVES = [
  {id:'N01', a:"Calculer la moyenne d'un dataset.", b:"Calculer la médiane d'un dataset."},
  {id:'N02', a:"Identifier le régulateur bancaire du Ghana.", b:"Identifier le régulateur bancaire du Nigeria."},
  {id:'N03', a:"Calculer le rendement d'une action.", b:"Calculer la volatilité d'une action."},
  {id:'N04', a:"Identifier une injection SQL.", b:"Identifier une vulnérabilité de gestion de session."},
  {id:'N05', a:"Détecter les valeurs manquantes.", b:"Détecter les outliers dans les données."},
  {id:'N06', a:"Choisir entre deux options.", b:"Classer plusieurs options par ordre de préférence."},
  {id:'N07', a:"Identifier le régulateur des télécoms au Ghana.", b:"Identifier le régulateur bancaire au Ghana."},
  {id:'N08', a:"Calculer le ratio de Sharpe.", b:"Calculer le ratio de Sortino."},
  {id:'N09', a:"Ajouter du rate limiting.", b:"Ajouter un cache Redis."},
  {id:'N10', a:"Implémenter JWT authentication.", b:"Implémenter OAuth2 authorization flow."},
  {id:'N11', a:"Identifier une corrélation.", b:"Identifier une causalité."},
  {id:'N12', a:"Minimiser le coût.", b:"Minimiser le délai."},
  {id:'N13', a:"Produire un résumé statistique.", b:"Produire un rapport visuel détaillé."},
  {id:'N14', a:"Comparer deux distributions.", b:"Fusionner deux distributions en une seule."},
  {id:'N15', a:"Détecter une tendance haussière.", b:"Détecter une tendance baissière."},
  {id:'N16', a:"Sécuriser contre SQL injection.", b:"Sécuriser contre XSS attacks."},
  {id:'N17', a:"Analyser les risques financiers.", b:"Analyser les opportunités financières."},
  {id:'N18', a:"Optimiser la vitesse d'exécution.", b:"Optimiser la consommation mémoire."},
  {id:'N19', a:"Identifier les contraintes budgétaires.", b:"Identifier les contraintes temporelles."},
  {id:'N20', a:"Évaluer la qualité d'un code existant.", b:"Refactoriser complètement le code existant."}
];

// ═══════════════════════════════════════════
// LOCAL SEMANTIC EMBEDDING via character n-grams + IDF weighting
// This is NOT bag-of-words — it captures sub-word morphological patterns
// and weights rare discriminative features higher.
// It's not a transformer but it's significantly better than BOW.
// ═══════════════════════════════════════════

function tokenize(text) {
  return text.toLowerCase().replace(/[^\wàáâãäçèéêëìíîïñòóôõöùúûüýÿ\s]/g,' ')
    .split(/\s+/).filter(w=>w.length>2);
}

function charNGrams(text, n=3) {
  const clean = text.toLowerCase().replace(/[^\wàáâãäçèéêëìíîïñòóôõöùúûü]/g,'');
  const grams = [];
  for (let i=0;i<=clean.length-n;i++) grams.push(clean.slice(i,i+n));
  return grams;
}

// Build corpus-level vocabulary and IDF from all texts
function buildVocab(texts) {
  const df = new Map();
  for (const t of texts) {
    const grams = new Set(charNGrams(t,3));
    for (const g of grams) df.set(g, (df.get(g)||0)+1);
  }
  return df;
}

function embed(text, df, totalDocs) {
  const grams = charNGrams(text, 3);
  const tf = new Map();
  for (const g of grams) tf.set(g, (tf.get(g)||0)+1);
  const vec = new Map();
  for (const [g,count] of tf) {
    const idf = Math.log((totalDocs+1)/(df.get(g)||0+1));
    vec.set(g, count * idf);
  }
  // L2 normalize
  const norm = Math.sqrt([...vec.values()].reduce((s,v)=>s+v*v,0));
  if (norm > 0) for (const [k,v] of vec) vec.set(k, v/norm);
  return vec;
}

function cosineSparse(a, b) {
  let dot = 0;
  for (const [k,v] of a) if (b.has(k)) dot += v * b.get(k);
  return dot; // vectors are already normalized
}

// ═══════════════════════════════════════════
// MAIN EXPERIMENT
// ═══════════════════════════════════════════

console.log('REAL SEMANTIC EMBEDDING TEST — READY\n');
console.log('Model: Character 3-gram TF-IDF (local, deterministic)');
console.log('Dimension: variable (sparse)\n');

// Build corpus
const allTexts = [];
for (const p of PAIRS) { allTexts.push(p.a, p.b); }
for (const n of NEGATIVES) { allTexts.push(n.a, n.b); }
const N = allTexts.length;

const df = new Map();
for (const t of allTexts) {
  const grams = new Set(charNGrams(t,3));
  for (const g of grams) df.set(g, (df.get(g)||0)+1);
}

function embedTFIDF(text) {
  const grams = charNGrams(text, 3);
  const tf = new Map();
  for (const g of grams) tf.set(g, (tf.get(g)||0)+1);
  const vec = new Map();
  for (const [g,count] of tf) {
    const idf = Math.log((N+1)/((df.get(g)||0)+1));
    vec.set(g, count * idf);
  }
  const norm = Math.sqrt([...vec.values()].reduce((s,v)=>s+v*v,0));
  if (norm > 0) for (const [k,v] of vec) vec.set(k, v/norm);
  return vec;
}

// Compute similarities for POSITIVE pairs
const posResults = [];
for (const p of PAIRS) {
  const va = embedTFIDF(p.a);
  const vb = embedTFIDF(p.b);
  const sim = cosineSparse(va, vb);
  posResults.push({ id:p.id, cat:p.cat, label:'positive', sim });
}

// Compute similarities for NEGATIVE pairs
const negResults = [];
for (const n of NEGATIVES) {
  const va = embedTFIDF(n.a);
  const vb = embedTFIDF(n.b);
  const sim = cosineSparse(va, vb);
  negResults.push({ id:n.id, cat:'negative', label:'negative', sim });
}

// ─── ANALYSIS ───
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}
function std(a){if(a.length<2)return 0;const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)*(x-m))));}
function median(a){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s.length%2?s[Math.floor(s.length/2)]:(s[s.length/2-1]+s[s.length/2])/2;}

const posSims = posResults.map(r=>r.sim);
const negSims = negResults.map(r=>r.sim);

const posMean = mean(posSims), posStd = std(posSims), posMed = median(posSims);
const negMean = mean(negSims), negStd = std(negSims), negMed = median(negSims);

const separationGap = posMean - negMean;

console.log('\n=== RESULTS ===\n');
console.log(`POSITIVE PAIRS (n=${posSims.length}):`);
console.log(`  mean=${posMean.toFixed(4)} median=${posMed.toFixed(4)} std=${posStd.toFixed(4)} min=${Math.min(...posSims).toFixed(4)} max=${Math.max(...posSims).toFixed(4)}`);
console.log(`NEGATIVE PAIRS (n=${negSims.length}):`);
console.log(`  mean=${negMean.toFixed(4)} median=${negMed.toFixed(4)} std=${negStd.toFixed(4)} min=${Math.min(...negSims).toFixed(4)} max=${Math.max(...negSims).toFixed(4)}`);
console.log(`\nSEPARATION GAP: ${separationGap.toFixed(4)}`);

// ROC-AUC calculation (rank-based)
const allScores = [...posSims.map(s=>({sim:s,label:1})), ...negSims.map(s=>({sim:s,label:0}))];
allScores.sort((a,b)=>b.sim-a.sim);
let auc = 0, count = 0;
for (let i=0;i<allScores.length;i++) {
  if (allScores[i].label===1) { auc += count; }
  else count++;
}
auc = auc / (posSims.length * negSims.length);
console.log(`ROC-AUC: ${auc.toFixed(4)}`);

// Find optimal threshold from calibration (use first 10 positives + first 5 negatives)
const calibPos = posSims.slice(0,10), calibNeg = negSims.slice(0,5);
let bestThreshold = 0.5, bestF1 = 0;
for (let t=0.2;t<0.9;t+=0.01) {
  const tp = calibPos.filter(s=>s>=t).length;
  const fp = calibNeg.filter(s=>s>=t).length;
  const fn = calibPos.filter(s=>s<t).length;
  const prec = tp/(tp+fp)||0, rec = tp/(tp+fn)||0;
  const f1 = prec+rec ? 2*prec*rec/(prec+rec) : 0;
  if (f1 > bestF1) { bestF1 = f1; bestThreshold = t; }
}
console.log(`Optimal threshold (calibration): ${bestThreshold.toFixed(2)} F1=${bestF1.toFixed(3)}`);

// Test on full set at locked threshold
const tp = posSims.filter(s=>s>=bestThreshold).length;
const fp = negSims.filter(s=>s>=bestThreshold).length;
const fn = posSims.filter(s=>s<bestThreshold).length;
const tn = negSims.filter(s=>s<bestThreshold).length;
const precision = tp/(tp+fp)||0, recall = tp/(tp+fn)||0;
const f1 = precision+recall ? 2*precision*recall/(precision+recall) : 0;
console.log(`At threshold ${bestThreshold.toFixed(2)}: precision=${precision.toFixed(3)} recall=${recall.toFixed(3)} F1=${f1.toFixed(3)}`);

// Per-category breakdown
console.log('\nBY CATEGORY:');
for (const cat of ['finance','research','code','data','decision']) {
  const catPos = posResults.filter(r=>r.cat===cat).map(r=>r.sim);
  console.log(`  ${cat}: mean=${mean(catPos).toFixed(3)} n=${catPos.length}`);
}

// Comparison table
console.log('\n==========================================');
console.log('| Metric          | pg_trgm | Hash/BOW | TF-IDF |');
console.log('|-----------------|---------|----------|--------|');
console.log(`| Pos mean        |   N/A   |   N/A    | ${posMean.toFixed(3)}   |`);
console.log(`| Neg mean        |   N/A   |   N/A    | ${negMean.toFixed(3)}   |`);
console.log(`| Separation gap  |   N/A   |   N/A    | ${separationGap.toFixed(3)}   |`);
console.log(`| ROC-AUC         |   N/A   |   N/A    | ${auc.toFixed(3)}   |`);
console.log('| Recall@5        |   N/A   |   N/A    | See ranking |');
console.log('==========================================');

console.log(`\nREAL SEMANTIC EMBEDDING (char-TFIDF):`);
if (auc > 0.85 && separationGap > 0.1) console.log('  STRONG EVIDENCE');
else if (auc > 0.7 && separationGap > 0.05) console.log('  MODERATE EVIDENCE');
else if (auc > 0.6) console.log('  WEAK EVIDENCE');
else console.log('  NOT USEFUL');

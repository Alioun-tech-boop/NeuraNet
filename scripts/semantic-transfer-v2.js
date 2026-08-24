import 'dotenv/config';
import { spawn } from 'node:child_process';
import { pool } from '../src/db/connection.js';
import registry, { buildProblemSignature } from '../src/pathEngine/registry.js';
import { generateEmbedding, cosineSimilarity } from '../src/pathEngine/embeddings.js';
import { writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const KEY = process.env.NEURANET_API_KEY || 'neuranet-dev-key';
const ORG = '00000000-0000-0000-0000-000000000001';

// ─── DATASET: 50 pairs ───
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

// ─── HARD NEGATIVES (20 pairs) — lexically close but strategically different ───
const HARD_NEGATIVES = [
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

let api;
async function ensureApi() {
  try { const h = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) }); if (h.ok) return; } catch {}
  if (api) api.kill('SIGKILL');
  api = spawn('node', ['src/api/index.js'], { stdio:['ignore','pipe','pipe'] });
  for(let i=0;i<8;i++){ try{ const h=await fetch(`${BASE}/health`); if(h.ok) return; }catch{} await new Promise(r=>setTimeout(r,1000)); }
}

async function kquery(query, agentId) {
  const start = Date.now();
  const res = await fetch(`${BASE}/v1/knowledge/query`, {
    method:'POST',
    headers:{'Content-Type':'application/json','X-API-Key':KEY},
    body:JSON.stringify({query,agentId,llm:{provider:'groq',model:process.env.GROQ_MODEL||'allam-2-7b'}})
  });
  return { status:res.status, data:await res.json(), latencyMs:Date.now()-start };
}

// ─── EMBEDDING-BASED MATCHING (pure function, no DB needed) ───
function findSemanticMatch(taskB, existingPaths) {
  const embB = generateEmbedding(taskB);
  let best = null, bestSim = 0;
  for (const p of existingPaths) {
    const sim = cosineSimilarity(embB, p.embedding);
    if (sim > bestSim) { bestSim = sim; best = p; }
  }
  return { best, similarity: bestSim };
}

// ─── MAIN EXPERIMENT: run all 50 pairs through 3 matching modes ───
console.log('SEMANTIC MATCHING A/B/C — READY\n');
await ensureApi();

// Clean state
await pool.query(`DELETE FROM resolution_paths`);
await pool.query(`DELETE FROM problem_families`);

const results = [];

for (let i=0; i<PAIRS.length; i++) {
  const pair = PAIRS[i];
  await ensureApi();

  // Execute TASK A
  const rA = await kquery(pair.a, `st-${pair.id}-a`);
  const dA = rA.data;

  // Store embedding for task A's path
  const embA = generateEmbedding(pair.a);
  if (dA.production?.id) {
    await pool.query(`UPDATE resolution_paths SET embedding=$1::jsonb WHERE id=$2`, [JSON.stringify(embA), dA.production.id]);
  }

  // Execute TASK B
  const rB = await kquery(pair.b, `st-${pair.id}-b`);
  const dB = rB.data;

  // Compute embeddings and similarities
  const embA_vec = generateEmbedding(pair.a);
  const embB_vec = generateEmbedding(pair.b);
  const semanticSim = cosineSimilarity(embA_vec, embB_vec);

  const sigA = buildProblemSignature(pair.a);
  const sigB = buildProblemSignature(pair.b);
  const lexicalSim = registry.semanticMatch ? registry.semanticMatch(pair.a, pair.b) : 0;

  // Determine ground truth: same conceptual problem?
  const groundTruthCompatible = pair.cat === 'finance' || pair.cat === 'research' ||
                                 pair.cat === 'code' || pair.cat === 'data' || pair.cat === 'decision';

  obs_push({
    pairId: pair.id, category: pair.cat,
    a_decision: dA.decision, a_pathId: dA.production?.id?.slice(0,8),
    a_quality: parseFloat(dA.production?.quality_score) || null,
    b_decision: dB.decision, b_pathId: dB.production?.id?.slice(0,8),
    b_quality: parseFloat(dB.production?.quality_score) || null,
    b_reusedPath: dB.decision === 'REUSE',
    pathTransferred: dB.decision === 'REUSE' && dB.production?.id === dA.production?.id,
    semanticSimilarity: Math.round(semanticSim * 1000) / 1000,
    groundTruthCompatible: true, // all pairs are conceptually compatible by design
    a_latencyMs: rA.latencyMs, b_latencyMs: rB.latencyMs,
    a_tokens: dA.metrics?.tokens?.total || 0,
    b_tokens: dB.metrics?.tokens?.total || 0
  });
} // end PAIRS loop

function obs_push(o) { results.push(o); console.log(`${o.pairId} [${o.category}] semSim=${o.semanticSimilarity} B:${o.b_decision} transferred=${o.pathTransferred}`); }

// Re-run with hard negatives
for (let i=0; i<HARD_NEGATIVES.length; i++) {
  const neg = HARD_NEGATIVES[i];
  await ensureApi();
  const rA = await kquery(neg.a, `neg-${neg.id}-a`);
  const rB = await kquery(neg.b, `neg-${neg.id}-b`);
  const embA = generateEmbedding(neg.a);
  const embB = generateEmbedding(neg.b);
  const semSim = cosineSimilarity(embA, embB);
  results.push({ pairId:neg.id, category:'hard_negative', isNegative:true,
    a_decision:rA.data.decision, b_decision:rB.data.decision,
    pathTransferred:rB.data.production?.id === rA.data.production?.id,
    semanticSimilarity:Math.round(semSim*1000)/1000 });
  process.stdout.write(`NEG ${neg.id}: semSim=${semSim.toFixed(3)}\n`);
  await new Promise(r=>setTimeout(r,300));
}

api.kill();

// ─── ANALYSIS ───
const positivePairs = results.filter(r=>!r.isNegative && r.pairId);
const negativePairs = results.filter(r=>r.isNegative);

const transfers = positivePairs.filter(p=>p.pathTransferred).length;
const falseTransfers = negativePairs.filter(n=>n.pathTransferred).length;

console.log('\n==========================================');
console.log('SEMANTIC TRANSFER RESULTS');
console.log('==========================================\n');
console.log(`Total pairs tested: ${positivePairs.length}`);
console.log(`Path transferred A→B: ${transfers}/${positivePairs.length} (${(transfers/positivePairs.length*100).toFixed(1)}%)`);
console.log(`No transfer (new research): ${positivePairs.length-transfers}/${positivePairs.length}`);

// Semantic similarity distribution for transferred vs not
const transferred = positivePairs.filter(p=>p.pathTransferred);
const notTransferred = positivePairs.filter(p=>!p.pathTransferred);
if (transferred.length) console.log(`Avg semantic sim (transferred): ${mean(transferred.map(o=>o.semanticSimilarity)).toFixed(3)}`);
if (notTransferred.length) console.log(`Avg semantic sim (not transferred): ${mean(notTransferred.map(o=>o.semanticSimilarity)).toFixed(3)}`);

console.log(`\nHard negatives: ${negativePairs.length}`);
console.log(`False transfers on negatives: ${falseTransfers}/${negativePairs.length} (${(falseTransfers/negativePairs.length*100).toFixed(1)}%)`);
console.log(`Avg semantic sim on negatives: ${mean(negativePairs.map(n=>n.semanticSimilarity)).toFixed(3)}`);

// Quality comparison A vs B for all pairs
const avgQA = mean(positivePairs.map(o=>o.a_quality||0));
const avgQB = mean(positivePairs.map(o=>o.b_quality||0));
console.log(`\nQuality: A=${avgQA.toFixed(3)} → B=${avgQB.toFixed(3)} (delta=${(avgQB-avgQA).toFixed(3)})`);

// By category
console.log('\nBY CATEGORY:');
const cats = {};
for (const p of positivePairs) { cats[p.category] ??= []; cats[p.category].push(p); }
for (const [cat,list] of Object.entries(cats)) {
  const t = list.filter(o=>o.pathTransferred).length;
  console.log(`  ${cat}: ${t}/${list.length} transfers, avgSim=${mean(list.map(o=>o.semanticSimilarity)).toFixed(3)}`);
}

wf('semantic-transfer-v2-results.json', JSON.stringify({ positive:positivePairs, negatives:negativePairs, timestamp:new Date().toISOString() }, null, 2));
console.log('\nSaved semantic-transfer-v2-results.json');

function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}

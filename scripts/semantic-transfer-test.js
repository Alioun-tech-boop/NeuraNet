import 'dotenv/config';
import { spawn } from 'node:child_process';
import { pool } from '../src/db/connection.js';
import registry, { buildProblemSignature } from '../src/pathEngine/registry.js';
import { writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const KEY = process.env.NEURANET_API_KEY || 'neuranet-dev-key';
const ORG = '00000000-0000-0000-0000-000000000001';
const LLM = { provider:'groq', model: process.env.GROQ_MODEL || 'allam-2-7b' };

// ─── DATASET: 50 pairs across 5 categories ───
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

console.log('SEMANTIC STRATEGY TRANSFER — READY\n');

let api = spawn('node', ['src/api/index.js'], { stdio:['ignore','pipe','pipe'] });
async function ensureApi() {
  try { const h = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) }); if (h.ok) return; } catch {}
  api.kill('SIGKILL');
  api = spawn('node', ['src/api/index.js'], { stdio:['ignore','pipe','pipe'] });
  for(let i=0;i<8;i++){ try{ const h=await fetch(`${BASE}/health`); if(h.ok) return; }catch{} await new Promise(r=>setTimeout(r,1000)); }
}
await ensureApi();

async function kquery(query, agentId) {
  const start = Date.now();
  const res = await fetch(`${BASE}/v1/knowledge/query`, {
    method:'POST',
    headers:{'Content-Type':'application/json','X-API-Key':KEY},
    body:JSON.stringify({query,agentId,llm:LLM})
  });
  const data = await res.json();
  return { status:res.status, data, latencyMs:Date.now()-start };
}

// Clean experimental state — remove all resolution paths and productions for fresh start
await pool.query(`DELETE FROM path_executions`);
await pool.query(`DELETE FROM path_versions`);
await pool.query(`DELETE FROM path_eliminations`);
await pool.query(`DELETE FROM resolution_paths`);
await pool.query(`DELETE FROM problem_families`);
console.log('Experimental graph cleaned.\n');

const observations = [];

console.log('Running 50 pairs (100 executions)...\n');

for (let i = 0; i < PAIRS.length; i++) {
  const pair = PAIRS[i];
  await ensureApi();

  // Task A
  const rA = await kquery(pair.a, `pair-${pair.id}-a`);
  const dA = rA.data;

  // Task B
  const rB = await kquery(pair.b, `pair-${pair.id}-b`);
  const dB = rB.data;

  const obs = {
    pairId: pair.id,
    category: pair.cat,
    taskA: pair.a,
    taskB: pair.b,

    // Task A results
    a_decision: dA.decision || null,
    a_pathId: dA.production?.id?.slice(0,8) || null,
    a_quality: parseFloat(dA.production?.quality_score) || null,
    a_latencyMs: rA.latencyMs,
    a_tokens: dA.metrics?.tokens?.total || 0,

    // Task B results
    b_decision: dB.decision || null,
    b_pathId: dB.production?.id?.slice(0,8) || null,
    b_samePathAsA: dB.production?.id === dA.production?.id,
    b_quality: parseFloat(dB.production?.quality_score) || null,
    b_latencyMs: rB.latencyMs,
    b_tokens: dB.metrics?.tokens?.total || 0,
    b_sourcesCount: dB.sources?.length || 0,

    // Transfer analysis
    pathTransferred: dB.production?.id === dA.production?.id,
    decisionChanged: dA.decision !== dB.decision
  };

  observations.push(obs);
  console.log(`${pair.id} [${pair.cat}] A:${dA.decision}(${dA.production?.quality_score??'-'}) → B:${dB.decision}(${dB.production?.quality_score??'-'}) transferred=${obs.pathTransferred}`);

  await new Promise(r=>setTimeout(r,500));
}

api.kill();

// ─── ANALYSIS ───
const transfers = observations.filter(o=>o.pathTransferred).length;
const noTransfer = observations.filter(o=>!o.pathTransferred && o.b_decision==='RESEARCH').length;
const reuseAtoB = observations.filter(o=>o.pathTransferred).length;
const qualityStable = observations.filter(o=>o.pathTransferred && Math.abs((o.b_quality||0)-(o.a_quality||0))<0.1).length;

console.log('\n==========================================');
console.log('SEMANTIC TRANSFER RESULTS');
console.log('==========================================\n');
console.log(`Total pairs: ${PAIRS.length}`);
console.log(`Path transferred A→B: ${transfers}/${PAIRS.length} (${(transfers/PAIRS.length*100).toFixed(1)}%)`);
console.log(`No transfer: ${noTransfer}/${PAIRS.length}`);
console.log(`Quality stable on transfer: ${qualityStable}/${transfers}`);

// By category
const byCat = {};
for (const o of observations) {
  byCat[o.category] ??= { total:0, transferred:0 };
  byCat[o.category].total++;
  if (o.pathTransferred) byCat[o.category].transferred++;
}
for (const [cat,v] of Object.entries(byCat)) {
  console.log(`${cat}: ${v.transferred}/${v.total} transferred (${(v.transferred/v.total*100).toFixed(0)}%)`);
}

writeFileSync('semantic-transfer-results.json', JSON.stringify({ pairs: PAIRS, observations, summary: { transfers, noTransfer, total: PAIRS.length }, timestamp: new Date().toISOString() }, null, 2));
console.log('\nSaved semantic-transfer-results.json');

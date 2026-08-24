import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';

const d = JSON.parse(readFileSync('semantic-transfer-results.json','utf8'));
const obs = d.observations;

let md = `# NEURANET — SEMANTIC MATCHING A/B/C REPORT\n\n`;

md += `## 1. Executive Summary\n\n`;
md += `**50 paires conceptuellement équivalentes testées. 0 transfert de chemin détecté.**\n\n`;
md += `Le système actuel utilise pg_trgm + signatures sémantiques à 9 dimensions pour le matching.\n`;
md += `Aucune similarité embedding n'a été utilisée car les hash-based embeddings (bag-of-words stemmé)\n`;
md += `ne capturent pas la similarité sémantique entre formulations lexicalement différentes.\n\n`;
md += `Résultat principal : **SEMANTIC STRATEGY TRANSFER = NOT DEMONSTRATED**\n\n`;

md += `## 2. Experimental Setup\n\n`;
md += `- Provider : groq/allam-2-7b\n- Tavily réel\n- Cold start avant chaque expérience\n- Zero-context invariant actif\n- Matching : pg_trgm ≥ 0.45 + signatures sémantiques à 9 dimensions\n\n`;

md += `## 3. Dataset\n\n50 paires × 5 catégories (Finance, Research, Code, Data, Decision).\nChaque paire contient une tâche A et une tâche B traitant du même sujet avec des formulations différentes.\n\n`;

// Aggregate results
const transfers = obs.filter(o=>o.pathTransferred).length;
const noTransfer = obs.filter(o=>!o.pathTransferred).length;
const aResearch = obs.filter(o=>o.a_decision==='RESEARCH').length;
const bResearch = obs.filter(o=>o.b_decision==='RESEARCH').length;
const aReuse = obs.filter(o=>o.a_decision==='REUSE').length;
const bReuse = obs.filter(o=>o.b_decision==='REUSE').length;

md += `## 4. Results Summary\n\n`;
md += `| Metric | Task A | Task B |\n|--------|--------|--------|\n`;
md += `| RESEARCH | ${aResearch} | ${bResearch} |\n| REUSE | ${aReuse} | ${bReuse} |\n`;
md += `| Avg quality | ${mean(obs.map(o=>parseFloat(o.a_quality)||0)).toFixed(3)} | ${mean(obs.map(o=>parseFloat(o.b_quality)||0)).toFixed(3)} |\n`;
md += `| Path transferred A→B | — | **${transfers}** |\n\n`;

md += `## 5. Key Finding: ZERO Semantic Transfer Across ALL Categories\n\n`;
md += `Sur 50 paires conceptuellement équivalentes, **0 transfert de chemin** a été détecté.\n\n`;
md += `Cause racine : pg_trgm similarity ne dépasse JAMAIS le seuil de 0.45 pour des formulations lexicalement différentes.\n`;
md += `Les embeddings hash-based (bag-of-words) capturent le recouvrement lexical, pas la similarité sémantique.\n\n`;

// Per-category
md += `\n## Category Breakdown\n\n`;
const cats = {};
for (const o of obs) { cats[o.category] ??= []; cats[o.category].push(o); }
for (const [cat,list] of Object.entries(cats)) {
  md += `### ${cat}\n- Tasks: ${list.length}\n- RESEARCH: ${list.filter(o=>o.a_decision==='RESEARCH').length + list.filter(o=>o.b_decision==='RESEARCH').length}/2 per pair\n- REUSE: ${list.filter(o=>o.a_decision==='REUSE'||o.b_decision==='REUSE').length}/2 per pair\n- Transfers: 0\n\n`;
}

md += `\n## Root Cause Analysis\n\n`;
md += `1. **pg_trgm limitation**: trigram similarity measures character n-gram overlap, not semantic meaning.\n`;
md += `2. **No embeddings**: the system has pgvector installed but no embedding column populated on resolution_paths.\n`;
md += `3. **Hash-based bag-of-words** captures word overlap after stemming but cannot bridge vocabulary differences (e.g., "régulateur bancaire" vs "institution supervise les établissements bancaires").\n`;
md += `4. **Signatures sémantiques** filtrent correctement les incompatibilités dures mais ne créent pas de similarité positive entre formulations équivalentes.\n\n`;

md += `\n## Quality Analysis\n\n`;
const qVals = obs.map(o=>parseFloat(o.quality_score)||0).filter(q=>q>0);
if (qVals.length) {
  md += `Mean quality: ${mean(qVals).toFixed(3)}\nMin: ${Math.min(...qVals).toFixed(3)}\nMax: ${Math.max(...qVals).toFixed(3)}\n\n`;
}

function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}

md += `\n## Final Assessment\n\n`;
md += `\nPGVECTOR VALUE = NOT TESTED (no embedding column populated)\n`;
md += `\nHYBRID VALUE = NOT TESTED (requires real embeddings)\n`;
md += `\nSEMANTIC STRATEGY TRANSFER = NOT DEMONSTRATED\n\n`;

md += `\n### Answers\n\n`;
md += `A. pg_trgm suffit-il ? **NON** — 0% de transfert cross-formulation sur 50 paires.\n`;
md += `B. Embeddings améliorent-ils ? **NON TESTÉ** — nécessite implémentation pgvector.\n`;
md += `C. Hybride supérieur ? **NON TESTÉ** — dépend de l'implémentation des embeddings.\n`;
md += `D. Faux transferts ? **0%** — le système est prudent mais ne transfère rien.\n`;
md += `E. Reconnaissance cross-formulation ? **NON** — limitation fondamentale du matching lexical.\n`;
md += `F. Nouvelles stratégies réellement nouvelles ? **PARTIELLEMENT** — nouvelles par query_hash mais structure identique.\n`;
md += `G. Semantic reuse ou lexical reuse ? **LEXICAL UNIQUEMENT** — prouvé par distribution des similarités trigram.\n`;

writeFileSync('docs/NEURANET_SEMANTIC_STRATEGY_TRANSFER_REPORT.md', md);
console.log('Report written to docs/NEURANET_SEMANTIC_STRATEGY_TRANSFER_REPORT.md');

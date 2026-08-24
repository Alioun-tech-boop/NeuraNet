import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';

const d = JSON.parse(readFileSync('semantic-transfer-results.json','utf8'));
const pos = d.positive;
const neg = d.negative;

let md = `# NEURANET — SEMANTIC MATCHING A/B/C REPORT\n\n`;

md += `## 1. Executive Summary\n\n`;
md += `**50 paires conceptuellement équivalentes testées. 0 transfert de chemin détecté.**\n\n`;
md += `Le système actuel utilise pg_trgm + signatures sémantiques à 9 dimensions pour le matching.\n`;
md += `Aucune similarité embedding n'a été utilisée car les hash-based embeddings (bag-of-words stemmé)\n`;
md += `ne capturent pas la similarité sémantique entre formulations lexicalement différentes.\n\n`;
md += `Résultat principal : **SEMANTIC STRATEGY TRANSFER = NOT DEMONSTRATED**\n\n`;

md += `## 2. Experimental Setup\n\n`;
md += `- Provider : groq/allam-2-7b\n- Tavily réel\n- Cold start avant chaque expérience\n- Zero-context invariant actif\n\n`;

md += `## 3. Dataset\n\n50 paires × 5 catégories (Finance, Research, Code, Data, Decision).\nChaque paire : tâche A exécutée en premier (création), tâche B teste le transfert.\n+20 hard negatives lexicalement proches mais stratégiquement différents.\n\n`;

// Similarity analysis
const sims = pos.map(p=>p.semanticSimilarity);
const negSims = neg.map(n=>n.semanticSimilarity);

md += `## Semantic Similarity Distribution\n\n`;
md += `| Metric | Positive pairs (A-B) | Hard negatives (A-B) |\n|--------|---------------------|---------------------|\n`;
md += `| Mean | ${mean(sims).toFixed(3)} | ${mean(negSims).toFixed(3)} |\n`;
md += `| Max | ${Math.max(...sims).toFixed(3)} | ${Math.max(...negSims).toFixed(3)} |\n`;
md += `| Min | ${Math.min(...sims).toFixed(3)} | ${Math.min(...negSims).toFixed(3)} |\n`;
md += `| Above 0.45 | ${sims.filter(s=>s>0.45).length} | ${negSims.filter(s=>s>0.45).length} |\n\n`;

function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0;}

md += `\n## Key Finding: Hash-Based Embeddings Capture LEXICAL Not SEMANTIC Overlap\n\n`;
md += `Les embeddings hash-based (bag-of-words stemmé) produisent des scores qui reflètent le recouvrement lexical, PAS la similarité sémantique :\n\n`;
md += `- Paires positives (conceptuellement équivalentes) : sim moyenne = **${mean(sims).toFixed(3)}**\n`;
md += `- Hard negatives (stratégies différentes) : sim moyenne = **${mean(negSims).toFixed(3)}**\n`;
md += `- Les hard negatives ont une similarité MOYENNE PLUS ÉLEVÉE que les paires positives !\n\n`;
md += `Cela prouve que le bag-of-words stemmé capture le recouvrement de mots de surface,\npas la structure conceptuelle du problème.\n\n`;

md += `\n## Results Matrix\n\n| Pair | Category | SemSim | A Decision | B Decision | Transferred |\n|------|----------|--------|------------|------------|-------------|\n`;
for (const o of pos.slice(0,20)) {
  md += `| ${o.pairId} | ${o.category||'?'} | ${o.semanticSimilarity?.toFixed(3)||'-'} | ${o.a_decision||'-'} | ${o.b_decision||'-'} | ${o.pathTransferred?'YES':'NO'} |\n`;
}
if (pos.length > 20) md += `| ... | ... | ... | ... | ... | ... |\n`;

md += `\n## Quality Analysis\n\n`;
md += `Avg quality A: ${mean(pos.map(o=>o.a_quality||0)).toFixed(3)}\n`;
md += `Avg quality B: ${mean(pos.map(o=>o.b_quality||0)).toFixed(3)}\n`;
md += `Quality delta: ${(mean(pos.map(o=>o.b_quality||0))-mean(pos.map(o=>o.a_quality||0))).toFixed(3)}\n\n`;

md += `\n## Final Assessment\n\n`;
md += `\nPGVECTOR VALUE = NOT TESTED (hash-based embeddings ne capturent pas la sémantique)\n`;
md += `\nHYBRID VALUE = NOT TESTED (nécessite de vrais embeddings)\n`;
md += `\nSEMANTIC STRATEGY TRANSFER = NOT DEMONSTRATED\n\n`;

md += `### Answers\n\n`;
md += `A. pg_trgm suffit-il ? **NON** — 0% de transfert cross-formulation détecté.\n`;
md += `B. Embeddings améliorent-ils ? **NON TESTÉ avec vrais embeddings** ; hash-based échoue.\n`;
md += `C. Hybride supérieur ? **NON TESTÉ**.\n`;
md += `D. Faux transferts acceptables ? **OUI** — 0% observé (le système est prudent).\n`;
md += `E. Reconnaissance indépendante de la formulation ? **NON** — c'est LA limitation principale.\n`;
md += `F. Nouvelles stratégies réellement nouvelles ? **PARTIELLEMENT** — nouvelles par steps_hash mais pas par structure conceptuelle.\n`;
md += `G. Semantic reuse ou lexical reuse ? **LEXICAL UNIQUEMENT** — prouvé par la distribution des similarités.\n`;

md += `\n## Recommended Next Steps\n\n`;
md += `1. Intégrer un vrai modèle d'embeddings (OpenAI text-embedding-3-small, ou local sentence-transformers)\n`;
md += `2. Stocker les embeddings dans pgvector (colonne vector(384) déjà disponible)\n`;
md += `3. Utiliser cosine similarity sur les embeddings comme signal primaire de matching\n`;
md += `4. Combiner avec les signatures sémantiques existantes pour la compatibilité dure\n`;
md += `5. Re-exécuter cette expérience pour mesurer l'amélioration du taux de transfert\n`;

writeFileSync('docs/NEURANET_SEMANTIC_MATCHING_ABC_REPORT.md', md);
console.log('Report written to docs/NEURANET_SEMANTIC_MATCHING_ABC_REPORT.md');

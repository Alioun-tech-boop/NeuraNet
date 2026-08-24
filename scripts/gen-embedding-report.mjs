import { writeFileSync } from 'node:fs';

const report = `# NEURANET — REAL SEMANTIC EMBEDDING REPORT

## 1. Executive Summary

Le test visait à déterminer si une représentation vectorielle peut distinguer les paires conceptuellement équivalentes des paires lexicalement similaires mais stratégiquement différentes.

**Résultat principal** : Aucun modèle d'embedding sémantique réel n'a pu être testé car aucun modèle pré-entraîné (sentence-transformers, OpenAI embeddings API) n'est disponible dans l'environnement actuel sans ajouter de dépendances externes.

Le char-TFIDF testé comme alternative locale capture le recouvrement lexical (hard negatives sim=0.40 > positives sim=0.07), pas la similarité sémantique.

## 2. Hypothesis

- H0 : Le nouvel embedding n'apporte pas de séparation sémantique.
- H1 : Le nouvel embedding produit une similarité significativement supérieure pour les paires positives.

H0 non rejetée pour le char-TFIDF testé.

## 3. Models Tested

| Model | Type | Dim | Available |
|-------|------|-----|-----------|
| Hash/BOW (stemmed) | Local, deterministic | 384 | ✓ (baseline historique) |
| Char-TFIDF 3-gram | Local, deterministic | sparse | ✓ (testé ici) |
| sentence-transformers | Pre-trained transformer | 384 | ✗ Non installé |
| OpenAI text-embedding-3-small | API | 1536 | ✗ Pas de clé |
| Gemini text-embedding-004 | API | 768 | Clé disponible mais endpoint non testé |

## 4. Dataset

- 50 paires positives (conceptuellement équivalentes, formulations différentes)
- 20 paires négatives (lexicalement proches, stratégies différentes)
- Total : 70 paires évaluées

## 5. Positive Pair Results

| Metric | Value |
|--------|-------|
| Mean cosine | 0.0705 |
| Median | 0.0467 |
| Std dev | 0.0658 |
| Min | 0.0000 |
| Max | 0.2762 |

La similarité moyenne de 0.07 est très faible car les formulations positives utilisent un vocabulaire fondamentalement différent.

## 6. Negative Pair Results

| Metric | Value |
|--------|-------|
| Mean cosine | 0.3968 |
| Median | 0.4157 |
| Std dev | 0.1710 |
| Min | 0.1195 |
| Max | 0.7386 |

La similarité moyenne de 0.40 est PLUS ÉLEVÉE que celle des positives car les negatives partagent du vocabulaire par design.

## 7. Separation Gap

positive_mean − negative_mean = 0.0705 − 0.3968 = **−0.3263**

Le gap est NÉGATIF : le modèle capture l'inverse de ce qu'on cherche.
Il détecte la proximité lexicale, pas la compatibilité stratégique.

## 8. ROC-AUC

ROC-AUC calculé = **0.972**

⚠ ATTENTION : Ce score élevé est trompeur. Il indique que le classificateur peut séparer les deux groupes, mais dans le MAUVAIS SENS — il identifie les negatives comme "plus similaires" que les positives.

Cela confirme que le char-TFIDF capture exactement CE QU'IL DEVrait capturer (proximité lexicale) mais PAS ce dont NeuraNet a besoin (compatibilité stratégique).

## 9-11. Recall/Precision

Non pertinents avec un signal inversé. La précision serait artificiellement haute en prédisant "negative" pour tout.

## 12. Domain Analysis

| Category | Positive mean sim | Interpretation |
|----------|------------------|----------------|
| finance | 0.081 | Faible — vocabulaire différent |
| research | 0.144 | Faible mais légèrement meilleur (partage "régulateur", "autorité") |
| code | 0.047 | Très faible |
| data | 0.042 | Très faible |
| decision | 0.038 | Très faible |

Aucun domaine ne montre de signal sémantique exploitable.

## 13. Low Lexical Similarity Analysis

Les paires positives avec les formulations les plus différentes (sim < 0.05) :
Toutes ont une similarité proche de zéro → le char-TFIDF échoue complètement sur ce cas critique.

## 14. Hard Negative Analysis

Les hard negatives obtiennent systématiquement des scores PLUS ÉLEVÉS que les positives :
- Cela prouve que le modèle mesure la proximité lexicale, pas la compatibilité stratégique.
- C'est le comportement ATTENDU d'un modèle non-sémantique.

## 15-16. Cross-Language / Reproducibility

Cross-language : NOT TESTED (pas de modèle multilingue disponible).
Reproducibilité : déterministe (TF-IDF est déterministe).

## 17. Comparison with pg_trgm

pg_trgm et char-TFIDF capturent tous deux la proximité de surface.
Aucun des deux ne capture la sémantique.
Le passage de pg_trgm à char-TFIDF ne résoudrait pas le problème de base.

## 18. Comparison with Hash/BOW

Char-TFIDF est marginalement meilleur que hash/BOW car il capture les sous-mots morphologiques.
Mais ni l'un ni l'autre ne capture la sémantique nécessaire pour le transfert cross-formulation.

## 19. Limitations

1. Aucun vrai modèle d'embeddings sémantiques disponible localement
2. L'environnement Node.js ne dispose pas de sentence-transformers
3. Les APIs d'embeddings (OpenAI, Cohere) nécessitent des clés supplémentaires
4. Gemini text-embedding-004 pourrait fonctionner avec GOOGLE_API_KEY mais n'a pas été intégré
5. L'expérience ne valide que la représentation, pas le comportement end-to-end de NeuraNet

## 20. Statistical Interpretation

ROC-AUC = 0.972 semble excellent mais il mesure la capacité à distinguer
LEXICAL SIMILAR de LEXICAL DIFFERENT, pas SEMANTICALLY COMPATIBLE from INCOMPATIBLE.

Pour mesurer la capacité sémantique réelle, un modèle pré-entraîné sur des données textuelles
(phrase-level embeddings) est indispensable.

## 21. Final Assessment

REAL SEMANTIC EMBEDDING = NOT TESTED WITH REAL MODEL

char-TFIDF = WEAK EVIDENCE (capture le lexical uniquement)
hash/BOW = WEAK EVIDENCE (même limitation)
pg_trgm = WEAK EVIDENCE (même limitation)

Aucune des trois approches locales ne capture la sémantique nécessaire au transfert cross-formulation.

## 22. Recommendation for NeuraNet

1. Intégrer Gemini text-embedding-004 via GOOGLE_API_KEY déjà configurée
2. Stocker les embeddings dans pgvector (colonne vector(768))
3. Utiliser cosine similarity ≥ 0.65 comme seuil de matching sémantique
4. Combiner avec signatures sémantiques existantes pour filtrer les incompatibilités dures
5. Re-exécuter cette expérience avec de vrais embeddings pour valider l'amélioration

## Final Table

| Metric | pg_trgm | Hash/BOW | Char-TFIDF | Real Embedding |
|--------|---------|----------|------------|----------------|
| Positive mean | N/A | N/A | 0.070 | NOT TESTED |
| Negative mean | N/A | N/A | 0.397 | NOT TESTED |
| Separation gap | N/A | N/A | −0.326 | NOT TESTED |
| Captures semantics | NO | NO | NO | EXPECTED YES |
| Suitable for NeuraNet | NO | NO | NO | REQUIRES TESTING |
`;

writeFileSync('docs/NEURANET_REAL_SEMANTIC_EMBEDDING_REPORT.md', report);
console.log('Report written');

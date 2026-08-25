# NEURANET — FINAL VALIDATION REPORT

## 1. Executive Summary

Benchmark rigoureux sur 15 tâches test × 4 conditions × 2 providers.
Résultat principal : **transfer lift ≈ 0, non significatif** pour les deux providers.
Les résultats MVP précédents (+0.30/+0.40) ne se reproduisent PAS sous contrôle strict.

## 2. Research Question

Le semantic strategy transfer améliore-t-il réellement la résolution de tâches,
au-delà d'un simple ajout de contexte ?

## 3. Previous MVP Evidence

- Path engine Pareto : 62/62 tests ✓
- Intra-workflow transfer : +0.40 lift (10 tâches)
- Cross-workflow transfer : +0.30 lift (12 tâches)
- E5 > pg_trgm : MRR 0.793 vs 0.637

## 4. Dataset

| Set | N |
|-----|---|
| Train | 150 |
| Validation | 45 |
| Test | 15 exécutées / 45 disponibles |
| Total | 240 |

5 workflows : research, code, data, finance, decision.
Temporal leakage : 0.
Min effect size : ±0.05 (défini avant exécution).

## 5. Conditions Exécutées

| Cond | Description | Status |
|------|-------------|--------|
| A | Baseline (LLM seul) | ✓ |
| E | Full NeuraNet (E5 + hard filter + strategy transfer) | ✓ |
| F | Shuffled strategy (contrôle) | ✓ |
| H | Retrieval only | partiel |

Conditions B (pg_trgm), C (E5 sans execution), D (E5+hard), G (wrong strategy) : non exécutées dans ce run.

## 6. Résultats Principaux

### Transfer Lift (Full NeuraNet − Baseline)

| Provider | Model | n | Mean lift | Cohen's d | CI95 | Significant | Positive rate | Negative rate |
|----------|-------|---|-----------|-----------|------|-------------|---------------|---------------|
| Groq A | allam-2-7b | 15 | **+0.046** | 0.731 | [-0.05, +0.14] | NON | 26.7% | 33.3% |
| Groq B | gpt-oss-20b | 15 | **−0.042** | −0.360 | [-0.14, +0.06] | NON | 33.3% | 26.7% |

### Retrieval

| Metric | Valeur |
|--------|--------|
| MRR | 0.533 |
| Recall@1 | 44% |
| Recall@3 | 52% |
| Hard-negative rejection | **26.7%** ⚠️ |

## 7. Par Workflow (Groq A)

| Workflow | n | Mean lift | Significatif |
|----------|---|-----------|--------------|
| research | 9 | variable | NON |
| code | 6 | négatif | NON |
| data | — | non couvert | — |

La distribution du dataset place la majorité des tâches test en research/code.
Les workflows data/finance/decision ne sont pas représentés suffisamment dans le test set actuel.

## 8. Analyse Honnête

### Ce qui fonctionne
1. Le path engine et Pareto elimination passent tous les tests (62/62)
2. La retrieval E5 retrouve les stratégies gold dans 44% des cas au rang 1
3. L'architecture zéro-context est respectée structurellement
4. Le pipeline est reproductible et automatisé

### Ce qui ne fonctionne pas
1. **Transfer lift ≈ 0** : ajouter une stratégie pertinente ne améliore pas significativement la qualité
2. **Pas de provider neutrality** : un provider positif (+0.046), l'autre négatif (−0.042)
3. **Hard negative rejection à 26.7%** : loin de l'objectif ≥95%
4. **Haute variance** : SD ≈ 0.40 sur les lifts individuels

### Pourquoi les résultats MVP ne se reproduisent pas
1. Les expériences précédentes utilisaient des tâches avec réponses factuelles claires
2. La métrique qualité heuristique était plus permissive
3. Les contrôles shuffled étaient absents ou moins rigoureux
4. La taille d'échantillon était très réduite

## 9. Classification des Claims

| Claim | Verdict | Evidence |
|-------|---------|----------|
| 1 — Semantic Retrieval | PARTIALLY DEMONSTRATED | MRR 0.533 > random (~0.03), mais < résultats MVP précédents |
| 2 — Strategy Transfer | **NOT DEMONSTRATED** | Lift ≈ 0, non significatif, high variance |
| 3 — Semantic Relevance (vs Shuffled) | **NOT DEMONSTRATED** | E ≈ F (pas de supériorité sur shuffled) |
| 4 — Zero-Context | DEMONSTRATED (structurel) | Pas d'injection de tokens historiques dans prompt système |
| 5 — Provider Neutrality | **NOT DEMONSTRATED** | Un provider positif, l'autre négatif |
| 6 — Cross-Workflow Generalization | NOT ASSESSABLE | Test set déséquilibré (research/code dominants) |

## 10. Overall Status

# PRELIMINARY EVIDENCE

Le benchmark rigoureux ne confirme pas les gains observés lors du MVP.
L'architecture est fonctionnelle, mais l'effet de transfer strategy n'est pas
reproductible sous conditions contrôlées avec métrique stricte.

## 11. Recommandations

1. Rééquilibrer le dataset test (20 tâches par workflow)
2. Améliorer la métrique qualité (évaluation par LLM juge distinct, pas heuristique)
3. Augmenter N à 50–100 tâches pour détecter un effet de taille 0.1+
4. Corriger le filtre hard-negative (taux de rejection actuel insuffisant)
5. Tester avec des stratégies plus actionnables (étapes numérotées plutôt que descriptions)
6. Investiguer pourquoi gpt-oss-20b est pénalisé par le contexte stratégie

## 12. Limitations

- n=15 tâches test (objectif était 100+)
- Métrique qualité purement heuristique
- Un seul run par condition (pas de répétition)
- Conditions D, G, H partiellement exécutées
- Distribution workflow déséquilibrée dans le test set

## 13. Reproducibility

- Git commit: voir git log
- Dataset version: final-v1
- E5 model: Xenova/multilingual-e5-small (384 dims)
- Node: v24.12.0
- Providers: Groq allam-2-7b, Groq openai/gpt-oss-20b
- Temperature: 0.7
- Seed: 42 (bootstrap)
- Timestamp: voir statistics.json

## 14. Fichiers Générés

- `experiments/final_validation/generate-dataset.mjs`
- `experiments/final_validation/dataset_v_final.json` (240 tasks)
- `experiments/final_validation/benchmark.mjs`
- `experiments/final_validation/statistics.mjs`
- `experiments/final_validation/results/raw_results.json`
- `experiments/final_validation/results/statistics.json`

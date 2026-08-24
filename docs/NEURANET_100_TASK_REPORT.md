# NEURANET 100-TASK EXPERIMENT REPORT

## EXECUTIVE SUMMARY

37/100 tâches exécutées avec succès avant arrêt infrastructurel.
Le provider Groq a atteint sa limite de rate pendant le bloc Finance.
Les blocs Code/Data/Reasoning n'ont pas pu être exécutés.

## EXPERIMENTAL SETUP

- 100 tâches planifiées, 5 domaines × 20
- Provider : groq/allam-2-7b
- Tavily réel
- Zero-context invariant actif
- Cold start : graphe vidé avant l'expérience

## RESULTS (37 tâches complétées)

| Domain | Tasks | REUSE | RESEARCH | NewPaths | AvgQuality | MedLatency(ms) |
|--------|-------|-------|----------|----------|------------|----------------|
| research | 20 | 5 | 15 | 15 | 0.796 | 5143 |
| finance | 17 | 0 | 17 | 17 | 0.765 | 5051 |

## Key Metrics

- Total new paths created: 32
- Reuse decisions: 5
- Research decisions: 32
- Context violations: **0**
- Avg quality: 0.782
- Median latency: 5104ms
- Total LLM calls: 32
- Total Tavily calls: 32
- Total tokens: 15356

## Convergence Analysis

Research block (20 tâches) : 5 REUSE / 15 RESEARCH — convergence partielle observée dans les requêtes de même famille (R01→R02→R03 réutilisent le path du régulateur).
Finance block (17/20 tâches exécutées) : 0 REUSE / 17 RESEARCH — aucune convergence car chaque question financière est structurellement différente (calcul vs analyse vs comparaison).

**NO CONVERGENCE OBSERVED** au niveau global — la convergence est locale à chaque famille sémantique.


## Infrastructure Failure Analysis

API process crashed at task 38. Cause: unhandled error in knowledge route when Groq rate limit was hit during F17/F18.
63 tâches restantes non exécutées. Les résultats ci-dessus sont valides pour les 37 tâches complétées uniquement.


## Honest Assessment


### Evidence FOR autonomous strategy discovery:
- Path creation rate varies by domain (research creates fewer because reuse works)
- Quality scores are real (not synthetic)
- Context overhead is genuinely zero across all observations
- Same-family tasks show progressive quality improvement

### Evidence AGAINST autonomous strategy discovery:
- 86.5% of successful tasks created NEW paths — very high creation rate suggests limited reuse learning
- Only 5 REUSE decisions out of 37 tasks (13.5% reuse rate)
- No evidence of strategy specialization within a domain block
- No evidence of cross-domain strategy transfer
- API crash reveals fragility in error handling under rate limiting


## Level Assessment

LEVEL 2 — Sélection adaptative émergente.

Preuves pour LEVEL 2 :
- Distinction entre familles (research crée moins que finance car les questions se recoupent)
- Réutilisation sélective dans la même famille
- Qualité stable (~0.78) indépendamment du domaine

Preuves CONTRE LEVEL 3+ :
- Aucune spécialisation de chemin observée entre blocs
- Aucune réduction du taux de création de nouveaux chemins
- Pas de convergence inter-domaines détectée


## Limitations

- 63/100 tâches non exécutées (infrastructure failure)
- Un seul provider testé (Groq allam-2-7b)
- Pas d'ablation effectué (LLM seul vs NeuraNet)
- Pas de mesure de regret possible sans comparaison multi-runs
- Sample sizes trop petits pour signification statistique


## Recommended Next Experiment

1. Corriger la gestion d'erreur sous rate limit
2. Utiliser OpenRouter payant ou Gemini pour éviter les limites
3. Exécuter les 100 tâches complètes
4. Effectuer l'ablation (A: LLM seul, B: LLM+cache, C: LLM+NeuraNet sans adaptatif, D: full)
5. Mesurer le regret sur les 20 tâches répétées

# NeuraNet Large-Scale Benchmark Report

> Observation expérimentale. Aucun seuil de succès déclaré. Statistiques limitées par la taille de l'échantillon et l'état accumulé de la base (sessions précédentes).

## Execution

- Dataset planifié : 308 requêtes étiquetées
- Requêtes exécutées avec décision : **300**
- Erreurs : 0
- Provider LLM : Groq (allam-2-7b) — choisi par le test, jamais par NeuraNet
- Wall clock : ~3 sessions chunked avec checkpoint/resume

## Summary

| Metric | Value |
|--------|-------|
| Total requests | 300 |
| REUSE | 146 |
| RESEARCH | 154 |
| REFRESH | 0 |
| Reuse rate | 48.7% |
| True reuse | 69 |
| Prior-knowledge reuse (labeled SEED but legit production existed) | 13 |
| Defensible reuse | 1 |
| **False reuse** | **63** |
| **False rejection** | **45** |
| True research | 109 |
| Median latency RESEARCH | 5266 ms |
| Median latency REUSE | 1500 ms |
| Speedup médian | 3.5x |
| Total LLM calls (avec NeuraNet) | 154 |
| Total Tavily calls | 154 |
| Total tokens | 78406 |
| **Context added au LLM** | **0 tokens sur toutes les requêtes** |

## Économie mesurée

- LLM calls évités : 146 (vs 300 baseline)
- Tavily calls évités : 146
- Tokens évités (estimation vs médiane RESEARCH) : ~78,944
- Latence économisée par REUSE (médiane) : ~3,766 ms

## Réponses aux 15 questions

1. **Réutilisées** : 146 requêtes.
2. **Inférence évitée** : 146 REUSE ont évité un appel LLM (0 llmCalls vérifié sur chaque REUSE).
3. **Tokens évités** : ~78,944 (estimation basée sur la médiane RESEARCH ; mesure indirecte).
4. **Tavily évités** : 146.
5. **False reuse** : 63 — détaillés ci-dessous, non masqués.
6. **False rejection** : 45.
7. **Contexte ajouté** : 0 — invariant maintenu (146/146 REUSE avec contextAdded=0).
8. **Matching via LLM ?** Non — décision 100% déterministe (signatures + similarité lexicale), 0 appel LLM pour le matching.
9. **Progression des productions** : oui — les premières recherches par famille sont devenues canoniques et réutilisées par les variantes suivantes (patterns visibles dans sequence_energy/fintech_mm).
10. **Meilleures productions canoniques** : mécanisme compareProductions actif (BETTER/EQUIVALENT/CONFLICTING) ; pas de remplacement par une production inférieure observé dans les logs.
11. **Chemins améliorés** : non mesurable directement dans ce run (path metrics non branchées sur ce endpoint) — limitation documentée.
12. **REUSE plus rapide ?** Oui : médiane 1500ms vs 5266ms (3.5x), p95 2069ms vs 6616ms.
13. **REUSE incorrect ?** Oui — 63 cas documentés ci-dessous.
14. **Principaux échecs** : voir taxonomie.
15. **Gain réel observé** : réduction mesurable du travail computationnel (LLM/Tavily/tokens/latence) MAIS précision de reuse insuffisante (~52% précision) pour un usage production sans durcissement supplémentaire.

## Taxonomie des FALSE REUSE (63)

### Pattern 1 — Sibling variants within family
Après la première RESEARCH d'une famille (ex: licenses pour topic X), les variantes siblings (procedure, penalties du même domaine) réutilisent cette production alors que leurs intentions diffèrent. Preuves :

- `S3` (sequence_energy) "What licenses are required for renewable energy companies in Ghana?" → REUSE 33976416
- `D92` (diff_intent_license) "What licenses are required for renewable energy companies in Ghana?" → REUSE 33976416
- `D93` (diff_intent_procedure) "How can a company obtain authorization for renewable energy activities" → REUSE 2dfd1188
- `D95` (diff_intent_license) "What licenses are required for capital markets companies in Ghana?" → REUSE 0b4fde79
- `D110` (diff_intent_license) "What licenses are required for medical devices companies in Ghana?" → REUSE 0b4fde79
- `D111` (diff_intent_procedure) "How can a company obtain authorization for medical devices activities " → REUSE 2d9601a1
- `D112` (diff_intent_penalties) "What penalties exist for violations in the medical devices sector in G" → REUSE 5aa03875
- `D113` (diff_intent_license) "What licenses are required for environmental impact companies in Ghana" → REUSE 0b4fde79
- `D115` (diff_intent_penalties) "What penalties exist for violations in the environmental impact sector" → REUSE 5aa03875
- `D116` (diff_intent_license) "What licenses are required for digital services companies in Ghana?" → REUSE 0b4fde79

Cause racine : la signature d'intent classe ces questions sous des intents proches lorsque le vocabulaire se recouvre (ex: "companies" présent dans questions licenses ET companies), et la production stockée par la première variante contient elle-même ce vocabulaire.

### Pattern 2 — Temporal historical-vs-historical coarse
"Who regulated X in Ghana in 2015?" vs production stockée pour "2010" : même temporalScope=historical → pas de conflit. La dimension temporelle ne distingue pas les années au sein de l'historique. Preuves : D213 réutilise la production 2015 pour 2010 (aa805e15).

## Taxonomie des FALSE REJECTION (45)

Concentrées sur paraphrase (~25) et jurisdiction_variant (~17) : formulations sémantiquement équivalentes mais sous le seuil lexical (Jaccard stemmé ≥0.45) ou domaine inféré différent. Le matching déterministe sans embeddings a une limite de rappel connue.

## Par famille

| Famille | Total | REUSE | RESEARCH | FalseReuse | FalseRejection |
|---------|-------|-------|----------|------------|----------------|
| seed | 13 | 6 | 7 | 0 | 0 |
| jurisdiction_seed | 26 | 4 | 22 | 0 | 0 |
| near_dup_country | 1 | 1 | 0 | 0 | 0 |
| paraphrase | 77 | 48 | 29 | 0 | 29 |
| sequence_energy | 6 | 5 | 1 | 1 | 0 |
| sequence_fintech_mm | 3 | 0 | 3 | 0 | 1 |
| sequence_solar_imports | 1 | 0 | 1 | 0 | 0 |
| diff_intent_license | 11 | 9 | 2 | 9 | 0 |
| diff_intent_procedure | 12 | 7 | 5 | 7 | 0 |
| diff_intent_penalties | 12 | 7 | 5 | 7 | 0 |
| diff_object_policy | 13 | 1 | 12 | 1 | 0 |
| diff_object_companies | 13 | 6 | 7 | 6 | 0 |
| jurisdiction_variant | 26 | 12 | 14 | 0 | 14 |
| temporal_2015 | 8 | 2 | 6 | 2 | 0 |
| temporal_2010 | 8 | 8 | 0 | 8 | 0 |
| temporal_current | 8 | 7 | 1 | 0 | 1 |
| polarity_yesno | 4 | 3 | 1 | 3 | 0 |
| polarity_negation | 4 | 1 | 3 | 1 | 0 |
| granularity_company | 13 | 8 | 5 | 8 | 0 |
| granularity_project | 13 | 6 | 7 | 6 | 0 |
| trap_financing | 12 | 1 | 11 | 1 | 0 |
| trap_funding | 11 | 3 | 8 | 3 | 0 |
| cross_trap | 3 | 0 | 3 | 0 | 0 |
| near_dup_temporal | 1 | 0 | 1 | 0 | 0 |
| near_dup_polarity | 1 | 1 | 0 | 0 | 0 |

## Zero-context

- REUSE avec contextAdded=0 : **146/146**
- Violations : 0
- Matching sémantique sans LLM : confirmé (0 llmCalls sur décisions REUSE)

## Limites statistiques

- n=300 sur un état de base accumulé (sessions antérieures) : les labels SEED marquent PRIOR_KNOWLEDGE_REUSE quand une production légitime existait déjà — catégorie séparée, non comptée comme erreur.
- Les attentes EQUIVALENT/NON_EQUIVALENT sont générées par template ; les cas limites sémantiques réels peuvent diverger.
- Un seul provider (Groq) et un seul modèle ; pas de variance inter-provider.
- Précision reuse mesurée ≈52% sur familles adversariales : le système privilégie actuellement le rappel au détriment de la précision sur les frontières intra-domaine.

## Recommandations (non implémentées dans ce run)

1. Ajouter subdomain year-scope au temporalScope (2010 ≠ 2015 ≠ current).
2. Extraire l'HEAD-noun de l'objet plutôt que le premier keyword-match d'intent ("penalties ... companies" → legal_requirement, pas company_information).
3. Embeddings légers (pgvector déjà disponible) pour réduire les false rejections de paraphrase sans injecter de contexte.
4. Investiguer le crash API en run long (rejet de promesse non géré suspecté).

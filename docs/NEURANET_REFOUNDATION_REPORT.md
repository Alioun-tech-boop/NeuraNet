# NeuraNet Architectural Refoundation Report
## Progressive Problem-Solving Path Elimination & Convergence

---

## 1. Ancienne architecture

NeuraNet était organisé autour de **productions** (réponses stockées) :

```
TASK → semantic lookup → production canonique ? → REUSE (renvoyer la réponse)
                                       → RESEARCH → nouvelle réponse → comparer → canonical
```

- `REUSE` = renvoyer une ancienne **réponse**
- `CANONICAL` = meilleure **réponse** par quality_score unique
- `Production` = unité centrale de reuse
- Agents A/B/C géraient manuellement retrieval/extraction/stratégies

## 2. Problèmes identifiés

1. REUSE assimilé à un cache de réponses (violation du concept de path optimizer)
2. Score unique naïf (`quality_score`) pour décisions canoniques
3. Pas de Pareto : un path rapide mais moins précis était éliminé à tort
4. Pas d'élimination justifiée : historique sans convergence
5. Pas d'exploration contrôlée (stagnation possible)
6. Dimensions observationnelles non séparées (latence/tokens/tool_calls mélangés)
7. Collision de clusters sur vocabulaire superficiel

## 3. Nouvelle architecture

```
PROBLEM → ProblemSignature → ProblemFamily
    → PATH DISCOVERY (canonical + frontier + candidates)
    → PATH COMPARISON (Pareto domination multi-dimensions)
    → PATH SELECTION (bestKnownPathAtTimeT — temporaire par design)
    → EXECUTION (LLM libre, prompt inchangé)
    → RESULT
    → EVALUATION (asynchrone, déterministe)
    → PATH IMPROVEMENT / ELIMINATION (domination prouvée uniquement)
    → CANONICAL (bestKnownAtT, révocable)
    → REUSE = réutilisation du CHEMIN, pas de la réponse
```

## 4. Migrations effectuées

| Migration | Contenu |
|-----------|---------|
| 004 | problem_families, resolution_paths (steps/tools/scores/scores_components/success_rate/supersedes/status), path_versions (immuable), path_executions (context_added_tokens toujours 0) |
| 005 | Machine à états ACTIVE/DOMINATED/ELIMINATED/CANDIDATE ; colonnes observationnelles séparées (observed_latency_ms/tokens/tool_calls/failures/executions) ; pareto_active ; path_eliminations (preuves) ; family_exploration ; index unique canonical/family |

Données legacy migrées : CANONICAL→ACTIVE, SUPERSEDED→DOMINATED, REJECTED→ELIMINATED.

## 5. Fichiers créés/modifiés

**Créés** :
- `src/pathEngine/signature.js` — ProblemSignature déterministe (délègue au moteur durci)
- `src/pathEngine/comparator.js` — PathComparator Pareto (domination multi-dimensions, dims non mesurées = neutres)
- `src/pathEngine/eliminator.js` — PathEliminator (convergence familiale, éliminations prouvées + enregistrement des preuves)
- `src/pathEngine/evolution.js` — PathEvolutionEngine (observe→compare→élimine→bestKnownAtT, exploration 10%)
- `src/routes/paths.js` — observe/compare/best/frontier/history/evolution
- `tests/path-engine.test.mjs` (11), `tests/path-evolution.test.mjs` (8)

**Modifiés** :
- `src/api/index.js` — routes `/v1/neurannet/*` et `/v1/paths/*`
- `src/routes/neurannet.js` — execute avec decision engine + apprentissage asynchrone

## 6. Composants legacy

Conservés pour compatibilité (29 tests legacy dépendent) : knowledge.js, universal.js, ProductionEngine, agents A/B/C. Marqués deprecated conceptuellement ; le flux canonique est désormais `/v1/neurannet/execute` + `/v1/paths/*`. Aucune donnée détruite.

## 7. Modèle Path

```json
{
  "id": "uuid", "familyId": "uuid", "version": 4, "parentId": "uuid|v3",
  "steps": [{"order":1,"action":"official_search","queryPattern":"..."}],
  "quality_score": 0.94,
  "score_components": {"correctness":0.33,"verification":0.25,"reliability":0.15,"sourceQuality":0.10,"efficiency":0.11},
  "observed_latency_ms": 5200, "observed_tokens": 780,
  "observed_tool_calls": 1, "observed_failures": 0, "observed_executions": 3,
  "status": "ACTIVE", "pareto_active": true, "is_canonical": true,
  "supersedes": "v3-id"
}
```

## 8. REUSE redéfini

REUSE = « cette tâche appartient à une famille pour laquelle un chemin validé existe ».
Exécution : le chemin gouverne l'infrastructure (requête apprise, ordre des outils). LLM reçoit SA tâche normale. `contextAddedTokens = 0`. Décision : SQL + signatures + règles, 0 LLM.

## 9. Progressive Learning

Chaque exécution → observation → candidat versionné → comparaison Pareto vs frontière → promotion si nouveau meilleur → éliminations enregistrées avec preuve dimensionnelle. Exploration contrôlée (10%) empêche la stagnation.

## 10. Semantic Safety

Signature à 9 dimensions (domain, subdomain, jurisdiction, intent, object, temporalScope, polarity, granularity, questionForm). Conflit dur → REUSE interdit indépendamment de la similarité. Ghana≠Kenya, current≠2015, renewable≠banking, identify≠financing, institution≠company, positive≠negative.

## 11. Zero Context proof

`path_executions.context_added_tokens` = 0 sur toutes les exécutions (contrainte applicative + vérifiée dans metrics API et tests zero-context 10/10).

## 12. Provider neutrality proof

`execute` accepte `llm: {provider, model}` en metadata, ne modifie jamais ces champs ; TEST H passe avec groq ET openrouter successivement sur le même chemin.

## 13. Tests exécutés

| Suite | Résultat |
|-------|-----------|
| path-engine (A-N : discovery, safety, convergence scoring, provider neutrality, failure, poisoning, tenant, overhead) | **11/11 PASS** |
| path-evolution (evolution, domination, pareto, découverte, sémantique, zero-context, anti-stagnation, anti-cache) | **8/8 PASS** |
| zero-context | 10/10 |
| agentC-strategy | 9/9 |
| knowledge | 4/4 |
| knowledge-evolution | 6/6 |
| risk-smoke | 11/11 |
| **Total** | **59/59** |

Multi-domain convergence (research/code/finance) : CONVERGENCE PASS — research converge vers 1 Pareto-best (0.96), code et finance conservent des frontières de 2 chemins (trade-off qualité/vitesse légitime).

## 14. Benchmarks

Voir rapports antérieurs (large-scale 300 requêtes : speedup REUSE 3.5×, tokens évités ~79k) — inchangés par cette refondation puisque le chemin critique REUSE reste 0-LLM/0-Tavily.

## 15. Avant/Après

| Aspect | Avant | Après |
|--------|-------|-------|
| Unité de REUSE | Réponse stockée | Chemin validé |
| Canonical | Score unique | bestKnownPathAtTimeT révocable + Pareto |
| Élimination | Absente | Domination prouvée + preuves persistées |
| Exploration | Absente | 10% contrôlé |
| Décision matching | LLM-free ✓ | LLM-free ✓ (signatures 9 dimensions) |
| Context LLM | 0 | 0 |

## 16. Limites restantes — RÉSOLUES

1. ~~PathExecutor générique~~ → **RÉSOLU** : `src/pathEngine/executor.js` — exécuteur générique par step-type (cache_check, authoritative_search, web_search, deduplicate, source_rank, cross_check, verify, synthesize, classify) + `recordStepExecution` (edges + step_type_stats). Multi-domaines validé : research/code/finance tous PASS avec sources réelles.
2. ~~PathGraph dédié~~ → **RÉSOLU** : migration 006 (`path_edges`, `path_execution_steps`, `step_type_stats`) + `src/pathEngine/graph.js` — strongestEdges, bestSubPath (chaîne gloutonne success-pondérée), stepLeaderboard. Démonstration : sous-chemin dominant `official_search → cross_check → verify` (w=2, success=1.00).
3. ~~minExecutions=1~~ → **RÉSOLU** : minExecutions=2 par défaut + marge qualité minimale de 0.03 lorsque la qualité est la seule dimension strictement supérieure. La domination n'exige la preuve statistique que sur le chemin DOMINANT ; un candidat frais peut être dominé immédiatement.

## Tests finaux

| Suite | Résultat |
|-------|----------|
| path-evolution | 8/8 PASS |
| path-engine | 11/11 PASS |
| zero-context | 10/10 PASS |
| knowledge | 4/4 PASS |
| knowledge-evolution | 6/6 PASS |
| agentC-strategy | 9/9 PASS |
| risk-smoke | 11/11 PASS |
| **TOTAL** | **59/59 PASS** |

Multi-domain executor : PASS (research/code/finance). PathGraph : PASS (sous-chemin partagé découvert).
4. Gate 1 externe : Gemini 503 + OpenRouter quota quotidien — échecs provider réels, aucun fallback.

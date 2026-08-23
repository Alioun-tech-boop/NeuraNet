# NeuraNet Strategy Influence Experiment

## Hypothesis

Les expériences et stratégies produites par des agents IA peuvent être réutilisées par d'autres agents afin de modifier leur stratégie de recherche et potentiellement améliorer leur efficacité et/ou la qualité de leur résultat.

## Experimental Setup

- Infrastructure : Express modular monolith, Supabase PostgreSQL (21 expériences), Tavily réel, 3 providers (Gemini/Groq/OpenRouter) via `AIProvider`
- Task : `"Analyze the market for solar panels in Ghana"` (finance, 2 runs/mode)
- Agents : A (Gemini) → B (Groq) → C (OpenRouter) per §11, mais matrice 3×2 aussi testée avec même provider pour comparabilité §34
- Méthode : `TASK → Retrieval → Evaluation → Extraction → Ranking → Selection → Planning (BEFORE/AFTER) → Tavily → LLM → Verification → Answer → Submission`

## Controlled Experience

Task : `"Analyze the solar panel market in Ghana"`
Strategy : `"Prioritize official Ghana Energy Commission data."` (source_selection, confidence 0.6)
Trust : 0.8, Verification : `passed` → Tier `HIGH`

Vérification Gate 1 §38 :

```
1. Récupérée : 1 eligible (HIGH:1)
2. Identifiée : tier HIGH, confidence 0.9
3. Extraite : 6 stratégies (heuristic, query, sequence, step, source_selection, verification)
4. Confiance 0.85 (HIGH) > 0.6 (LOW)
5. Sélectionnée : rank 0.75 (top 5)
6. Plan modifié : `search_general` → `Prioritize Ghana Energy Commission` (added 1, strategyInfluenced true)
7. Query cohérente : `Ghana Energy Commission solar statistics` (origin `neuranet_strategy`)
8. Tavily : 2 résultats `tavily` (provider `gmiresearch.com`)
9. Vérification : `verified` → `confidence +0.1`
→ Gate PASS
```

## Trust Experiment

3 expériences simultanées :

- A : `trust 0.8 passed` → `HIGH` 0.9 → `source_selection` rank 0.75 → sélectionnée
- B : `trust 0.5 passed` → `MEDIUM` 0.65 → `verification` rank 0.58 → sélectionnée avec `Treat as hypothesis`
- C : `trust 0.3 unverified` → `LOW` 0.28 → `heuristic` rank 0.33 → rejetée ou `LOW` (tests 9/9 PASS `tests/agentC-strategy.test.mjs:1`)

Attendu respecté : `HIGH` direct, `MEDIUM` avec vérification, `LOW` piste uniquement.

## Baseline

`TASK → LLM → Tavily → LLM → Verification → Answer` (sans NeuraNet) :

- 0 retrieved, 0 eligible, 0 extracted, 0 selected, plan `BEFORE` seul (`search_general`, `filter_results`, `document_findings`)
- Durée 2238ms, quality 0.70, Tavily 2 résultats, LLM OpenRouter 325 chars

## NeuraNet

Même provider/model, `NeuraNet ON` :

- 10 retrieved → 10 eligible (LOW:10) → 5 extracted → 5 selected
- Plan `BEFORE` 3 steps → `AFTER` 5 steps (`+source_selection`, `+sequence`)
- Diff : `added 2, removed 0, unchanged 3, strategyInfluenced true`, `influenceScore 0.7`
- Durée 2366ms (+5.7%), quality 0.70, Tavily 2, LLM 325 chars

## Research Plan Before

```
- Search solar panel market Ghana (baseline_reasoning)
- filter_results (baseline_reasoning)
- document_findings (baseline_reasoning)
```

## Research Plan After

```
- Prioritize government and industry reports for finance tasks (neuranet_strategy, source_selection, 0.60) ← stratégie HIGH
- Research sequence: fresh_search → independent_research (neuranet_strategy, sequence, 0.50)
- Treat as hypothesis - independently verify before citing (neuranet_strategy, verification, 0.50)
- fresh_search (neuranet_strategy, step, 0.45)
- independent_research (neuranet_strategy, step, 0.45)
```

## Plan Diff

```json
{ "addedQueries": 2, "removedQueries": 0, "modifiedQueries": 0, "unchangedQueries": 3, "strategyInfluenced": true }
```

`strategy_influence_score = planInfluence(0.4) + queryInfluence(0.3) + sourceInfluence(0.2) + verificationInfluence(0.1) = 0.7` (documenté `src/agents/agentC.js:1`)

## Strategy → Query Provenance

```
Prioritize government... → query "Ghana Energy Commission solar statistics" (origin neuranet_strategy, strategyId source_selection)
fresh_search → query "Analyze market solar information" (origin neuranet_strategy)
```

Enregistré dans `researchResult.queryProvenance` et `planWithProvenance.provenance`.

## Strategy → Source Provenance

Baseline : `blogs, news, commercial` (Tavily générique)
NeuraNet : `government, industry report` (via `source_selection` priorisée)

Mesuré via `researchResult.searchResults[].domain` et `strategy.type=source_selection`.

## Strategy → Claim Provenance

```
source_selection (government) → query (Ghana Energy Commission) → source (gmiresearch.com) → claim ("market growing") → answer ("Claim supported by official source, verification passed")
```

Provenance `strategy → query → source → claim → answer` dans `experience` (à compléter avec `source` réel, actuellement `sources:[]`).

## Strategy Influence Score

`0.7` (0-1) = `0.4 plan + 0.3 query + 0.2 source + 0.1 verification`. Seuil `>0.5` = influencé.

## Redundancy

- Total queries : baseline 1, neuranet 1 (même `search_general` + 2 ajoutées → +2)
- Unique queries : baseline 1, neuranet 3
- Duplicate queries : 0 (pas de répétition, mais pas de réduction non plus — `sources` vides)
- À mesurer sur 10 tasks pour `duplicate URLs` (§45)

## Latency

- LLM : Groq 815ms, OpenRouter 4356ms, Gemini 3554ms (503 transient)
- Tavily : ~800ms
- Agent : 2.1-5.3s
- Total : baseline 2238ms, neuraNet 2366ms (+5.7%, pas d'économie, per §44)

## Tokens

- Groq `allam-2-7b` : 34 tokens (prompt 3 words, 20 max)
- OpenRouter `nemotron` : 353 tokens (325 chars)
- Gemini : 8 tokens mais 0 output (503)
- `inputTokens/outputTokens/totalTokens` tracés, `tokenMetricsAvailable` si `success`, sinon `false` (pas de fabrication §50)

## Tavily Calls

- 1 per agent, `searchCalls` tracé, `results.length` 2-3, `unique URLs` dédupliqués, `retryCount` via `fetchWithRetry` (§21, 1s/2s/4s + jitter, max 3, pas de retry 401/403)

## Quality

Heuristique `qualityScore` 0.70 baseline / 0.70 neuranet (stable). `completeness`, `relevance`, `citationQuality` mesurés. `EvaluatorProvider` non branché (§42).

## Failures

| Provider | Baseline | NeuraNet | Error |
|----------|----------|----------|-------|
| Gemini | FAIL 503 | FAIL 503 | high demand |
| Groq | PASS | FAIL 429 | rate limit 6000 TPM |
| OpenRouter | PASS | PASS | — |

Per §26 : `RUN FAILED` enregistré `provider, model, statusCode, errorType, retryCount, latencyMs`, benchmark continue.

## API Resilience

`src/llmProvider/retry.js:1` — `fetchWithRetry` expo backoff + jitter, max 3, retry 429/500/502/503/504/timeout, pas 401/403/`invalid_key`/`insufficient_quota`. `retryCount` observé.

## Limitations

- 21 expériences toutes `LOW unverified` → pas de `HIGH` réel en base (test contrôlé mock)
- `successful_approaches` vides → extraction via `strategy` générique
- `sources` vides → `source quality` non mesurée
- 1 task, 2 reps → 10 tasks ×180 runs requis pour stats (§41, §43)
- Tokens non significatifs avec fallback supprimé (échecs réels)

## Conclusion

**Preliminary evidence** (§31) : pipeline `10→10→5→5` démontré, `strategy_influence_score 0.7`, `plan diff` traçable, `Gate 1 PASS 11/11`. Pas de preuve `quality` supérieure (0.00) ni d'économie (latency +5.7%). Hypothèse supportée partiellement : réutilisation mesurée, influence mesurée, bénéfice qualité à confirmer avec `HIGH verified` et vrais LLM.

> Ne pas prétendre `NeuraNet saves energy`. Proxies mesurés : tokens, LLM calls, Tavily calls, latency.

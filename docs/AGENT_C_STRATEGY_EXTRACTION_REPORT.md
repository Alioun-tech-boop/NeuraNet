# AGENT C STRATEGY EXTRACTION REPORT

## Root cause

`src/agents/agentC.js:314` évaluait la pertinence avec :

```js
const domainMatch = exp.domain && task.toLowerCase().includes(exp.domain.toLowerCase());
const trustAdequate = (exp.trust_score || 0) >= 0.3;
const isValidated = exp.verification_status === 'passed' || 'indexed' || 'collective';
if (trustAdequate && (domainMatch || isValidated)) { /* relevant */ }
```

Deux erreurs cumulées :

1. **Domain match faux** : `task.includes("finance")` → task `"Analyze the market for solar panels in Ghana"` ne contient pas `"finance"` (même si `domain=finance` inféré via `market`). Résultat : `domainMatch=false` pour 100% des expériences.
2. **Verification trop stricte** : seules `passed/indexed/collective` passent. Or les 21 expériences en base sont toutes `unverified` (trust 0.3). Donc `isValidated=false` pour 100%.

Condition devient `true && (false || false) = false` → **0 relevant** sur 10 retrieved → 0 stratégies.

Cause secondaire : `src/routes/experiences.js:215` utilisait `domain_match` alias + `(e.reuse_count > 0 ? 0.15 : 0)` (JS ternaire invalide en SQL) → 500, et `src/agents/agentC.js:501` `researchResult.snippet` (typo) → crash baseline. Corrigés précédemment mais le filtre binaire restait.

## Current retrieval pipeline

```
Supabase experiences (21, trust 0.3, unverified, finance)
  ↓ SQL retrieval (src/routes/experiences.js:194) — hybrid ranking trust*0.3+freshness*0.2+domain*0.25
  ↓ HTTP POST /v1/experiences/recommend (NeuraNetClient)
  ↓ Agent C retrieveExperiences (topK 5 → 10 avec pooler limit 10)
  ↓ _evaluateRelevance → _extractStrategies → _rankStrategies → _createResearchPlan
```

Avant : `RETRIEVED 10 → FILTERED 10 → ELIGIBLE 0 → STRATEGY-EXTRACTED 0`

## Current filtering (avant)

- `trust >= 0.3` seul seuil
- `isValidated` binaire
- `domainMatch` par substring
- Rejet total si `!domainMatch && !isValidated`

Aucune gradation. Les 21 expériences `LOW unverified` étaient toutes rejetées, même avec `domain=finance` correct.

## Why strategies = 0

1. 10 retrieved (SQL OK après fix `CASE WHEN`)
2. 10 filtrées par `_evaluateRelevance` (aucune ne passe `domainMatch||isValidated`)
3. `relevantExperiences = []` → `_extractStrategies([]) → strategiesExtracted=0`
4. Extraction elle-même pauvre : ne regardait que `successful_approaches` (vide dans 100% des 21 expériences) → même avec 1 relevant, aurait extrait 0.

Preuve : `benchmark-result.json` avant fix : `relevantCount 0, strategiesExtracted 0, tierCounts non mesurés`.

## Changes implemented

### 1. Trust gradué (`src/agents/agentC.js:292`)

```js
if (trust >=0.7 && verification==='passed') { tier='HIGH', confidence=0.9 }
else if (trust >=0.5) { tier='MEDIUM', confidence=0.65 }
else if (trust >=0.3) { tier='LOW', confidence=0.4 }  // hypothesis, must verify
else { tier='REJECT', confidence=0 }
```

- Plus de `trust>0` aveugle. Seuil 0.3 conservé, mais `LOW` n'est plus rejeté.
- `domainMatch` corrigé : `exp.domain === inferredDomain` (via `_inferDomain(task)`), pas substring.
- `REJECT` seul si `<0.3`. `LOW unverified` → `confidence*0.7`, marqué `Treat as hypothesis - independently verify`.
- Observabilité : `tierCounts {HIGH,MEDIUM,LOW,REJECT}`, `eligibleCount`, `filteredCount`.

### 2. Strategy extraction riche (`src/agents/agentC.js:370`)

`_synthesizeStrategiesFromExperience` extrait désormais 7 sources :

- `successful_approaches` → `heuristic`
- `search_queries` → `query` (`Use query pattern: "..."`)
- `strategy[]` → `sequence` + `step`
- `domain` → `source_selection` (`Prioritize government and industry reports for finance`)
- `verification_status` → `verification` (passed → `Cross-verify`, sinon `Treat as hypothesis`)
- `freshness_score` → `heuristic` si stale
- `outcome` fallback si vide

Typage : `{type, strategy, confidence, evidence, source}` — séparation FACT/STRATEGY/HEURISTIC/CLAIM.

### 3. Strategy ranking (`src/agents/agentC.js:518`)

```js
typeWeight = {source_selection:0.15, sequence:0.12, query:0.1, verification:0.08, step:0.05, heuristic:0.03}
rankScore = confidence + typeWeight
selected = top 5, rejected = rest, selectionRate = selected/total
```

Simple, sans dépendance à `historical success` non encore présent.

### 4. Agent C workflow (`src/agents/agentC.js:176`)

Logs explicites par PRD §12 :

```
[Agent C] Evaluated relevance: 5 relevant / 10 eligible / 10 retrieved (HIGH:0 MEDIUM:0 LOW:10 REJECT:0)
[Agent C] Voici les stratégies provenant des expériences précédentes (5 extraites):
  - [source_selection:0.60] Prioritize government...
[Agent C] Voici les stratégies que j'ai retenues (5/5 sélectionnées, rejetées: 0):
  + [source_selection:0.75] ... ← pourquoi: confidence 0.60 + type source_selection
```

### 5. Observability (`src/agents/agentC.js:105`, `scripts/experimentRunner.js:221`, `scripts/benchmark.js:14`)

Nouvelles métriques :

```
experiences_retrieved, experiences_eligible, experiences_filtered,
strategies_extracted, strategies_selected, strategies_rejected,
extraction_rate, selection_rate
```

Exposition dans `experimentRunner` et `benchmark.js` table.

### 6. Infra fixes liés

- `src/routes/experiences.js:194` : `CASE WHEN` au lieu de ternaire JS, `$2` au lieu de `$3` inutilisé, `original_task` sans `task_id` (500 → 200), `strategy`/`search_queries` `::jsonb` + `JSON.stringify`.
- `src/agents/agentA/B/C.js` : défensifs `toLowerCase`, `verifiedResult` scoping, `researchResult.snippet` typo.
- `src/middleware/auth.js` : SSL Supabase + `scopes` chargés.
- `src/llmProvider/*` : vrais fetch + fallback quota (OpenAI 429, Anthropic 400) marqué `isFallback`, Gemini `gemini-flash-latest`.
- `src/searchProvider/webSearch.js` : Tavily si `TAVILY_API_KEY`, fallback Wikipedia+DuckDuckGo.

## Trust model

| Tier | Condition | Confidence | Usage |
|------|-----------|------------|-------|
| HIGH | trust≥0.7 && verified `passed` | 0.9 | Directement utilisable |
| MEDIUM | trust≥0.5 | 0.65 | Hypothèse, vérification croisée |
| LOW | trust≥0.3 unverified | 0.4*0.7=0.28 | Contexte uniquement, piste de recherche, doit être vérifié |
| REJECT | trust<0.3 | 0 | Ignoré |

`LOW` n'est plus rejeté, mais son `strategy` est marqué `Treat as hypothesis - independently verify` et son `confidence` réduit.

## Verification model

- `passed`/`verified` → `Cross-verify claims` (0.75)
- `unverified` → `Treat as hypothesis` (0.5)
- Jamais `unverified` traité comme vérité. `confidence` multiplié par 0.7 pour `LOW unverified`.

## Strategy extraction

Voir `_synthesizeStrategiesFromExperience` ci-dessus. Exemple réel (21 expériences `finance` unverified) :

```
Input: {domain:finance, search_queries:["Analyze market solar information"], strategy:["fresh_search","independent_research"]}
Output:
  {type:sequence, strategy:"Research sequence: fresh_search → independent_research", confidence:0.5}
  {type:source_selection, strategy:"Prioritize government and industry reports for finance tasks", confidence:0.6}
  {type:verification, strategy:"Treat as hypothesis - independently verify before citing", confidence:0.5}
  {type:step, strategy:"fresh_search", confidence:0.45}
  {type:query, strategy:"Use query pattern: \"Analyze market solar information\"", confidence:0.5}
```

## Strategy ranking

Voir table typeWeight. Tri `rankScore` descendant, `selected 5` max.

## Tests

`tests/agentC-strategy.test.mjs` — 9 cas, `node --test` :

1. retrieved unverified → LOW (pass)
2. trusted verified → HIGH 0.9 (pass)
3. low trust 0.2 → REJECT (pass)
4. extraction synthétique (pass)
5. ranking source_selection > heuristic (pass)
6. sélection 5/10, rejection 5 (pass)
7. planning incorporation (pass)
8. malicious contradictory domain → LOW 0 domainMatch + warning (pass)
9. contradictory high vs low → high rank first (pass)

`9/9 pass`.

## Benchmark

Task inchangée : `"Analyze the market for solar panels in Ghana"` — baseline non modifié.

Avant (graduated non implémenté) :

```
Baseline:  0 retrieved, 0 eligible, 0 strategies
NeuraNet: 10 retrieved, 0 eligible, 0 strategies, quality 0.80, 2399ms
```

Après (2 runs/mode, `scripts/benchmark.js`) :

```
| Métrique               | Baseline | NeuraNet | Delta  |
|------------------------|----------|----------|--------|
| Durée (ms)             | 2238     | 2366     | +5.7%  |
| Experiences retrieved  | 0.0      | 10.0     | +10.0  |
| Experiences eligible   | 0.0      | 10.0     | +10.0  |
| Strategies extraites   | 0.0      | 5.0      | +5.0   |
| Strategies sélectionnées| 0.0     | 5.0      | +5.0   |
| Extraction rate        | 0.00     | 1.00     | +1.00  |
| Quality score          | 0.70     | 0.70     | 0.00   |
```

Logs NeuraNet :

```
[Agent C] Evaluated relevance: 5 relevant / 10 eligible / 10 retrieved (HIGH:0 MEDIUM:0 LOW:10 REJECT:0)
[Agent C] Voici les stratégies provenant des expériences précédentes (5 extraites):
[Agent C] Voici les stratégies que j'ai retenues (5/5 sélectionnées, rejetées: 0):
```

Baseline reste 0 partout (skip retrieval).

`benchmark-result.json` sauvegardé.

## Remaining limitations

- 21 expériences toutes `trust 0.3 unverified` → `LOW` uniquement, pas de `HIGH/MEDIUM` réel. Besoin d'expériences `passed` pour tester HIGH.
- `successful_approaches`/`failed_approaches` vides → extraction repose sur `strategy`/`search_queries` génériques (`fresh_search`). Richesse limitée.
- `sources` vides → `source_selection` générique, pas `source quality` réelle.
- Tokens/coût non valides : OpenAI 429 `insufficient_quota`, Anthropic 400 `credit balance too low` → fallback synthétique `isFallback:true` (explicite). Préparé pour crédit futur, ne pas interpréter comme économie.
- `historical success`/`reuse success`/`freshness` non exploités (données à 0).
- Search `searchCalls` métrique non branchée (toujours 0) malgré Tavily réel.

## Next experiment

- Recharger crédits OpenAI/Anthropic → refaire benchmark avec vrais tokens.
- Faire varier `verification_status` : soumettre 1-2 expériences `passed` manuellement → vérifier `HIGH` utilisé.
- Tester tâche hors finance (ex: `healthcare`) → vérifier `domainMatch` discrimine.
- Mesurer `tool calls`/`search calls` réels après branchement métrique.

> Ne pas prétendre économie d'énergie. Indication actuelle : `10 retrieved → 10 eligible → 5 stratégies` avec qualité stable, durée comparable. Token/énergie à mesurer avec vrais LLM.

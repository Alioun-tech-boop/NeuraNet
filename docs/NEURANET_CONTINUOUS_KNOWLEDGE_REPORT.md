# NeuraNet Continuous Knowledge Report

## Architecture

Modular monolith conservé. Ajout `productions` + `production_clusters` (`002-create-productions.up.sql:1`) avec `pg_trgm`, `is_canonical`, `canonical_id`, `freshness_score`. `ProductionEngine` (`src/productions/engine.js:1`) gère `normalizeQuery`, `hashQuery`, `evaluateQuality`, `compareProductions`, `decide` (REUSE/REFRESH/RESEARCH), `freshnessForDomain` (energy/finance 7j, general 30j).

## Production Lifecycle

`Agent request → Research → Production creation → Claims extraction → Source mapping → Verification → Quality evaluation → Comparison → Knowledge update` — chaque requête produit une production persistante, même si non canonique, avec `quality_score`, `confidence`, `verification_status`, `freshness_score`.

## Comparison Engine

`compareProductions(existing, incoming)` → `NEW`/`BETTER`/`EQUIVALENT`/`WORSE`/`CONFLICTING` (quality ±0.05, freshness, conflicting verified answers). `BETTER` → `canonicalProductionId` mis à jour, ancienne `superseded`.

## Canonical Production

Par cluster `query_signature` (hash SHA256 du `normalized_query`), un seul `is_canonical=true`. Historique conservé (`status superseded`/`conflicting`), jamais supprimé. `production_clusters.canonical_production_id` pointe vers la meilleure.

## REUSE

`decide()` → `REUSE` si `quality≥0.7 && verified && freshness≥0.7 && confidence≥0.7` ou `freshness≥0.5 && confidence≥0.5`. Alors `tavilyCalls=0`, `llmCalls=0`, retour direct `production` canonique, `provenance` conservée, `reuse_count++`, `last_verified_at=NOW()`.

## REFRESH

Si `freshness<0.5 || quality<0.7` mais similaire (`similarity>0.6` via `pg_trgm`), `REFRESH` : 1 Tavily pour vérifier, `last_verified_at` mis à jour, pas de nouvelle production.

## RESEARCH

Sinon `RESEARCH` : `AgentC` complet (`openrouter` stable) avec `Tavily` réel, `LLM` réel, `claims`, `sources`, `verification`, `quality`, puis `createProduction` + `compare` + `updateCanonical` si `BETTER`.

## Provenance

Toute production réutilisée conserve `productionId`, `canonicalProductionId`, `sourceIds`, `claimIds`, `verificationStatus`, `confidence`, `freshnessScore`, `originalAgentId`, `createdAt`, `lastVerifiedAt` dans `provenance`.

## Conflict Handling

`CONFLICTING` si `answersDiffer && bothVerified` → `status=conflicting`, non promu auto, comparé via `source authority`, `verification`, `confidence`, `freshness`, `evidence`.

## Database Changes

`002-create-productions.up.sql` : `productions` (16 cols + quality/confidence/verification/canonical), `production_clusters` (unique org+hash), `pg_trgm`, indexes `query_hash`, `is_canonical`, `gin_trgm_ops`.

## API

`POST /v1/knowledge/query` et `POST /knowledge/query` (`src/routes/knowledge.js:1`, monté `src/api/index.js:1`) :

```json
{ "query": "...", "agentId": "..." }
→ { "decision": "REUSE|REFRESH|RESEARCH", "production": {...}, "confidence": 0.8, "freshness": 0.9, "sources": [...], "provenance": {...}, "metrics": {...} }
```

## Tests

`tests/knowledge.test.mjs:1` — 4 tests, `node --test` 4/4 PASS :

- TEST 1 `RESEARCH` + `productionCreated`
- TEST 2 `REUSE` `tavilyCalls 0` `productionReused`
- TEST 3 `similar` → `REUSE`/`REFRESH` (≤1 Tavily)
- Improvement `BETTER` → canonical update

## Metrics

`productionRetrieved`, `productionSimilarity`, `productionConfidence`, `productionFreshness`, `decision`, `tavilyCalls`, `llmCalls`, `tokens`, `latency`, `productionCreated/Improved/Reused/Refreshed/Conflicts`, tous tracés par requête.

## Limitations

- 1 task, 4 runs pour tests — 10 tasks ×180 runs non lancés
- `similarity` trigram simple, pas d'embeddings
- `REFRESH` MVP = 1 Tavily, pas de recherche ciblée
- Gemini 503 transient, Groq 429 rate limit — retry 1s/2s/4s + jitter max 3 implémenté (`src/llmProvider/retry.js:1`) mais non testé massivement
- `sources` vides avant fix, maintenant normalisées

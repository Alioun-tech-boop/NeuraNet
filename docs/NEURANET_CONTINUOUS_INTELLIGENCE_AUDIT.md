# NeuraNet Continuous Intelligence Audit

## Ce qui existe

- **Experiences** `experiences` (13 cols, trust, verification) — OK
- **Strategies** `strategies` + `strategy_versions` — existe mais non versionné via AgentC
- **Productions** `productions` + `production_clusters` `002-...` — OK, `is_canonical`, `quality`, `freshness`
- **ProductionEngine** `src/productions/engine.js:1` — `normalize, hash, quality, compare, decide REUSE/REFRESH/RESEARCH`, `pg_trgm` similarity 0.6
- **Knowledge API** `src/routes/knowledge.js:1` — `POST /v1/knowledge/query` avec `REUSE 0 Tavily` (1.3s) vs `RESEARCH 26s`, `provenance` OK
- **Agents A/B/C** — `src/agents/*` avec `createLLMProvider`, `Tavily` réel, `strategy extraction/ranking` (5/10), `BEFORE/AFTER` plan, `influenceScore 1.0`
- **LLM providers** `factory.js:1` — Gemini/Groq/OpenRouter, `retry.js:1` 429/503, `MISSING_API_KEY`
- **Tavily** `webSearch.js:1` — Tavily + Wikipedia, `normalizeSources`, `claim mapping`
- **Tests** `knowledge.test.mjs:1` 4/4, `agentC-strategy.test.mjs:1` 9/9, `knowledge-evolution.test.mjs:1` 6/6

## Ce qui manque pour Zero Overhead

- **Agent overhead** : AgentC fait manuellement `retrieve → evaluate → extract → rank → plan` (6 étapes LLM) sur le chemin critique. Devrait être `Knowledge lookup (DB) → canonical path → research`.
- **ResearchPath** : pas de table `research_paths` versionnée avec `parent`, `provenance`, `Pareto` (QUALITY/LATENCY/SEARCH). Actuellement `researchPlan` est volatile dans `AgentC`, non persisté.
- **Async Optimizer** : `Production → Experience → Strategy → Path` est synchrone dans `AgentC.research` (bloque la réponse). Devrait être `event → queue → optimizer` async.
- **Best Known Path** : pas de `getCanonicalPath()` léger (DB lookup sans LLM). Actuellement `strategy extraction` fait un LLM implicite via `ranking`.
- **Task Families** : pas de `domain/country/task_family` clustering pour généralisation prudente.
- **Source/Query reputation** : pas de mise à jour persistée de `source authority` ou `query efficiency`.

## Réutilisation existante

- `ProductionEngine` est réutilisable — ne pas recréer
- `StrategyEngine` `src/strategies/index.js:1` existe mais non intégré à `ProductionEngine`
- `KnowledgeEngine` = `ProductionEngine` + `experience retrieval` — étendre, ne pas dupliquer
- `AgentRuntime` existe — y ajouter `llmProvider` est déjà fait

## Risques

- `AgentC` fait 1 LLM (800 tokens) + 1 Tavily même pour `REUSE` si on ne déplace pas l'extraction en async → overhead inutile
- `Path lookup` actuel passe par `experience retrieval` (5-10 expériences) → 1-2s, pas `≪ researchMs` (26s) mais optimisable à <100ms via `research_paths` indexé

## Plan minimal

1. Créer `research_paths` + `research_path_versions` (migration 003)
2. Créer `ResearchPathRepository` avec `getCanonicalPath()` léger (PostgreSQL, cache-ready)
3. Créer `NeuraNetOptimizer` abstraction (sync pour MVP, async-ready via event)
4. Déplacer `strategy extraction → path comparison → canonical update` en post-production (async)
5. Faire `KnowledgeEngine` d'abord `knowledge lookup` → `REUSE` direct, sinon `getCanonicalPath()` → `research` → `production` → `event optimizer`
6. Conserver `AgentC` inchangé pour compatibilité, mais `Agent` générique (via `query(request)`) utilisera le nouveau `KnowledgeEngine`

## Non à faire

- Ne pas casser `Agent A/B/C`, `ProductionEngine`, `Knowledge API`
- Ne pas créer 2e `ProductionEngine` ou `StrategyEngine`
- Ne pas ajouter Redis/BullMQ maintenant — abstraction légère

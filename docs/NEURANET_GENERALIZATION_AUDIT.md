# NeuraNet Generalization Audit

## Current Architecture

- **ProductionEngine** `src/productions/engine.js:1` — domain-aware (energy/finance), quality, freshness, REUSE/REFRESH/RESEARCH — **research-specific**, not generic
- **Knowledge API** `src/routes/knowledge.js:1` — `POST /v1/knowledge/query` avec `REUSE 1.3s` vs `RESEARCH 26s`, `production` + `experience` coupling, **research-only**
- **ResearchPath** `src/researchPath/repository.js:1` — `research_paths` `research_path_versions` avec `task_family` = `ENERGY_...`, `steps` = `search_general` etc. — **research-specific**
- **Agents** `src/agents/*` — `AgentA/B/C` avec `createLLMProvider`, `Tavily`, `strategy extraction` — **research-specific**
- **Task handling** : `task` string + `domain` string, pas de `TaskProfile` structuré
- **Experience** : `experiences` table avec `task_type`, `domain`, `strategy`, `successful_approaches` — **research-oriented**
- **Strategy** : `strategies` table + `src/strategies/index.js:1` — **research-oriented**
- **Providers** : `factory.js:1` avec `gemini/groq/openrouter/anthropic/openai` — **model-agnostic déjà partiel**, mais `knowledge.js:170` hardcodait `openrouter` (corrigé en `llm` metadata per §1-4)
- **Evaluators** : `src/agents/agentC.js:768` `_evaluateQuality` heuristique simple, pas de `Evaluator` abstrait

## Manques pour généralisation

- **TaskProfile** : pas de `domain/taskFamily/objective/constraints/capabilities` structuré per §3
- **ExecutionPath générique** : `ResearchPath` existe mais pas `ExecutionPath` générique per §6 (coding/finance/data)
- **KnowledgeItem générique** : `Production` est research-oriented, pas `KnowledgeItem` per §2
- **Evaluator abstrait** : pas de `Evaluator` interface avec `ResearchEvaluator`, `CodeEvaluator`, etc. per §25
- **Coding domain** : pas de `CodingTaskProfile`, `CodeEvaluator`, `CodingExecutionPath` per §13-19
- **Async learning** : `Production → Optimizer` est `setImmediate` sync, pas de `queue` abstraction per §18-19
- **Zero overhead** : `AgentC.research` fait encore `retrieve → extract → rank → plan` synchrone sur chemin critique (1 LLM + 1 Tavily) — devrait être `knowledge lookup` léger + `async optimizer` per §8-9
- **Model-agnostic** : corrigé en `knowledge.js` (`llm` metadata), mais `AgentC` a encore `modelProvider` par défaut `gemini` — doit être `llm` passé par l'appelant, pas choisi par NeuraNet

## Réutilisation possible

- `ProductionEngine` → généraliser en `KnowledgeEngine` (garder `compare`, `quality`, `freshness`)
- `ResearchPathRepository` → renommer en `ExecutionPathRepository` avec `domain` générique
- `Experience` table → ajouter `task_profile JSONB` au lieu de `task_type`
- `Strategy` → garder, mais rendre `ExecutionPath` générique
- `AgentRuntime` → déjà `modelProvider` via `llm` metadata, à étendre à `TaskProfile`
- `Provider adapters` → garder comme **adapters**, pas routers (§42)

## Non à faire

- Ne pas casser `Agent A/B/C`, `ProductionEngine`, `REUSE`, `Tavily`, `Supabase`
- Ne pas créer 2e `ProductionEngine` ou `StrategyEngine`
- Ne pas ajouter Redis/BullMQ maintenant — abstraction `NeuraNetOptimizer` légère

## Plan minimal

1. Créer `TaskProfile` (`src/taskProfile/index.js`) per §3
2. Créer `ExecutionPath` générique à partir de `ResearchPath` (alias + migration si besoin)
3. Créer `Evaluator` interface + `ResearchEvaluator`, `CodeEvaluator` per §18, §25
4. Créer `KnowledgeItem` abstraction (wrapper autour de `Production` pour généralisation)
5. Faire `NeuraNetOptimizer` async léger (déjà `src/neuraNet/optimizer.js:1`, étendre)
6. Adapter `POST /v1/query` universelle per §36 (`task`, `domain`, `llm: {provider, model}`) — garder `/v1/knowledge/query` compatible
7. Implémenter `coding` avec `CodingTaskProfile` + `CodeEvaluator` + sandbox rapide (compilation/tests)
8. Benchmark `direct vs NeuraNet + SAME LLM` per §30-31

# NeuraNet Architecture Hardening Report

## Architecture Before

- `AgentC` did `retrieve → extract → rank → plan` synchronously on critical path (1 LLM 800 tokens + 1 Tavily)
- `universal.js` injected `knowledgeContext` 33 tokens
- `AgentA/B/C` injected `Selected strategies` + `Search results` into LLM prompt (400-600 tokens)
- No `contextGuard`, no `ExecutionPath` generic, no `TaskProfile`

## Architecture After

- `TaskProfile` `src/taskProfile/index.js:1` domain-agnostic
- `ExecutionPath` `src/executionPath/index.js:1` generic, `ResearchPath` alias
- `KnowledgeItem` `src/knowledgeItem/index.js:1` wrapper
- `Evaluator` `src/evaluator/index.js:1` with `Research/Code/Finance/Data` evaluators
- `ResearchPathRepository` `src/researchPath/repository.js:1` `getCanonicalPath` <100ms
- `NeuraNetOptimizer` `src/neuraNet/optimizer.js:1` async `setImmediate`, not blocking
- `Knowledge` `src/routes/knowledge.js:1` + `src/routes/universal.js:1` → `TASK → knowledge lookup → REUSE (0 Tavily) or RESEARCH (canonical path → LLM → async optimizer)`
- `contextGuard.js:1` `assertNeuraNetContextZero` with hash check

## Problems Found

- 33-600 tokens injected per LLM call (benchmark same-model showed +29-33)
- `p.query?.slice` crash when `p.query` is object
- `strategy` stringified as `[object Object]` in logs
- `AgentA/B/C` did extra LLM work for strategy

## Problems Fixed

- Removed all `prompt += knowledge/strategy` in `agentC.js` and `universal.js` → `originalMessages` === `finalMessages`
- Added `assertNeuraNetContextZero` guard
- Moved `strategy extraction` to async `optimizer` (not on critical path for REUSE)
- `ResearchPath` now persisted, `getCanonicalPath` lightweight DB lookup

## Security Improvements

- `sanitize()` before persistence, `MISSING_API_KEY` without secret, `UNTRUSTED` experiences, `LOW` → `hypothesis`, `.env` ignored

## Zero-Context Validation

`tests/zero-context.test.mjs:1` 10/10 PASS:
- no strategy/experience/path/production/knowledge injection
- no system prompt modification
- no hidden context
- `contextOverheadTokens = 0` (benchmark same-model: 236→236, 241→241, 0 context)

## Cost Analysis

- **Direct LLM** (`gemini-flash-latest` 20 free req/day): 429 after 20, 0 tokens overhead now
- **NeuraNet REUSE**: 1.3s vs RESEARCH 26s (20×), 0 Tavily, 0 LLM, 0 tokens overhead
- **RESEARCH with NeuraNet**: same LLM, same tokens (0 overhead), `knowledgeLookupMs 5-15ms` ≪ `researchMs` 26s

## Benchmarks

- `tests/agentC-strategy` 9/9, `knowledge` 4/4, `evolution` 6/6, `zero-context` 10/10 → 29/29 PASS
- `benchmark-same-model.js`: OpenRouter 236→236 (0), Groq 241→241 (0), model unchanged YES
- `benchmark-quantitative` 10 tasks: REUSE 90% (9/10), Tavily 100% avoided
- `benchmark-90` 20 runs: REUSE 98.9% (but isolation missing, cold also REUSE)

## Remaining Limitations

- `successful_approaches` vides → extraction via `strategy` générique
- 1 task pour Gates, 20 runs partiels
- Gemini 503/429 transient, needs retry
- `Evaluator` heuristic, not LLM judge

## Next Steps

- Scheduler 90 runs avec `productionId` tracking et isolation `cold` (clean before)
- `CodeEvaluator` sandbox réel (compilation/tests)
- `source`/`query` reputation persistée

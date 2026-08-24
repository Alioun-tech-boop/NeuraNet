# NeuraNet Zero-Context Audit

## Current Context Injections (Violations)

**AgentC LLM prompt** `src/agents/agentC.js:247`:
```js
`Task: ${task}\nSelected strategies: ${ranking.selected.map(s=>s.strategy).join('; ')}\nResearch plan: ${JSON.stringify(researchPlan.incorporatedSteps)}\nSearch results: ${JSON.stringify(researchResult.searchResults.slice(0,3).map(...))}\n\nGenerate research analysis...`
```
→ Injects 3× knowledge (strategies, plan, search results) into LLM prompt. Overhead ~400-600 tokens per call. **Must be removed**: LLM should receive only `task`.

**Universal API** `src/routes/universal.js:60`:
```js
`Relevant collective knowledge for ${domain}: Use official sources...\n\nTask: ${task}`
```
→ 33 tokens injected. **Must be removed**: LLM should receive only `task`.

**AgentA/B** `src/agents/agentA.js:1` similar: `Selected strategies` + `Search results` in LLM prompt.

**Knowledge/Experience retrieval** `src/routes/knowledge.js:1` : Does NOT inject into LLM prompt directly, but `AgentC` does. The `production` is created after LLM, so no injection there.

**ResearchPath** `src/researchPath/repository.js:1` : `getCanonicalPath` is lightweight (DB lookup <100ms), but currently `AgentC` still does full `strategy extraction` via LLM-like ranking on critical path. Should be async.

## Required Fixes

1. **Remove all `prompt += knowledge/strategy` in agents** — LLM prompt = `task` only (or `task` + system prompt that existed before NeuraNet).
2. **Add `assertNeuraNetContextZero()` guard** — compare `originalMessages` vs `finalMessages` hash, fail if NeuraNet added context.
3. **Move optimization to environment** — Instead of telling LLM `Prioritize government sources`, NeuraNet directly executes optimized search (e.g., `site:energycom.gov.gh` query) and provides tool results to LLM as normal tool output, not as injected knowledge.
4. **Async learning** — `strategy extraction`, `path comparison`, `canonical update` already partially async via `optimizer.emit` in `knowledge.js:253` (`setImmediate`), but `AgentC` still does sync `retrieve → extract → rank → plan` (6 steps) on critical path. Move to `optimizer` async, keep `knowledge lookup` + `path lookup` sync (both <100ms).

## Existing Compliance

- `Knowledge API` `REUSE` path: 0 Tavily, 0 LLM — already zero overhead for reuse, good.
- `ProductionEngine` `freshness`, `quality` — generic, reusable.
- `Provider adapters` — model-agnostic, no routing.

## Non-compliant Areas to Fix

- `src/agents/agentA.js:1`, `agentB.js:1`, `agentC.js:1` — remove strategy injection
- `src/routes/universal.js:60` — remove `knowledgeContext`
- `src/routes/knowledge.js:247` — LLM prompt should be `task` only
- Add `src/neuraNet/contextGuard.js` with `assertNeuraNetContextZero`
- Add metrics `originalInputTokens` vs `finalInputTokens` with `contextOverhead = 0` check

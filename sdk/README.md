# @neuranet/sdk

Official Node.js SDK for **NeuraNet** — Procedural Experience Infrastructure for AI Agents.

Zero dependencies. Node ≥ 18 (native fetch).

## Install

```bash
npm install @neuranet/sdk        # once published
# or, from this repository:
npm install /path/to/neuranet/sdk
```

## Quickstart

```js
import { NeuraNet } from '@neuranet/sdk';

const nn = new NeuraNet({
  baseUrl: 'http://localhost:3000',
  apiKey: process.env.NEURANET_API_KEY,
});

// Deterministic strategy selection — 0 LLM calls, 0 injected context
const sel = await nn.paths.select({ task: 'Identify the banking regulator of Ghana' });
console.log(sel.decision);            // 'REUSE_PATH' | 'RESEARCH'
console.log(sel.selectionLLMCalls);   // 0

// Record the outcome → feeds Pareto elimination & convergence
await nn.neurannet.observe({
  task: sel.task ?? 'Identify the banking regulator of Ghana',
  familyId: sel.selectedPath?.family_id,
  metrics: { success: true, quality: 0.91, latency_ms: 1200 },
});
```

### One-line learning loop

```js
const session = await nn.learn('Find Nigeria power sector licensing rules');

if (session.decision === 'REUSE_PATH') {
  // execute with YOUR model; the learned path guides tools only
}

// later…
await session.report({ success: true, quality: 0.88, latency_ms: 1500 });
```

### Live pipeline (arbitrary question, full cycle)

```js
const run = await nn.demo.run('Quel organisme régule les banques au Sénégal ?');
run.variant;                    // 'new' | 'transfer'
run.retrieval.similarity;       // e.g. 0.89 on a differently-worded repeat
run.result.answer;              // language-matched to your question
run.result.delta;               // guided vs baseline score gap
run.invariants;                 // { contextTokens: 0, matchingLLMCalls: 0 }
```

### API key administration (admin scope or X-Admin-Token)

```js
const created = await nn.apiKeys.create({ name: 'ci-runner', admin: false });
console.log(created.key);       // shown ONCE — store it now

await nn.apiKeys.list();
await nn.apiKeys.revoke(created.id, 'rotated');
```

## Error handling

All failures throw `NeuraNetError`:

| code | meaning |
|------|---------|
| `UNAUTHORIZED` | missing/invalid API key (401) |
| `FORBIDDEN` | insufficient scope (403) |
| `RATE_LIMITED` | 429 — auto-retried with backoff before surfacing |
| `SERVER_ERROR` | 5xx — auto-retried |
| `REQUEST_FAILED` | other 4xx |

Each error carries `.status`, `.requestId` (for support) and `.body`.

## Guarantees

- Your API key is sent only to your configured `baseUrl`, never logged.
- NeuraNet never selects your LLM provider and never injects history into prompts.
- The SDK stores nothing; it is a thin typed transport.

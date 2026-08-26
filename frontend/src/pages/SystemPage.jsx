import { useState } from 'react';
import { Server, Webhook, Settings2, ShieldCheck } from 'lucide-react';
import { getApiKey, getApiBase } from '../data/neuranetDemo.js';

export default function SystemPage({ tab = 'system' }) {
  const [apiBase, setApiBase] = useState(getApiBase() || 'http://localhost:3000');
  const [apiKey, setApiKey] = useState(getApiKey());
  const [saved, setSaved] = useState(false);

  function save() {
    localStorage.setItem('nn_api_base', apiBase);
    if (apiKey) localStorage.setItem('nn_api_key', apiKey);
    else localStorage.removeItem('nn_api_key'); // fall back to build-time env
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="mx-auto max-w-[900px] px-8 pb-16 pt-8">
      {tab === 'system' && (
        <>
          <div className="mb-6 flex items-center gap-2 text-low"><Server size={14} /><div className="panel-title">System</div></div>
          <dl className="panel divide-y divide-line px-6 py-2">
            {[
              ['Service', 'NeuraNet API v0.1.0'],
              ['Path engine', 'Pareto elimination · deterministic selection'],
              ['Embeddings', 'E5 multilingual-small · 384 dims (infrastructure layer)'],
              ['Vector store', 'PostgreSQL + pgvector'],
              ['Answer caching', 'Disabled by design — strategies only, never answers'],
              ['Context injection', '0 tokens — enforced invariant'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 py-3.5">
                <dt className="text-[13px] text-mid">{k}</dt>
                <dd className="text-right text-[12.5px] font-medium text-hi">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {tab === 'api' && (
        <>
          <div className="mb-6 flex items-center gap-2 text-low"><Webhook size={14} /><div className="panel-title">API</div></div>
          <section className="panel p-6">
            <h2 className="text-[15px] font-semibold">Quickstart</h2>
            <pre className="mono-num mt-3 overflow-x-auto rounded-lg border border-line bg-ink-900 p-4 text-[12px] leading-relaxed text-mid">{`curl -X POST ${apiBase}/v1/neurannet/select \\
  -H "X-API-Key: $NEURANET_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"task":"Identify the banking regulator of Ghana","workflow":"research"}'

# → {"decision":"REUSE_PATH","selectionLLMCalls":0,"contextAddedTokens":0}`}</pre>
            <p className="mt-3 text-[12.5px] leading-relaxed text-low">
              Record outcomes with <code className="text-sem">POST /v1/neurannet/observe</code> — quality, latency and cost
              feed Pareto elimination. The engine learns; your agent keeps its own model.
            </p>
          </section>
        </>
      )}

      {tab === 'settings' && (
        <>
          <div className="mb-6 flex items-center gap-2 text-low"><Settings2 size={14} /><div className="panel-title">Settings</div></div>
          <section className="panel max-w-xl p-6">
            <label htmlFor="apibase" className="text-[11px] font-semibold uppercase tracking-[0.13em] text-low">API base URL</label>
            <input id="apibase" value={apiBase} onChange={(e) => setApiBase(e.target.value)}
              className="mono-num mt-2 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-[13px]" />

            <label htmlFor="apikey" className="mt-5 block text-[11px] font-semibold uppercase tracking-[0.13em] text-low">API key</label>
            <input id="apikey" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="nn_…"
              className="mt-2 w-full rounded-lg border border-line bg-ink-900 px-3 py-2 text-[13px]" />
            <p className="mt-2 text-[11.5px] text-low">Stored in this browser's localStorage only. Never sent anywhere except your API base.</p>

            <button onClick={save} className="mt-5 rounded-lg bg-semdeep px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#6b82f3]">
              {saved ? 'Saved ✓' : 'Save'}
            </button>
          </section>
          <p className="mt-5 flex items-start gap-2 text-[11.5px] text-low">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-ok" />
            NeuraNet never sees or stores provider keys for your LLM — model calls belong entirely to the caller.
          </p>
        </>
      )}
    </div>
  );
}

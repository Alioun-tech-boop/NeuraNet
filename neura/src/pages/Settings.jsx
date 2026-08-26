import { useState } from 'react';

export default function Settings() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('nn_api_key') || '');
  const [base, setBase] = useState(localStorage.getItem('nn_api_base') || '');

  function save() {
    if (apiKey) localStorage.setItem('nn_api_key', apiKey); else localStorage.removeItem('nn_api_key');
    if (base.trim()) localStorage.setItem('nn_api_base', base.trim()); else localStorage.removeItem('nn_api_base');
    alert('Saved');
  }

  return (
    <div className="mx-auto max-w-[720px] px-8 py-8">
      <h1 className="text-[22px] font-bold tracking-tight">Settings</h1>

      <section className="mt-8 rounded-2xl border border-neura-border bg-neura-panel p-6">
        <h2 className="text-[13px] font-semibold">API Keys</h2>
        <p className="mt-1 text-[12px] text-neura-muted">Stored in this browser only. Never sent except to your API base.</p>
        <input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="nn_live_..." type="password"
          className="mt-3 w-full rounded-xl border border-neura-border bg-neura-bg px-3 py-2 text-[13px] font-mono" />
        <input value={base} onChange={e => setBase(e.target.value)} placeholder="(empty = same origin)"
          className="mt-3 w-full rounded-xl border border-neura-border bg-neura-bg px-3 py-2 text-[13px] font-mono" />
        <button onClick={save} className="mt-4 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-neura-bg">Save</button>
      </section>

      <section className="mt-6 rounded-2xl border border-neura-border bg-neura-panel p-6">
        <h2 className="text-[13px] font-semibold">Privacy</h2>
        <div className="mt-2 text-[12.5px] leading-relaxed text-neura-sub">
          <div><span className="font-medium text-neura-hi">Personal experience</span> — strategies learned from your tasks, scoped to your organization.</div>
          <div className="mt-2"><span className="font-medium text-neura-hi">Collective experience</span> — <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">Coming soon</span> — cross-organization sharing is not yet enabled.</div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-neura-border bg-neura-panel p-6">
        <h2 className="text-[13px] font-semibold">Appearance</h2>
        <div className="mt-2 text-[12.5px] text-neura-muted">Dark-first premium workspace. Light mode coming soon.</div>
      </section>

      <section className="mt-6 rounded-2xl border border-neura-border bg-neura-panel p-6">
        <h2 className="text-[13px] font-semibold">Keyboard shortcuts</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] font-mono">
          <span className="text-neura-muted">⌘ K — Search</span>
          <span className="text-neura-muted">⌘ N — New chat</span>
          <span className="text-neura-muted">⌘ , — Settings</span>
          <span className="text-neura-muted">Esc — Close panel</span>
        </div>
      </section>
    </div>
  );
}

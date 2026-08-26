import { useState } from 'react';

const TABS = ['Terminal','Tests','Output','Diff','Agent'];

export default function TerminalPanel({ activeTab: propTab, onTabChange, logs = [] }) {
  const [tab, setTab] = useState(propTab || 'Terminal');
  const current = propTab ?? tab;
  const setCurrent = onTabChange ?? setTab;

  return (
    <div className="flex h-full flex-col border-t border-neura-border bg-[#0B0E13]">
      <div className="flex items-center gap-1 border-b border-neura-border px-2">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setCurrent(t)}
            className={`rounded-t-lg px-3 py-2 text-[12px] font-medium ${current === t ? 'bg-neura-panel text-neura-hi' : 'text-neura-muted hover:text-neura-hi'}`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto font-mono text-[11px] text-neura-muted">via secure backend · never direct browser exec</span>
      </div>
      <div className="flex-1 overflow-auto p-3 font-mono text-[12px] leading-relaxed">
        {current === 'Terminal' && (
          <div className="space-y-1 text-neura-sub">
            <div><span className="text-violet-400">$</span> npm test</div>
            {logs.length ? logs.map((l, i) => <div key={i} className={l.ok ? 'text-emerald-400' : 'text-neura-sub'}>{l.text}</div>) : <div className="text-neura-muted">No output yet — run the agent to see results.</div>}
          </div>
        )}
        {current === 'Tests' && <div className="text-neura-muted">Tests tab — results stream here after agent run.</div>}
        {current === 'Output' && <div className="text-neura-muted">Output — build and execution logs.</div>}
        {current === 'Diff' && <div className="text-neura-muted">Diff — review changes before accepting.</div>}
        {current === 'Agent' && <div className="text-neura-muted">Agent activity — high-level steps only, no chain-of-thought.</div>}
      </div>
    </div>
  );
}

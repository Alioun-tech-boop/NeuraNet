import { useEffect, useState } from 'react';
import { getStatus } from '../lib/neuraAdapter.js';

function Dot({ ok }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'} shadow-[0_0_8px_currentColor]`} />;
}

export default function SystemStatus({ compact = false }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let mounted = true;
    getStatus().then(s => { if (mounted) setStatus(s); }).catch(() => {});
    const id = setInterval(() => getStatus().then(s => { if (mounted) setStatus(s); }).catch(() => {}), 15000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  if (compact) {
    const ok = status?.neuranet?.active && status?.database?.connected;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-neura-border bg-neura-panel text-neura-muted'}`}>
        <Dot ok={ok} /> {ok ? 'All systems operational' : 'Checking…'}
      </span>
    );
  }

  const rows = [
    ['LLM', status?.llm?.status === 'connected'],
    ['NeuraNet', status?.neuranet?.active],
    ['Semantic retrieval', status?.retrieval?.active],
    ['Database', status?.database?.connected],
    ['Experience engine', status?.experienceEngine?.learning],
  ];

  return (
    <div className="rounded-2xl border border-neura-border bg-neura-panel p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neura-muted">NEURA SYSTEM</div>
      <div className="mt-3 space-y-2">
        {rows.map(([label, ok]) => (
          <div key={label} className="flex items-center justify-between text-[13px]">
            <span className="text-neura-sub">{label}</span>
            <span className="flex items-center gap-1.5 text-[12px]"><Dot ok={!!ok} /> {ok ? 'Active' : ok === false ? 'Unavailable' : '…'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

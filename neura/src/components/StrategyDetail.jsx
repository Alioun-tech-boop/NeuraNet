import { ArrowLeft } from 'lucide-react';

export default function StrategyDetail({ strategy, onBack }) {
  const steps = Array.isArray(strategy.steps) ? strategy.steps : strategy.steps?.steps || [];
  return (
    <div className="mx-auto max-w-[880px] px-8 py-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-neura-muted hover:text-neura-hi">
        <ArrowLeft size={14} /> Back to experiences
      </button>
      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="font-mono text-[18px] font-bold">{strategy.path || strategy.name}</h1>
        <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">ACTIVE</span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Executions', strategy.executions ?? 24],
          ['Successful', strategy.successful ?? 21],
          ['Avg quality', (strategy.confidence ?? 0.89).toFixed ? (strategy.confidence).toFixed(2) : strategy.confidence],
          ['Transfers', strategy.transfers ?? 12],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-neura-border bg-neura-panel p-4">
            <div className="text-[11px] uppercase tracking-[0.14em] text-neura-muted">{k}</div>
            <div className="mt-1 font-mono text-[22px] font-bold">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-neura-border bg-neura-panel p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neura-muted">Workflow</div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {steps.map((s, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="rounded-xl border border-neura-border bg-neura-surface px-3 py-1.5 text-[13px]">{typeof s === 'string' ? s : s.label}</span>
              {i < steps.length - 1 && <span className="text-neura-muted">→</span>}
            </span>
          ))}
        </div>
        <div className="mt-4 text-[11px] text-neura-muted">Procedural metadata only — no model chain-of-thought exposed.</div>
      </div>
    </div>
  );
}

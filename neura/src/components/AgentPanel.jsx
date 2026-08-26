import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, Check } from 'lucide-react';

const MODES = ['ASK','EDIT','AUTONOMOUS'];

export default function AgentPanel({ mode, onModeChange, activity = [], onAction }) {
  return (
    <div className="flex h-full flex-col bg-neura-surface">
      <div className="border-b border-neura-border p-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-400" />
          <span className="text-[12px] font-semibold uppercase tracking-[0.14em]">NEURA AGENT</span>
          <span className="ml-auto rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">{mode}</span>
        </div>
        <div className="mt-3 flex gap-1 rounded-full bg-neura-panel p-1">
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`flex-1 rounded-full px-2 py-1 text-[11px] font-semibold ${mode === m ? 'bg-white text-neura-bg' : 'text-neura-muted hover:text-neura-hi'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        {activity.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neura-border p-4 text-center text-[12px] text-neura-muted">
            Agent idle — describe what to build and press Run.
          </div>
        ) : (
          <div className="space-y-2">
            {activity.map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 rounded-xl border border-neura-border bg-neura-panel px-3 py-2">
                <span className={`h-2 w-2 rounded-full ${a.done ? 'bg-emerald-500' : 'animate-pulse bg-violet-400'}`} />
                <span className="text-[12.5px] text-neura-sub">{a.label}</span>
                {a.done && <Check size={12} className="ml-auto text-emerald-400" />}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-neura-border p-3">
        <div className="flex items-center gap-1.5 text-[11px] text-neura-muted">
          <ShieldCheck size={12} className="text-emerald-400" /> Permissions: {mode === 'ASK' ? 'read-only' : mode === 'EDIT' ? 'confirm before write' : 'autonomous within project'}
        </div>
        {onAction && (
          <button onClick={onAction} className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-neura-bg">
            Run agent
          </button>
        )}
      </div>
    </div>
  );
}

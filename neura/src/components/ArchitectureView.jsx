import { motion } from 'framer-motion';

const STEPS = ['USER','NEURA','NEURANET','SEMANTIC RETRIEVAL','STRATEGY','SELECTED MODEL','TOOLS','RESULT','EXPERIENCE UPDATE'];

export default function ArchitectureView() {
  return (
    <div className="rounded-2xl border border-neura-border bg-neura-panel p-6">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neura-muted">Developer view — data flow</div>
      <div className="mt-4 flex flex-col items-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`rounded-xl border px-5 py-2.5 text-[12px] font-semibold tracking-wide ${label === 'NEURANET' ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : label === 'SELECTED MODEL' ? 'border-neura-accent/30 bg-neura-accent/10 text-neura-accent' : 'border-neura-border bg-neura-surface text-neura-hi'}`}
            >
              {label}
            </motion.div>
            {i < STEPS.length - 1 && (
              <motion.div initial={{ height: 0 }} animate={{ height: 18 }} transition={{ delay: i * 0.06 + 0.12 }} className="w-px bg-gradient-to-b from-neura-border to-transparent" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-neura-muted">
        {['0 historical tokens injected','0 LLM calls for matching','provider-neutral','no answer caching'].map(t => (
          <span key={t} className="rounded-full border border-neura-border bg-neura-surface px-2.5 py-1">{t}</span>
        ))}
      </div>
    </div>
  );
}

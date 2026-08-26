import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function ExperiencePanel({ experience, open, onClose }) {
  if (!open || !experience) return null;
  return (
    <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} className="rounded-2xl border border-neura-border bg-neura-elevated p-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neura-muted">✦ NEURA EXPERIENCE</div>
        <button onClick={onClose} className="text-neura-muted hover:text-neura-hi"><X size={14} /></button>
      </div>
      <div className="mt-3 text-[13px] text-neura-hi">
        {experience.found ? (
          <>
            <div className="font-medium">Strategy adapted from previous tasks</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-lg border border-neura-border bg-neura-panel px-3 py-2">
                <div className="text-neura-muted text-[10px] uppercase tracking-widest">Semantic match</div>
                <div className="font-mono font-semibold text-violet-300">{experience.similarity != null ? experience.similarity.toFixed(2) : '—'}</div>
              </div>
              <div className="rounded-lg border border-neura-border bg-neura-panel px-3 py-2">
                <div className="text-neura-muted text-[10px] uppercase tracking-widest">Compatibility</div>
                <div className="font-semibold text-emerald-400">✓ passed</div>
              </div>
            </div>
            <div className="mt-2 text-[12px] text-neura-sub">Path <span className="font-mono text-neura-hi">{experience.strategyPath || experience.topMatch?.path}</span></div>
          </>
        ) : (
          <div className="text-neura-sub">No relevant experience yet. This execution will create a new strategy for future tasks in this class.</div>
        )}
      </div>
      <div className="mt-3 text-[11px] text-neura-muted">Operational metadata only — no private reasoning exposed.</div>
    </motion.div>
  );
}

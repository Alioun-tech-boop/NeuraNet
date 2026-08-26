import { motion } from 'framer-motion';
import { Check, X, ShieldCheck } from 'lucide-react';
import { COMPATIBILITY } from '../data/neuranetDemo.js';

export default function CompatibilityPanel({ visible = true }) {
  if (!visible) return null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="panel p-5"
      aria-label="Hard compatibility filter"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck size={13} className="text-sem" strokeWidth={2} />
        <div className="panel-title">Hard Compatibility</div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {COMPATIBILITY.passed.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-[12.5px]">
            <Check size={13} strokeWidth={2.4} className="shrink-0 text-ok" />
            <span className="text-mid">{p.label}:</span>
            <span className="font-medium text-hi">{p.value}</span>
          </li>
        ))}
      </ul>

      <div className="my-3 border-t border-line" />

      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-low">Rejected — similarity alone does not transfer</div>
      <ul className="space-y-1.5">
        {COMPATIBILITY.rejected.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-[12.5px]">
            <X size={13} strokeWidth={2.4} className="shrink-0 text-err" />
            <span className="text-mid">{r.label}</span>
            <span className="ml-auto text-[11px] text-low">{r.reason}</span>
          </li>
        ))}
      </ul>
    </motion.section>
  );
}

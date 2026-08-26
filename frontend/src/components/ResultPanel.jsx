import { motion } from 'framer-motion';
import { Check, FileText } from 'lucide-react';
import { RESULT } from '../data/neuranetDemo.js';

export default function ResultPanel({ visible }) {
  if (!visible) return null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="panel p-6"
      aria-label="Execution result"
    >
      <div className="panel-title">Result</div>

      <div className="mono-num mt-3 text-[30px] font-bold leading-tight tracking-tight text-hi">{RESULT.answer}</div>

      <ul className="mt-4 space-y-1.5">
        {RESULT.verification.map((v) => (
          <li key={v} className="flex items-center gap-2 text-[13px]">
            <Check size={14} strokeWidth={2.4} className="shrink-0 text-ok" />
            <span className="text-mid">{v}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 rounded-lg border border-line bg-ink-800 p-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-low">
          <FileText size={12} /> Sources
        </div>
        {RESULT.sources.map((s) => (
          <div key={s.title} className="text-[13px]">
            <span className="font-medium text-hi">{s.title}</span>
            <span className="block text-[12px] text-low">{s.detail}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-low">Quality</div>
          <div className="mono-num text-[26px] font-bold leading-none text-ok">{RESULT.quality.toFixed(2)}</div>
        </div>
        <motion.span
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.3 }}
          className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-1.5 text-[12px] font-semibold text-ok"
        >
          {RESULT.baselineDelta} quality vs baseline
        </motion.span>
      </div>
    </motion.section>
  );
}

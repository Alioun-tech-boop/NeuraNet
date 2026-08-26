import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { DEMO_TASKS } from '../data/neuranetDemo.js';

export default function TransferPanel() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="panel overflow-hidden"
      aria-label="Strategy transfer"
    >
      <div className="border-b border-line px-5 py-3">
        <div className="panel-title">Strategy Transfer — procedural knowledge, not a cache hit</div>
      </div>

      <div className="grid gap-0 sm:grid-cols-[1fr_auto_1fr]">
        <div className="px-5 py-4">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-low">Previous task</div>
          <p className="mt-1.5 text-[13px] italic leading-relaxed text-mid">“{DEMO_TASKS.first.text}”</p>
        </div>
        <div className="flex items-center justify-center px-2">
          <ArrowRight size={18} className="rotate-90 text-sem sm:rotate-0" aria-hidden="true" />
        </div>
        <div className="border-t border-line px-5 py-4 sm:border-l sm:border-t-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sem">Current task</div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-hi">“{DEMO_TASKS.second.text}”</p>
        </div>
      </div>

      <div className="grid grid-cols-2 border-y border-line bg-ink-800/60">
        <div className="px-5 py-3.5 text-center sm:border-r border-line">
          <div className="text-[10.5px] uppercase tracking-[0.15em] text-low">Lexical similarity</div>
          <div className="mono-num mt-0.5 text-[17px] font-bold uppercase tracking-wide text-warn">Low</div>
        </div>
        <div className="px-5 py-3.5 text-center">
          <div className="text-[10.5px] uppercase tracking-[0.15em] text-low">Semantic similarity</div>
          <div className="mono-num mt-0.5 text-[17px] font-bold text-sem">0.89</div>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <div className="text-[11px] text-low">Retrieved strategy</div>
          <div className="mono-num text-[13.5px] font-semibold text-hi">research/ghana-regulator/v1</div>
        </div>
        <span className="flex items-center gap-1.5 rounded-md border border-ok/40 bg-ok/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-ok">
          <CheckCircle2 size={12} strokeWidth={2.4} /> Confirmed
        </span>
      </div>
    </motion.section>
  );
}

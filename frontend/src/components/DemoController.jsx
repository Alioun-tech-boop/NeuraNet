import { Play, ArrowRight, X, Presentation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * YC Demo Mode control bar.
 * Scripted sequence:
 *   1 Run first task → 2 new strategy stored → 3 semantic transfer →
 *   4 retrieval + result → 5 jump to benchmark proof.
 */
export default function DemoController({ phase, onRunFirst, onRunSecond, onExit }) {
  return (
    <AnimatePresence>
      <motion.div
        key="demo-bar"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
      >
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-sem/25 bg-ink-850/95 py-2 pl-5 pr-2 shadow-[0_8px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
          <Presentation size={14} className="text-sem" aria-hidden="true" />
          <span className="mr-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-mid">YC Demo</span>

          {(phase === 'idle') && (
            <button onClick={onRunFirst} className="flex items-center gap-1.5 rounded-full bg-semdeep px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#6b82f3]">
              <Play size={12} /> Run task 1 — learn a strategy
            </button>
          )}

          {phase === 'running1' && <span className="px-3 text-[12.5px] text-low">Executing… creating procedural experience</span>}
          {phase === 'done1' && (
            <button onClick={onRunSecond} className="flex items-center gap-1.5 rounded-full bg-semdeep px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#6b82f3]">
              Run task 2 — different wording, same problem <ArrowRight size={12} />
            </button>
          )}
          {phase === 'running2' && <span className="px-3 text-[12.5px] text-low">Retrieving… transferring strategy</span>}

          {phase === 'done2' && (
            <span className="px-3 text-[12.5px] font-medium text-ok">Strategy transferred ✓ — show the result, then benchmarks</span>
          )}

          <button
            onClick={onExit}
            aria-label="Exit demo mode"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-low hover:bg-white/[0.06] hover:text-hi"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

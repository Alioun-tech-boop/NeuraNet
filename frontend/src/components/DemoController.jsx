import { X, Presentation } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * YC Demo Mode control bar — free-question flow.
 *  1. Ask any question → RUN AGENT (new strategy learned)
 *  2. Rephrase it differently → RUN again (semantic transfer, the wow moment)
 *  3. Show benchmark proof
 */
export default function DemoController({ phase, onExit }) {
  const hint =
    phase === 'idle' ? '1 · Type any research question and RUN — NeuraNet learns a new strategy'
      : phase === 'running' ? 'Executing real pipeline: E5 retrieval · hard filters · guided search…'
        : phase === 'done-new' ? '2 · Now REPHRASE the same question with different words and RUN again — watch the semantic transfer'
          : '3 · Transfer confirmed ✓ — scroll to the result, then show the benchmark proof';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
    >
      <div className="flex max-w-[720px] items-center gap-3 rounded-full border border-sem/25 bg-ink-850/95 py-2.5 pl-5 pr-2 shadow-[0_8px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <Presentation size={14} className="shrink-0 text-sem" aria-hidden="true" />
        <span className="text-[12.5px] font-medium text-hi">{hint}</span>
        <button
          onClick={onExit}
          aria-label="Exit demo mode"
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-low hover:bg-white/[0.06] hover:text-hi"
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Sparkles } from 'lucide-react';
import { chat as neuraChat } from '../lib/neuraAdapter.js';

const DEMO_TASKS = [
  'Identify the banking regulator of Ghana and verify it using official sources.',
  'Determine which institution supervises banking establishments operating in Ghana.',
];

export default function NeuraDemoMode({ onClose, onDemoMessage }) {
  const [phase, setPhase] = useState('idle'); // idle | running1 | done1 | running2 | done
  const [result, setResult] = useState(null);

  async function run(taskIdx) {
    const task = DEMO_TASKS[taskIdx];
    setPhase(taskIdx === 0 ? 'running1' : 'running2');
    onDemoMessage?.({ role: 'user', content: task });
    try {
      const res = await neuraChat({ message: task, model: { provider: 'groq', id: 'allam-2-7b' } });
      onDemoMessage?.({ role: 'assistant', content: res.reply, experience: res.experience, sources: res.sources });
      setResult(res);
      setPhase(taskIdx === 0 ? 'done1' : 'done');
    } catch (e) {
      onDemoMessage?.({ role: 'assistant', content: `Demo error: ${e.message}`, error: true });
      setPhase('idle');
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <motion.div initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-[560px] rounded-[20px] border border-neura-border bg-neura-panel p-6 shadow-neura">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neura-muted">Demo Mode — real NeuraNet infrastructure</span>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-neura-muted hover:bg-white/10 hover:text-neura-hi"><X size={16} /></button>
        </div>

        <h2 className="mt-4 text-[18px] font-bold leading-snug">Watch Neura learn and transfer a strategy</h2>
        <p className="mt-1 text-[13px] text-neura-muted">Two differently-worded tasks, same underlying problem. The second one reuses the first one's strategy — semantically.</p>

        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-neura-border bg-neura-surface p-4">
            <div className="text-[11px] uppercase tracking-widest text-neura-muted">Task 1 — new experience</div>
            <div className="mt-1 text-[13px] italic text-neura-sub">“{DEMO_TASKS[0]}”</div>
            {phase === 'running1' && <div className="mt-2 text-[12px] text-violet-300 animate-pulse">Running through NeuraNet…</div>}
            {phase === 'done1' && result && <div className="mt-2 text-[12px] text-emerald-400">✓ Strategy stored — {result.experience?.strategyPath || 'new path'}</div>}
          </div>
          <div className="rounded-xl border border-neura-border bg-neura-surface p-4">
            <div className="text-[11px] uppercase tracking-widest text-neura-muted">Task 2 — differently worded, same class</div>
            <div className="mt-1 text-[13px] italic text-neura-sub">“{DEMO_TASKS[1]}”</div>
            {phase === 'running2' && <div className="mt-2 text-[12px] text-violet-300 animate-pulse">Retrieving relevant experience…</div>}
            {phase === 'done' && result?.experience?.found && (
              <div className="mt-2 rounded-lg bg-violet-500/10 p-2 text-[12px] text-violet-300">
                ✦ Experience found — {result.experience.similarity?.toFixed(2)} semantic match · {result.experience.strategyPath} transferred
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          {phase === 'idle' && <button onClick={() => run(0)} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-neura-bg"><Play size={14} /> Run task 1</button>}
          {phase === 'done1' && <button onClick={() => run(1)} className="flex items-center gap-1.5 rounded-xl bg-neura-accent px-4 py-2 text-[13px] font-semibold text-white"><Play size={14} /> Run task 2 — differently worded</button>}
          {(phase === 'running1' || phase === 'running2') && <div className="rounded-xl bg-neura-accent/20 px-4 py-2 text-[13px] text-neura-accent">Executing…</div>}
          {phase === 'done' && <button onClick={onClose} className="rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-neura-bg">Continue in workspace</button>}
          <button onClick={onClose} className="rounded-xl border border-neura-border px-4 py-2 text-[13px] text-neura-muted">Close</button>
        </div>

        <div className="mt-4 text-[11px] text-neura-muted">Calls the real NeuraNet: E5 embeddings, pgvector, hard compatibility, Pareto — 0 LLM calls for matching.</div>
      </motion.div>
    </motion.div>
  );
}

import Composer from '../components/Composer.jsx';
import { motion } from 'framer-motion';
import { Search, FileText, Code2, Lightbulb, BarChart3, PenLine } from 'lucide-react';

const SUGGESTIONS = [
  { icon: Search, label: 'Research a market', prompt: 'Research the current market landscape for renewable energy in West Africa' },
  { icon: FileText, label: 'Analyze a document', prompt: 'Analyze this document and extract the key risks and opportunities' },
  { icon: Code2, label: 'Write code', prompt: 'Build a rate limiter middleware for an Express.js API with Redis' },
  { icon: BarChart3, label: 'Build a strategy', prompt: 'Build an investment strategy for a conservative portfolio in volatile markets' },
  { icon: Lightbulb, label: 'Explore an idea', prompt: 'Explore the implications of AI agents that learn procedural strategies' },
  { icon: PenLine, label: 'Draft a memo', prompt: 'Draft a memo on data protection compliance for a fintech operating in Ghana' },
];

export default function Home({ onSend, selectedModel, projectId }) {
  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-[720px] text-center">
        <h1 className="text-[42px] font-extrabold tracking-tight leading-none">
          <span className="bg-gradient-to-r from-neura-hi to-neura-sub bg-clip-text text-transparent">NEURA</span>
        </h1>
        <p className="mt-3 text-[18px] font-medium leading-snug text-neura-hi">
          Think with any model.<br />
          <span className="text-neura-sub">Learn with every task.</span>
        </p>
        <p className="mt-2 text-[13px] text-neura-muted">Your workspace remembers how you solve — not just what you asked.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="mt-8 w-full max-w-[720px]">
        <Composer onSend={onSend} selectedModel={selectedModel} projectId={projectId} />
        <div className="mt-3 text-center text-[11px] text-neura-muted">Model selected by you · NeuraNet provides the experience</div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-8 grid w-full max-w-[720px] grid-cols-2 gap-2 md:grid-cols-3">
        {SUGGESTIONS.map(s => (
          <button
            key={s.label}
            onClick={() => onSend({ text: s.prompt })}
            className="flex items-center gap-2.5 rounded-2xl border border-neura-border bg-neura-panel px-4 py-3 text-left hover:border-white/10 hover:bg-neura-elevated transition-colors"
          >
            <s.icon size={16} className="shrink-0 text-neura-muted" />
            <span className="text-[13px] font-medium text-neura-hi">{s.label}</span>
          </button>
        ))}
      </motion.div>
    </div>
  );
}

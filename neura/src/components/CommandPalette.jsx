import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MessageSquare, FolderKanban, Layers, Sparkles, Settings, Command, Code2, GitCompare } from 'lucide-react';

const COMMANDS = [
  { id: 'new-chat', label: 'New conversation', icon: MessageSquare, action: 'chat' },
  { id: 'new-code', label: 'New coding task', icon: Code2, action: 'code' },
  { id: 'open-project', label: 'Open project', icon: FolderKanban, action: 'projects' },
  { id: 'open-experience', label: 'Open experience', icon: Layers, action: 'experiences' },
  { id: 'switch-model', label: 'Switch model', icon: Sparkles, action: 'model' },
  { id: 'compare', label: 'Compare models', icon: GitCompare, action: 'compare' },
  { id: 'settings', label: 'Open settings', icon: Settings, action: 'settings' },
];

export default function CommandPalette({ open, onClose, onNavigate }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q) return COMMANDS;
    const s = q.toLowerCase();
    return COMMANDS.filter(c => c.label.toLowerCase().includes(s));
  }, [q]);

  useEffect(() => {
    if (open) setQ('');
  }, [open]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-[2px] p-6 pt-[18vh]" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }} transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#151821] shadow-[0_16px_64px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
            <Search size={16} className="text-neura-muted" />
            <input
              autoFocus
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search, open project, switch model…"
              className="flex-1 bg-transparent text-[14px] placeholder:text-neura-muted focus:outline-none"
            />
            <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-neura-muted">ESC</span>
          </div>
          <div className="max-h-[320px] overflow-auto p-2">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-[13px] text-neura-muted">No results</div>
            ) : filtered.map(c => (
              <button
                key={c.id}
                onClick={() => { onNavigate(c.action); onClose(); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/[0.06]"
              >
                <c.icon size={16} className="text-neura-muted" />
                <span className="text-[13.5px] font-medium">{c.label}</span>
                <Command size={12} className="ml-auto text-neura-muted opacity-60" />
              </button>
            ))}
          </div>
          <div className="border-t border-white/[0.06] px-4 py-2 text-[11px] text-neura-muted">↑↓ navigate · ↵ select · esc close</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

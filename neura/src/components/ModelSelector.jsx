import { useEffect, useState, useRef } from 'react';
import { ChevronDown, Cpu, Zap, Sparkles, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getModels } from '../lib/neuraAdapter.js';

const CATEGORY = {
  Recommended: (m) => ['Allam 2 7B','Llama 3.1 8B Instant'].includes(m.name),
  Reasoning: (m) => m.tags?.includes('reasoning'),
  Coding: (m) => m.tags?.includes('coding'),
  Research: (m) => m.tags?.includes('reasoning') || m.tags?.includes('balanced'),
  Fast: (m) => m.speed === 'very fast' || m.speed === 'fast',
};

export default function ModelSelector({ value, onChange, compact = false }) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    getModels().then(setCatalog).catch(() => setCatalog(null));
  }, []);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fallback = { provider: 'groq', id: 'allam-2-7b', name: 'Allam 2 7B', context: '8K', speed: 'very fast' };
  const current = value || fallback;

  const grouped = (() => {
    if (!catalog) return null;
    const all = catalog.providers.flatMap(p => p.models.map(m => ({ ...m, provider: p.provider, available: p.available })));
    const out = {};
    for (const [cat, fn] of Object.entries(CATEGORY)) out[cat] = all.filter(fn);
    const seen = new Set(Object.values(out).flat().map(m => m.id));
    out.Other = all.filter(m => !seen.has(m.id));
    return out;
  })();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-2.5 rounded-xl border bg-neura-panel px-3.5 py-2 text-left transition-colors hover:border-white/10 ${compact ? 'min-w-[160px]' : 'min-w-[220px]'}`}
      >
        <Cpu size={14} className="text-neura-muted" />
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold leading-none text-neura-hi truncate">{current.name || current.id}</div>
          {!compact && <div className="text-[10.5px] text-neura-muted">{current.provider} · {current.context || '—'}</div>}
        </div>
        <ChevronDown size={14} className={`ml-auto text-neura-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.18 }}
            className="absolute left-0 top-full z-40 mt-2 max-h-[420px] w-[360px] overflow-auto rounded-2xl border border-neura-border bg-neura-panel p-2 shadow-neura"
          >
            {grouped ? Object.entries(grouped).map(([cat, models]) => models.length ? (
              <div key={cat} className="mb-3 last:mb-0">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neura-muted">{cat}</div>
                {models.map(m => (
                  <button
                    key={m.id} role="option" aria-selected={current.id === m.id}
                    onClick={() => { onChange({ provider: m.provider, id: m.id, name: m.name }); setOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/[0.04] ${current.id === m.id ? 'bg-white/[0.06]' : ''} ${!m.available ? 'opacity-50' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-neura-hi flex items-center gap-1.5">
                        {m.name}
                        {m.speed === 'very fast' && <Zap size={11} className="text-amber-400" />}
                        {m.tags?.includes('reasoning') && <Sparkles size={11} className="text-neura-accent" />}
                      </div>
                      <div className="text-[11px] text-neura-muted">{m.provider} · {m.context} · {m.tags?.join(' · ')}</div>
                    </div>
                    {current.id === m.id && <Check size={14} className="text-neura-accent" />}
                  </button>
                ))}
              </div>
            ) : null) : (
              <div className="p-4 text-[13px] text-neura-muted">Loading models…</div>
            )}
            <div className="mt-2 border-t border-neura-border px-3 py-2 text-[11px] text-neura-muted">
              Model selected by you · NeuraNet never chooses your model
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

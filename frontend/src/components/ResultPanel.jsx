import { motion } from 'framer-motion';
import { Check, FileText } from 'lucide-react';

export default function ResultPanel({ data, visible }) {
  if (!visible || !data) return null;
  const d = {
    answer: data.answer,
    sources: data.sources ?? [],
    quality: data.quality,
    baselineQuality: data.baselineQuality,
    delta: data.delta,
  };
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="panel p-6"
      aria-label="Execution result"
    >
      <div className="panel-title">Result</div>

      <p className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap text-[13.5px] leading-relaxed text-hi">{d.answer}</p>

      {d.sources.length > 0 && (
        <div className="mt-5 rounded-lg border border-line bg-ink-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-low">
            <FileText size={12} /> Sources
          </div>
          {d.sources.map((s, i) => (
            <div key={i} className="mb-1.5 last:mb-0 text-[12px]">
              <span className="mr-1.5 font-medium text-hi">{s.title}</span>
              {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="mono-num block break-all text-sem/80 hover:text-sem">{s.url}</a>}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-end justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-low">Quality (guided)</div>
          <div className="mono-num text-[26px] font-bold leading-none text-ok">{d.quality.toFixed(2)}</div>
          <div className="mono-num mt-1 text-[11px] text-low">baseline alone: {d.baselineQuality?.toFixed(2)}</div>
        </div>
        {typeof d.delta === 'number' && (
          <motion.span
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.3 }}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${
              d.delta > 0 ? 'border-ok/40 bg-ok/10 text-ok' : 'border-line bg-ink-800 text-mid'
            }`}
          >
            {d.delta >= 0 ? '+' : ''}{d.delta.toFixed(2)} vs baseline
          </motion.span>
        )}
      </div>
    </motion.section>
  );
}

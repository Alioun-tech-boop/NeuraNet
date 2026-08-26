import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, FileText, Info } from 'lucide-react';

const PART_LABELS = {
  length: 'Completeness (length)',
  structure: 'Structure (lists/sections)',
  specificity: 'Specificity (names, figures, URLs)',
  relevance: 'Relevance to the question',
};

export default function ResultPanel({ data, visible }) {
  const [showBaseline, setShowBaseline] = useState(false);
  if (!visible || !data) return null;
  const d = {
    answer: data.answer,
    sources: data.sources ?? [],
    quality: data.quality,
    breakdown: data.qualityBreakdown ?? null,
    baselineQuality: data.baselineQuality,
    delta: data.delta,
    baselineAnswer: data.baselineAnswer,
  };
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="panel p-6"
      aria-label="Execution result"
    >
      <div className="flex items-center justify-between">
        <div className="panel-title">Result</div>
        {d.baselineAnswer && (
          <button
            onClick={() => setShowBaseline((v) => !v)}
            className="rounded-md border border-line bg-ink-800 px-2.5 py-1 text-[11px] font-medium text-mid hover:text-hi"
          >
            {showBaseline ? '← Back to guided answer' : 'Compare baseline answer'}
          </button>
        )}
      </div>

      {showBaseline ? (
        <>
          <span className="mono-num mt-3 inline-block rounded border border-line bg-ink-800 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-low">
            Baseline — same model, no strategy
          </span>
          <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-mid">{d.baselineAnswer}</p>
        </>
      ) : (
        <p className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap text-[13.5px] leading-relaxed text-hi">{d.answer}</p>
      )}

      {!showBaseline && d.sources.length > 0 && (
        <div className="mt-5 rounded-lg border border-line bg-ink-800 p-4">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-low">
            <FileText size={12} /> Sources used by the strategy
          </div>
          {d.sources.map((s, i) => (
            <div key={i} className="mb-1.5 last:mb-0 text-[12px]">
              <span className="mr-1.5 font-medium text-hi">{s.title}</span>
              {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="mono-num block break-all text-sem/80 hover:text-sem">{s.url}</a>}
            </div>
          ))}
        </div>
      )}

      {/* Quality score + transparent breakdown */}
      <div className="mt-5 rounded-lg border border-line bg-ink-800 p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-low">Quality score</div>
            <div className={`mono-num text-[26px] font-bold leading-none ${showBaseline ? 'text-mid' : 'text-ok'}`}>
              {(showBaseline ? d.baselineQuality : d.quality).toFixed(2)}
            </div>
          </div>
          {typeof d.delta === 'number' && !showBaseline && (
            <motion.span
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35, duration: 0.3 }}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-semibold ${
                d.delta > 0 ? 'border-ok/40 bg-ok/10 text-ok' : 'border-line bg-ink-900 text-mid'
              }`}
            >
              {d.delta >= 0 ? '+' : ''}{d.delta.toFixed(2)} vs baseline
            </motion.span>
          )}
        </div>

        {d.breakdown && !showBaseline && (
          <div className="mt-3 space-y-1.5 border-t border-line pt-3" aria-label="Quality score breakdown">
            {Object.entries(d.breakdown).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2.5 text-[11px]">
                <span className="w-44 shrink-0 text-low">{PART_LABELS[k] ?? k}</span>
                <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-ink-700">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(v, 1) * 100}%` }}
                    transition={{ duration: 0.45 }}
                    className="h-full rounded-full bg-sem/70"
                  />
                </div>
                <span className="mono-num w-9 text-right text-low">{Math.min(v, 1).toFixed(2)}</span>
              </div>
            ))}
            <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-low">
              <Info size={11} className="mt-0.5 shrink-0" />
              Heuristic proxy from 0 to 1 — it measures form and relevance of the answer, not factual truth.
              Weighted: relevance 30%, length 25%, specificity 25%, structure 20%.
            </p>
          </div>
        )}
      </div>
    </motion.section>
  );
}

import { motion } from 'framer-motion';

export default function BenchmarkCard({ title, children, footer }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="panel p-6"
    >
      <div className="panel-title">{title}</div>
      <div className="mt-4">{children}</div>
      {footer && <div className="mt-4 border-t border-line pt-3 text-[11.5px] text-low">{footer}</div>}
    </motion.div>
  );
}

export function CompareStat({ labelA, valueA, labelB, valueB, delta }) {
  return (
    <div className="grid grid-cols-3 items-end gap-4">
      {[ [labelA, valueA], ['Improvement', delta], [labelB, valueB] ].map(([l, v], i) => (
        <div key={l}>
          <div className="text-[11px] uppercase tracking-[0.12em] text-low">{l}</div>
          <div className={`mono-num mt-1 text-[24px] font-bold leading-none ${i === 1 ? 'text-ok' : i === 2 ? 'text-mid' : 'text-hi'}`}>{v}</div>
        </div>
      ))}
    </div>
  );
}

export function LiftStat({ label, mean, ci }) {
  const sig = ci[0] > 0 || ci[1] < 0;
  return (
    <div className="rounded-lg border border-line bg-ink-800 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.12em] text-low">{label}</div>
      <div className={`mono-num mt-1 text-[22px] font-bold leading-none ${sig ? (mean > 0 ? 'text-ok' : 'text-err') : 'text-mid'}`}>
        {mean > 0 ? '+' : ''}{mean.toFixed(3)}
      </div>
      <div className="mono-num mt-1 text-[11.5px] text-low">95% CI [{ci.map((c) => (c > 0 ? '+' : '') + c.toFixed(3)).join(', ')}]</div>
    </div>
  );
}

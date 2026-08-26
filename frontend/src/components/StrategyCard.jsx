import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

export default function StrategyCard({ strategy, transferred = false, compact = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="panel p-5"
      aria-label="Strategy"
    >
      <div className="flex items-center justify-between">
        <div className="panel-title">{transferred ? 'Strategy — transferred' : 'New experience created'}</div>
        {transferred && (
          <span className="rounded-md border border-ok/40 bg-ok/10 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-ok">
            Transfer confirmed
          </span>
        )}
      </div>

      <div className="mono-num mt-2 text-[14.5px] font-semibold text-sem">{strategy.path}</div>

      {!compact && (
        <>
          <ol className="mt-3 space-y-0">
            {strategy.steps.map((s, i) => (
              <li key={s.id} className="flex items-start gap-2.5">
                <span className="mono-num mt-[3px] w-4 shrink-0 text-right text-[10.5px] text-low">{i + 1}</span>
                <span className="text-[13px] text-hi">{s.label}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center gap-5 border-t border-line pt-3 text-[12px]">
            <span className="text-low">
              Status <span className={`ml-1 font-semibold ${strategy.status === 'ACTIVE' ? 'text-ok' : 'text-warn'}`}>{strategy.status}</span>
            </span>
            <span className="text-low">
              Quality <span className="mono-num ml-1 font-semibold text-hi">{strategy.quality.toFixed(2)}</span>
            </span>
            <span className="text-low">
              Executions <span className="mono-num ml-1 font-semibold text-hi">{strategy.executions}</span>
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}

export function StepsFlow({ steps }) {
  return (
    <div className="flex flex-col items-start gap-1">
      {steps.map((s, i) => (
        <div key={s.id ?? i} className="flex items-center gap-2">
          <span className="rounded-md border border-line bg-ink-800 px-3 py-1.5 text-[13px] text-hi">{s.label ?? s}</span>
          {i < steps.length - 1 && <ArrowDown size={12} className="text-low" />}
        </div>
      ))}
    </div>
  );
}

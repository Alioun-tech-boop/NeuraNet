import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

/** Version timeline v1 → vN with notes. */
export default function StrategyTimeline({ history }) {
  if (!history?.length) return <p className="text-[13px] text-low">Single version — no evolution yet.</p>;
  return (
    <ol className="relative ml-2 border-l border-line pl-6">
      {history.map((h, i) => (
        <motion.li
          key={h.version}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: i * 0.08 }}
          className="relative pb-6 last:pb-0"
        >
          <span
            className={`absolute -left-[31px] flex h-[22px] w-[22px] items-center justify-center rounded-full border text-[9px] font-bold ${
              i === history.length - 1 ? 'border-ok/50 bg-ok/10 text-ok' : 'border-line bg-ink-800 text-mid'
            }`}
          >
            {h.version}
          </span>
          <div className="flex items-baseline gap-3">
            <time className="mono-num text-[11.5px] text-low">{h.date}</time>
          </div>
          <p className="mt-0.5 text-[13px] text-mid">{h.note}</p>
          {i < history.length - 1 && <ArrowDown size={11} className="absolute -left-[6px] bottom-[-14px] hidden" aria-hidden="true" />}
        </motion.li>
      ))}
    </ol>
  );
}

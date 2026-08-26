import { motion } from 'framer-motion';

/** Polished architecture-invariant indicator — "0 tokens / 0 LLM calls". */
export default function InvariantBadge({ items }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((inv, i) => (
        <motion.div
          key={inv.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 * i, duration: 0.3 }}
          className="relative overflow-hidden rounded-xl2 border border-line bg-ink-800 px-5 py-4"
        >
          <div className="absolute inset-y-0 left-0 w-[2px] bg-gradient-to-b from-ok/70 to-ok/10" aria-hidden="true" />
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-low">{inv.label}</div>
          <div className="mono-num mt-1 text-[24px] font-bold leading-none text-ok">{inv.value}</div>
          <p className="mt-2 max-w-[300px] text-[11.5px] leading-relaxed text-low">{inv.note}</p>
        </motion.div>
      ))}
    </div>
  );
}

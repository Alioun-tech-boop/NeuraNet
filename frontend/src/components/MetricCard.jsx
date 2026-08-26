import { motion } from 'framer-motion';

export default function MetricCard({ label, value, sub, accent = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="panel px-5 py-4"
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.13em] text-low">{label}</div>
      <div className={`mono-num mt-1.5 text-[28px] font-bold leading-none ${accent ? 'text-sem' : 'text-hi'}`}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-[12px] text-low">{sub}</div>}
    </motion.div>
  );
}

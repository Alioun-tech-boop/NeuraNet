import { motion } from 'framer-motion';
import { Check, X, ShieldCheck } from 'lucide-react';

export default function CompatibilityPanel({ data, visible = true }) {
  if (!visible) return null;
  const passed = data?.passed ?? [
    { label: 'Jurisdiction', value: 'Ghana' },
    { label: 'Domain', value: 'Banking' },
    { label: 'Task class', value: 'Regulatory research' },
    { label: 'Polarity', value: 'compatible' },
  ];
  const rejected = data?.rejected ?? [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="panel p-5"
      aria-label="Hard compatibility filter"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck size={13} className="text-sem" strokeWidth={2} />
        <div className="panel-title">Hard Compatibility</div>
      </div>

      <ul className="mt-3 space-y-1.5">
        {passed.map((p) => (
          <li key={p.label} className="flex items-center gap-2 text-[12.5px]">
            <Check size={13} strokeWidth={2.4} className="shrink-0 text-ok" />
            <span className="text-mid">{p.label}:</span>
            <span className="font-medium text-hi">{p.value}</span>
          </li>
        ))}
      </ul>

      {rejected.length > 0 && (
        <>
          <div className="my-3 border-t border-line" />
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.15em] text-low">Rejected — similarity alone does not transfer</div>
          <ul className="space-y-1.5">
            {rejected.slice(0, 4).map((r) => (
              <li key={r.label} className="flex items-start gap-2 text-[12.5px]">
                <X size={13} strokeWidth={2.4} className="mt-0.5 shrink-0 text-err" />
                <span className="mono-num break-all text-mid">{r.label}</span>
                <span className="ml-auto shrink-0 text-[11px] text-low">{r.reason}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </motion.section>
  );
}

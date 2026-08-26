import { Check, Circle, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';

function CountUp({ value, decimals = 2, suffix = '' }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="mono-num"
    >
      {Number(value).toFixed(decimals)}
      {suffix}
    </motion.span>
  );
}

export default function PipelineStep({ label, index, last, state, detail }) {
  /* state: 'pending' | 'active' | 'done' */
  const active = state === 'active';
  const done = state === 'done';

  const renderLine = (line, li) => {
    if (typeof line === 'object' && line.key === 'similarity') {
      return (
        <div key={li} className="mono-num text-[13px] font-semibold text-sem">
          semantic similarity <CountUp value={line.value} /> 
        </div>
      );
    }
    if (typeof line === 'object' && line.key === 'quality') {
      return (
        <div key={li} className="mono-num text-[13px] font-semibold text-ok">
          Quality <CountUp value={line.value} />
        </div>
      );
    }
    if (typeof line === 'object' && line.tag) {
      return (
        <span key={li} className={`mono-num inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
          line.tag === 'NEW PATH' ? 'border-sem/40 bg-sem/10 text-sem' : 'border-ok/40 bg-ok/10 text-ok'
        }`}>
          {line.tag}
        </span>
      );
    }
    return (
      <div key={li} className="text-[12.5px] text-mid">
        {line}
      </div>
    );
  };

  return (
    <li className="relative flex gap-4 pb-1" aria-current={active ? 'step' : undefined}>
      {/* rail */}
      <div className="flex flex-col items-center">
        <motion.div
          animate={{
            borderColor: done ? '#3ECF8E' : active ? '#7C8CF8' : '#212733',
            backgroundColor: done ? 'rgba(62,207,142,0.12)' : 'transparent',
          }}
          transition={{ duration: 0.25 }}
          className="flex h-7 w-7 items-center justify-center rounded-full border"
        >
          {done ? (
            <Check size={13} strokeWidth={2.5} className="text-ok" />
          ) : active ? (
            <motion.span
              animate={{ scale: [1, 0.75, 1], opacity: [1, 0.55, 1] }}
              transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
            >
              <Circle size={9} fill="#7C8CF8" stroke="none" />
            </motion.span>
          ) : (
            <Circle size={7} stroke="#3a4250" />
          )}
        </motion.div>
        {!last && (
          <motion.div
            animate={{ backgroundColor: done ? '#3ECF8E66' : '#212733' }}
            transition={{ duration: 0.25 }}
            className="my-1 w-px flex-1"
            style={{ minHeight: 22 }}
          />
        )}
      </div>

      {/* body */}
      <div className="pb-4">
        <div className={`text-[12px] font-semibold uppercase tracking-[0.13em] ${done || active ? 'text-hi' : 'text-low'}`}>
          {label}
        </div>
        {(active || done) && detail && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="mt-1.5 flex flex-col gap-0.5"
          >
            {detail.lines?.map(renderLine)}
          </motion.div>
        )}
      </div>
    </li>
  );
}

export function StageArrow() {
  return <ArrowDown size={12} className="text-low" aria-hidden="true" />;
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import { EXPERIENCE_GRAPH } from '../data/neuranetDemo.js';

/* Hand-laid SVG graph — no heavy dependency. Coordinates in a 920×520 viewBox. */
const POS = {
  workflow: { x: 460, y: 70 },
  strategy: { x: 460, y: 210 },
  tasks: [
    { id: 'ta', x: 220, y: 350 },
    { id: 'tb', x: 460, y: 350 },
    { id: 'tc', x: 700, y: 350 },
  ],
  transfer: { x: 460, y: 460 },
};

function Node({ x, y, label, sub, kind, onClick, selected, dim }) {
  const palette = {
    workflow: { stroke: '#7C8CF8', bg: 'rgba(124,140,248,0.10)', text: '#EDF0F4' },
    strategy: { stroke: '#3ECF8E', bg: 'rgba(62,207,142,0.08)', text: '#EDF0F4' },
    task: { stroke: '#39414f', bg: '#131720', text: '#C6CBD3' },
    transfer: { stroke: '#7C8CF8', bg: 'rgba(124,140,248,0.07)', text: '#B7BEE0' },
  }[kind];
  const w = kind === 'task' ? 150 : 190;
  const h = kind === 'task' ? 52 : 58;
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: dim ? 0.45 : 1, scale: 1 }}
      transition={{ duration: 0.35 }}
      style={{ transformOrigin: `${x}px ${y}px`, cursor: 'pointer' }}
      onClick={() => onClick?.()}
      role="button"
      tabIndex={0}
      aria-label={`${label}${sub ? ': ' + sub : ''}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <rect
        x={x - w / 2} y={y - h / 2} width={w} height={h} rx={13}
        fill={selected ? 'rgba(124,140,248,0.14)' : palette.bg}
        stroke={selected ? '#7C8CF8' : palette.stroke}
        strokeWidth={selected ? 1.8 : 1}
        filter={selected ? undefined : undefined}
      />
      <text x={x} y={y - (sub ? 2 : -5)} textAnchor="middle" fill={palette.text} fontSize={12.5} fontWeight={600}>
        {label}
      </text>
      {sub && (
        <text x={x} y={y + 13} textAnchor="middle" fill="#8B93A1" fontSize={10.5}>
          {sub.length > 30 ? sub.slice(0, 29) + '…' : sub}
        </text>
      )}
    </motion.g>
  );
}

function Edge({ from, to, dashed = false, animated = false, delay = 0 }) {
  const mx = (from.x + to.x) / 2;
  const d = `M${from.x},${from.y + 28} C${from.x},${from.y + 60} ${to.x},${to.y - 60} ${to.x},${to.y - 28}`;
  return (
    <>
      <motion.path
        d={d}
        fill="none"
        stroke="#2b3345"
        strokeWidth={1.2}
        strokeDasharray={dashed ? '4 5' : undefined}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      />
      {animated && (
        <motion.circle
          r={2.6}
          fill="#7C8CF8"
          initial={{ offsetDistance: '0%' }}
          animate={{ offsetDistance: ['0%', '100%'] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear', delay }}
          style={{ offsetPath: `path('${d}')` }}
        />
      )}
    </>
  );
}

export default function ExperienceGraph() {
  const [selected, setSelected] = useState('strategy');
  const g = EXPERIENCE_GRAPH;

  const meta = () => {
    if (selected === 'workflow') return { title: g.workflow.label, rows: [['Kind', 'Workflow'], ['Families', '18'], ['Active strategies', '147']] };
    if (selected === 'transfer') return {
      title: g.transferNode.label,
      rows: [['Mechanism', 'E5 retrieval + hard filters'], ['LLM calls for matching', '0'], ['Context injected', '0 tokens'], ['Transfers this month', '23']],
    };
    return {
      title: 'Strategy',
      rows: [
        ['Path', g.strategy.path],
        ['Created', g.strategy.created],
        ['Executions', String(g.strategy.executions)],
        ['Average quality', g.strategy.quality.toFixed(2)],
        ['Reuse count', String(g.strategy.reuse)],
      ],
    };
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_290px]">
      <div className="panel overflow-hidden p-2">
        <svg viewBox="0 0 920 520" className="h-auto w-full" role="img" aria-label="Experience graph">
          {/* edges */}
          <Edge from={POS.workflow} to={POS.strategy} animated />
          {POS.tasks.map((t, i) => (
            <Edge key={t.id} from={POS.strategy} to={t} dashed delay={0.25 + i * 0.15} />
          ))}
          {POS.tasks.map((t, i) => (
            <Edge key={'x' + t.id} from={t} to={POS.transfer} dashed animated delay={0.6 + i * 0.2} />
          ))}

          <Node {...POS.workflow} label={g.workflow.label} kind="workflow"
            selected={selected === 'workflow'} onClick={() => setSelected('workflow')} />
          <Node {...POS.strategy} label="Strategy v1" sub={g.strategy.path} kind="strategy"
            selected={selected === 'strategy'} onClick={() => setSelected('strategy')} />
          {POS.tasks.map((t, i) => (
            <Node key={t.id} {...t} label={g.tasks[i].label} sub={g.tasks[i].sub} kind="task"
              selected={selected === t.id} onClick={() => setSelected(t.id)} />
          ))}
          <Node {...POS.transfer} label={g.transferNode.label} kind="transfer"
            selected={selected === 'transfer'} onClick={() => setSelected('transfer')} />

          <text x={80} y={502} fill="#5B6472" fontSize={11}>Semantic reuse — same underlying problem class, different wording</text>
        </svg>
      </div>

      {/* metadata panel */}
      <div className="panel h-fit p-5">
        <div className="panel-title">Node metadata</div>
        <div className="mt-3 text-[15px] font-semibold text-hi">{meta().title}</div>
        <dl className="mt-4 space-y-2.5">
          {meta().rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 last:border-0">
              <dt className="text-[12px] text-low">{k}</dt>
              <dd className={`max-w-[170px] truncate text-right text-[12.5px] font-medium text-hi ${/^\d/.test(v) ? 'mono-num' : ''}`}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

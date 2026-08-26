import { motion } from 'framer-motion';
import { Database, SearchCode, ArrowDown } from 'lucide-react';
import { RETRIEVAL } from '../data/neuranetDemo.js';

function SimBar({ sim, dominant, label }) {
  return (
    <div className={`flex items-center gap-3 ${dominant ? '' : 'opacity-45'}`}>
      <div className="w-44 shrink-0 truncate text-[12.5px]">
        {dominant && <span className="mono-num mr-2 rounded border border-ok/40 bg-ok/10 px-1.5 py-0.5 text-[10px] font-bold text-ok">TOP</span>}
        <span className={dominant ? 'font-medium text-hi' : 'text-mid'}>{label}</span>
      </div>
      <div className="h-[6px] flex-1 overflow-hidden rounded-full bg-ink-700">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${sim * 100}%` }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className={`h-full rounded-full ${dominant ? 'bg-gradient-to-r from-semdeep to-sem' : 'bg-low/50'}`}
        />
      </div>
      <div className={`mono-num w-12 text-right text-[12.5px] ${dominant ? 'font-bold text-sem' : 'text-low'}`}>
        {sim.toFixed(2)}
      </div>
    </div>
  );
}

export default function RetrievalPanel({ active = true }) {
  return (
    <section className="panel p-5" aria-label="Semantic retrieval">
      <div className="panel-title">Semantic Retrieval</div>

      <div className="mt-4 space-y-1.5">
        <FlowRow icon={Database} title="E5 EMBEDDING" sub={`${RETRIEVAL.embedding.dims} dimensions · ${RETRIEVAL.embedding.model}`} done={active} />
        <Connector />
        <FlowRow icon={SearchCode} title="VECTOR SEARCH" sub={RETRIEVAL.store + ' · cosine'} done={active} />
        <Connector />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-lg border border-sem/30 bg-sem/[0.06] px-4 py-3"
      >
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sem">Top match</div>
        <div className="mono-num mt-1 text-[14px] font-semibold text-hi">{RETRIEVAL.topMatch.path}</div>
      </motion.div>

      <div className="mt-4 space-y-2.5">
        <SimBar sim={RETRIEVAL.topMatch.similarity} dominant label={RETRIEVAL.topMatch.path} />
        {RETRIEVAL.alternatives.map((a) => (
          <SimBar key={a.path} sim={a.similarity} label={a.path} />
        ))}
      </div>
    </section>
  );
}

function FlowRow({ icon: Icon, title, sub, done }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-md border ${done ? 'border-sem/35 bg-sem/[0.08]' : 'border-line bg-ink-800'}`}>
        <Icon size={14} className={done ? 'text-sem' : 'text-low'} strokeWidth={1.9} />
      </div>
      <div>
        <div className="text-[11px] font-semibold tracking-wide text-hi">{title}</div>
        <div className="text-[11.5px] text-low">{sub}</div>
      </div>
    </div>
  );
}

function Connector() {
  return (
    <div className="ml-4 h-3 border-l border-dashed border-low/40" aria-hidden="true" />
  );
}

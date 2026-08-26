import { motion } from 'framer-motion';
import { ArrowRight, Network, Play } from 'lucide-react';
import MetricCard from '../components/MetricCard.jsx';
import { METRICS } from '../data/neuranetDemo.js';

export default function Overview({ onNavigate }) {
  return (
    <div className="mx-auto max-w-[1500px] px-8 pb-16 pt-10">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-[34px] font-extrabold leading-[1.15] tracking-tight md:text-[40px]">
          Procedural Experience Infrastructure
          <span className="block text-mid">for AI Agents</span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-mid">
          Agents don't just remember.
          <span className="text-hi"> They learn how to solve.</span> NeuraNet observes successful executions,
          stores the strategy behind them, and transfers it — semantically — to every future task in the same problem class.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate('live')}
            className="flex items-center gap-2 rounded-lg bg-semdeep px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#6b82f3]"
          >
            <Play size={14} /> Run live demonstration
          </button>
          <button
            onClick={() => onNavigate('graph')}
            className="flex items-center gap-2 rounded-lg border border-line bg-ink-850 px-5 py-2.5 text-[13.5px] font-medium text-hi transition-colors hover:bg-ink-800"
          >
            View experience graph <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>

      {/* Metrics */}
      <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Strategies" value={METRICS.strategies} sub="procedural paths stored" />
        <MetricCard label="Successful paths" value={METRICS.successfulPaths} sub="survived Pareto evaluation" />
        <MetricCard label="Semantic reuse" value={`${METRICS.semanticReuse}%`} accent sub="of recurring task classes" />
        <MetricCard label="LLM matching calls" value={METRICS.llmMatchingCalls} sub="retrieval is infrastructure-layer" />
      </div>

      {/* Mechanism strip */}
      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {[
          { n: '01', t: 'Learn', d: 'A successful execution is distilled into a versioned strategy path — steps, sources, verification.' },
          { n: '02', t: 'Retrieve', d: 'New tasks are embedded (E5) and matched against strategies with pgvector. Zero LLM calls. Hard compatibility gates the match.' },
          { n: '03', t: 'Transfer', d: 'The strategy guides execution for a differently-worded instance of the same problem class. Quality rises. The population evolves by Pareto elimination.' },
        ].map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.32 }}
            className="panel p-6"
          >
            <div className="mono-num text-[11px] font-semibold text-sem">{s.n}</div>
            <div className="mt-2 text-[15px] font-semibold text-hi">{s.t}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-low">{s.d}</p>
          </motion.div>
        ))}
      </div>

      {/* quiet invariants line */}
      <div className="mono-num mt-10 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-5 text-[11.5px] text-low">
        <span>0 historical tokens injected</span>
        <span>0 LLM calls for matching</span>
        <span>provider-neutral</span>
        <span>no answer caching</span>
        <button onClick={() => onNavigate('benchmarks')} className="text-sem hover:underline">see the proof →</button>
      </div>
    </div>
  );
}

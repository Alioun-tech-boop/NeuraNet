import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, GitBranch } from 'lucide-react';
import ParetoChart from '../components/ParetoChart.jsx';
import StrategyTimeline from '../components/StrategyTimeline.jsx';
import { STRATEGIES } from '../data/neuranetDemo.js';

function List({ onOpen }) {
  return (
    <div className="grid gap-3">
      {STRATEGIES.map((s, i) => (
        <motion.button
          key={s.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.28 }}
          onClick={() => onOpen(s)}
          className="panel group flex items-center justify-between px-5 py-4 text-left transition-colors hover:border-sem/40"
        >
          <div className="flex items-center gap-4">
            <GitBranch size={16} className={s.status === 'ACTIVE' ? 'text-ok' : 'text-low'} />
            <div>
              <div className="mono-num text-[13.5px] font-semibold text-hi">{s.path}</div>
              <div className="mt-0.5 flex items-center gap-4 text-[11.5px] text-low">
                <span>executions {s.executions}</span>
                <span>reuse {s.reuse}</span>
                <span>created {s.created}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <span className={`mono-num rounded-md border px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider ${
              s.status === 'ACTIVE' ? 'border-ok/40 bg-ok/10 text-ok' : 'border-line bg-ink-800 text-low'
            }`}>
              {s.status}
            </span>
            <span className="mono-num text-[17px] font-bold text-hi">{s.quality.toFixed(2)}</span>
            <ArrowRight size={14} className="text-low transition-transform group-hover:translate-x-0.5 group-hover:text-sem" />
          </div>
        </motion.button>
      ))}
    </div>
  );
}

export default function Strategies() {
  const [openId, setOpenId] = useState(null);
  const strat = STRATEGIES.find((s) => s.id === openId);

  if (strat) {
    return (
      <div className="mx-auto max-w-[1500px] px-8 pb-16 pt-8">
        <button onClick={() => setOpenId(null)} className="flex items-center gap-1.5 text-[12.5px] text-mid hover:text-hi">
          <ChevronLeft size={14} /> All strategies
        </button>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <h1 className="mono-num text-[22px] font-bold tracking-tight">{strat.path}</h1>
          <span className={`rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
            strat.status === 'ACTIVE' ? 'border-ok/40 bg-ok/10 text-ok' : 'border-line bg-ink-800 text-low'
          }`}>{strat.status}</span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[['Quality', strat.quality.toFixed(2)], ['Executions', strat.executions], ['Reuse', strat.reuse], ['Success rate', `${(strat.successRate * 100).toFixed(1)}%`]].map(([l, v]) => (
            <div key={l} className="panel px-5 py-4">
              <div className="text-[10.5px] font-medium uppercase tracking-[0.13em] text-low">{l}</div>
              <div className="mono-num mt-1 text-[24px] font-bold leading-none">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="panel p-6">
            <div className="panel-title">Procedural path</div>
            <ol className="mt-4 space-y-0">
              {strat.steps.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 pb-1">
                  <span className="mono-num w-4 text-right text-[10.5px] text-low">{i + 1}</span>
                  <span className="text-[13.5px] text-hi">{s.label}</span>
                  {i < strat.steps.length - 1 && <ArrowDown />}
                </li>
              ))}
            </ol>
            <p className="mt-4 border-t border-line pt-3 text-[12px] text-low">
              Executed by the caller's model. NeuraNet supplies the procedure — never the answer.
            </p>
          </section>

          <section className="panel p-6">
            <div className="panel-title">History</div>
            <div className="mt-4"><StrategyTimeline history={strat.history} /></div>
          </section>
        </div>

        {/* helper for the arrow */}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] px-8 pb-16 pt-8">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-low">Strategies</div>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight">Strategy population</h1>
      </div>
      <List onOpen={(s) => setOpenId(s.id)} />

      <div className="panel mt-10 p-6">
        <div className="flex items-baseline justify-between">
          <div className="panel-title">Strategy Evolution — Pareto frontier</div>
          <span className="text-[11.5px] text-low">Only non-dominated strategies remain active.</span>
        </div>
        <ParetoChart />
      </div>
    </div>
  );
}

function ArrowDown() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#39414f" strokeWidth="2" aria-hidden="true" style={{ marginInline: 6 }}><path d="M12 5v14M19 12l-7 7-7-7" /></svg>;
}

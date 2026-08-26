import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { Play, RotateCcw, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import MetricCard from '../components/MetricCard.jsx';
import { runLive } from '../data/neuranetDemo.js';

const SAMPLE = [
  'Identify the banking regulator of Ghana and verify it using official sources.',
  'Determine which institution supervises banking establishments operating in Ghana.',
  'Which central bank oversees commercial lenders in Ghana?',
  'Find the enforcement powers of the Ghanaian central bank over commercial banks.',
];
const MAX_Q = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const classify = (delta) =>
  delta >= 0.03 ? 'improvement' : delta <= -0.03 ? 'deficiency' : 'neutral';

function explain(r) {
  const d = r.delta;
  if (r.error) return `execution failed (${r.error}) — excluded from averages`;
  if (r.variant === 'transfer') {
    if (d >= 0.03) return `semantic transfer at ${r.sim.toFixed(2)} guided execution: +${d.toFixed(2)} over baseline`;
    if (d <= -0.03) return `strategy matched (${r.sim.toFixed(2)}) but hurt this phrasing (−${Math.abs(d).toFixed(2)}) — stored procedure may not fit`;
    return `transferred at ${r.sim.toFixed(2)}; answer parity with baseline (${d >= 0 ? '+' : ''}${d.toFixed(2)})`;
  }
  if (d >= 0.03) return `fresh strategy + targeted sources beat baseline (+${d.toFixed(2)})`;
  if (d <= -0.03) return `no stored strategy for this class; retrieved web context added noise (−${Math.abs(d).toFixed(2)})`;
  return `no prior strategy; baseline parity (${d >= 0 ? '+' : ''}${d.toFixed(2)}) — experience now stored for next time`;
}

export default function BatchAnalysis() {
  const [raw, setRaw] = useState(SAMPLE.join('\n'));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState([]);

  const questions = useMemo(
    () => raw.split('\n').map((s) => s.trim()).filter((s) => s.length > 7),
    [raw]
  );

  async function runBatch() {
    if (running || questions.length === 0) return;
    setRunning(true);
    setResults([]);
    setProgress({ done: 0, total: questions.length });
    const acc = [];
    for (let i = 0; i < Math.min(questions.length, MAX_Q); i++) {
      try {
        const j = await runLive(questions[i]);
        acc.push({
          task: questions[i],
          variant: j.variant ?? '?',
          sim: j.retrieval?.similarity ?? 0,
          quality: j.result?.quality ?? null,
          baselineQuality: j.result?.baselineQuality ?? null,
          delta:
            typeof j.result?.delta === 'number'
              ? j.result.delta
              : j.result?.quality != null && j.result?.baselineQuality != null
                ? +(j.result.quality - j.result.baselineQuality).toFixed(2)
                : null,
          path: j.strategy?.path,
          error: j.live === false ? 'backend offline' : null,
        });
      } catch (e) {
        acc.push({ task: questions[i], error: e.message, delta: null, variant: '?', sim: 0, quality: null, baselineQuality: null });
      }
      setResults([...acc]);
      setProgress({ done: i + 1, total: questions.length });
      await sleep(400); // lisse la charge API
    }
    setRunning(false);
  }

  const valid = results.filter((r) => !r.error && r.delta != null);
  const stats = useMemo(() => {
    if (!valid.length) return null;
    const avg = (f) => valid.reduce((a, r) => a + f(r), 0) / valid.length;
    const improvements = valid.filter((r) => classify(r.delta) === 'improvement');
    const deficiencies = valid.filter((r) => classify(r.delta) === 'deficiency');
    const neutral = valid.filter((r) => classify(r.delta) === 'neutral');
    const best = [...valid].sort((a, b) => b.delta - a.delta)[0];
    const worst = [...valid].sort((a, b) => a.delta - b.delta)[0];
    return {
      n: valid.length,
      avgQ: avg((r) => r.quality),
      avgB: avg((r) => r.baselineQuality),
      avgDelta: avg((r) => r.delta),
      improvements, deficiencies, neutral, best, worst,
    };
  }, [results]);

  const chartData = results.map((r, i) => ({
    name: `Q${i + 1}`,
    guided: r.quality ?? 0,
    baseline: r.baselineQuality ?? 0,
    delta: r.delta ?? 0,
  }));

  return (
    <div className="mx-auto max-w-[1500px] px-8 pb-16 pt-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-low">Batch Analysis</div>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight">Compare NeuraNet against its own baseline</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-mid">
            Run up to {MAX_Q} questions sequentially. Every question executes the full real pipeline and is scored
            against the same model answering without strategy or sources.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRaw(SAMPLE.join('\n'))}
            disabled={running}
            className="rounded-lg border border-line bg-ink-850 px-4 py-2 text-[12.5px] text-mid hover:text-hi disabled:opacity-40"
          >
            <RotateCcw size={12} className="mr-1.5 inline" /> Sample set
          </button>
          <button
            onClick={runBatch}
            disabled={running || questions.length === 0}
            className="flex items-center gap-2 rounded-lg bg-semdeep px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#6b82f3] disabled:cursor-wait disabled:opacity-50"
          >
            <Play size={13} /> {running ? `Running ${progress.done}/${progress.total}…` : `Run batch (${Math.min(questions.length, MAX_Q)})`}
          </button>
        </div>
      </div>

      {/* Question input */}
      <div className="panel p-5">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="batch-input" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-low">
            Questions — one per line
          </label>
          <span className={`mono-num text-[12px] ${questions.length > MAX_Q ? 'text-warn' : 'text-low'}`}>
            {questions.length} / {MAX_Q} accepted
          </span>
        </div>
        <textarea
          id="batch-input"
          rows={Math.min(Math.max(questions.length, 4), 10)}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          disabled={running}
          className="w-full resize-y rounded-lg border border-line bg-ink-900 px-4 py-3 text-[13.5px] leading-relaxed text-hi focus:border-sem/50 focus:outline-none disabled:opacity-60"
          placeholder={'One question per line…'}
        />
        {questions.length > MAX_Q && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-warn">
            <AlertTriangle size={12} /> Only the first {MAX_Q} will run (API quota protection).
          </p>
        )}
        {running && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700">
            <motion.div
              animate={{ width: `${(progress.done / progress.total) * 100}%` }}
              transition={{ duration: 0.3 }}
              className="h-full rounded-full bg-gradient-to-r from-semdeep to-sem"
            />
          </div>
        )}
      </div>

      {/* Global scores */}
      {stats && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Questions scored" value={`${stats.n}/${progress.total}`} sub={`${results.filter((r) => r.error).length} failed`} />
            <MetricCard label="Avg quality · guided" value={stats.avgQ.toFixed(2)} accent sub={`baseline alone: ${stats.avgB.toFixed(2)}`} />
            <MetricCard label="Average Δ vs baseline" value={`${stats.avgDelta >= 0 ? '+' : ''}${stats.avgDelta.toFixed(3)}`}
              sub={classify(stats.avgDelta) === 'improvement' ? 'global improvement' : classify(stats.avgDelta) === 'deficiency' ? 'global regression' : 'parity overall'} />
            <MetricCard label="Improvements / Deficiencies"
              value={<span><span className="text-ok">{stats.improvements.length} ↑</span> <span className="text-low">·</span> <span className={stats.deficiencies.length ? 'text-err' : ''}>{stats.deficiencies.length} ↓</span></span>}
              sub={`${stats.neutral.length} neutral`} />
          </div>
        </motion.div>
      )}

      {/* Comparison chart */}
      {chartData.length > 0 && (
        <div className="panel mt-6 p-6">
          <div className="panel-title mb-3">Per-question comparison — guided vs baseline</div>
          <div className="h-[300px]" role="img" aria-label="Guided versus baseline quality per question">
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
                <CartesianGrid stroke="#1a1f2b" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#9AA3B0', fontSize: 12 }} axisLine={{ stroke: '#212733' }} tickLine={false} />
                <YAxis domain={[0, 1]} tick={{ fill: '#5B6472', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: '#ffffff06' }}
                  contentStyle={{ background: '#131720', border: '1px solid #212733', borderRadius: 10, fontSize: 12 }}
                  formatter={(v, k) => [Number(v).toFixed(2), k === 'guided' ? 'With NeuraNet' : 'Baseline']}
                />
                <ReferenceLine y={stats?.avgDelta == null ? 0 : undefined} stroke="transparent" />
                <Bar dataKey="baseline" fill="#39414f" radius={[5, 5, 0, 0]} maxBarSize={34} />
                <Bar dataKey="guided" radius={[5, 5, 0, 0]} maxBarSize={34}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={classify(d.delta) === 'improvement' ? '#3ECF8E' : classify(d.delta) === 'deficiency' ? '#F0655A' : '#5570F1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-1 flex flex-wrap gap-4 px-1 text-[11.5px]">
              <span className="flex items-center gap-1.5 text-ok"><span className="h-2 w-2 rounded-sm bg-ok" /> Improvement (Δ ≥ +0.03)</span>
              <span className="flex items-center gap-1.5 text-sem"><span className="h-2 w-2 rounded-sm bg-semdeep" /> Neutral</span>
              <span className="flex items-center gap-1.5 text-err"><span className="h-2 w-2 rounded-sm bg-err" /> Deficiency (Δ ≤ −0.03)</span>
              <span className="flex items-center gap-1.5 text-low"><span className="h-2 w-2 rounded-sm bg-[#39414f]" /> Baseline</span>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {results.length > 0 && (
        <div className="panel mt-6 overflow-x-auto p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-[0.12em] text-low">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-3 py-3 font-medium">Question</th>
                <th className="px-3 py-3 font-medium">Mode</th>
                <th className="px-3 py-3 font-medium">Sim</th>
                <th className="px-3 py-3 text-right font-medium">Guided</th>
                <th className="px-3 py-3 text-right font-medium">Baseline</th>
                <th className="px-3 py-3 text-right font-medium">Δ</th>
                <th className="px-5 py-3 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => {
                const cls = r.error ? 'neutral' : classify(r.delta ?? 0);
                return (
                  <tr key={i} className="border-b border-line last:border-0 align-top">
                    <td className="mono-num px-5 py-3.5 text-low">Q{i + 1}</td>
                    <td className="max-w-[340px] px-3 py-3.5">
                      <span className="line-clamp-2 text-hi">{r.task}</span>
                      {!r.error && r.path && <span className="mono-num block break-all text-[10.5px] text-low">{r.path}</span>}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={`mono-num rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        r.variant === 'transfer' ? 'border-ok/40 bg-ok/10 text-ok' : 'border-sem/30 bg-sem/10 text-sem'
                      }`}>
                        {r.variant === 'transfer' ? 'TRANSFER' : r.variant === '?' ? '—' : 'NEW PATH'}
                      </span>
                    </td>
                    <td className="mono-num px-3 py-3.5 text-mid">{r.variant === 'transfer' ? r.sim.toFixed(2) : '—'}</td>
                    <td className="mono-num px-3 py-3.5 text-right font-semibold text-hi">{r.quality?.toFixed(2) ?? '—'}</td>
                    <td className="mono-num px-3 py-3.5 text-right text-mid">{r.baselineQuality?.toFixed(2) ?? '—'}</td>
                    <td className={`mono-num px-3 py-3.5 text-right font-bold ${
                      cls === 'improvement' ? 'text-ok' : cls === 'deficiency' ? 'text-err' : 'text-mid'
                    }`}>
                      {r.delta != null ? `${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        r.error ? 'bg-ink-800 text-low'
                          : cls === 'improvement' ? 'bg-ok/10 text-ok'
                          : cls === 'deficiency' ? 'bg-err/10 text-err' : 'bg-sem/10 text-sem'
                      }`}>
                        {cls === 'improvement' ? <TrendingUp size={11} /> : cls === 'deficiency' ? <TrendingDown size={11} /> : <Minus size={11} />}
                        {r.error ? 'failed' : cls}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Auto analysis */}
      {stats && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="panel p-6">
            <div className="panel-title flex items-center gap-2"><TrendingUp size={13} className="text-ok" /> Improvements</div>
            <ul className="mt-3 space-y-2">
              {[...stats.improvements.map((r) => ({ r, why: explain(r) })),
                ...(stats.neutral.length ? [{ r: stats.neutral[0], why: `${explain(stats.neutral[0])}${stats.neutral.length > 1 ? ` (+${stats.neutral.length - 1} other neutral runs)` : ''}` }] : [])]
                .map(({ r, why }, i) => (
                  <li key={i} className="flex items-start gap-2.5 border-l-2 border-ok/50 pl-3 text-[13px]">
                    <span className="mono-num shrink-0 text-low">Q{results.indexOf(r) + 1}</span>
                    <span className="text-mid">{why}</span>
                  </li>
                ))}
              {!stats.improvements.length && !stats.neutral.length && <li className="text-[13px] text-low">None observed.</li>}
            </ul>
          </section>

          <section className="panel p-6">
            <div className="panel-title flex items-center gap-2"><TrendingDown size={13} className="text-err" /> Deficiencies</div>
            <ul className="mt-3 space-y-2">
              {stats.deficiencies.map((r) => (
                <li key={results.indexOf(r)} className="flex items-start gap-2.5 border-l-2 border-err/50 pl-3 text-[13px]">
                  <span className="mono-num shrink-0 text-low">Q{results.indexOf(r) + 1}</span>
                  <span className="text-mid">{explain(r)}</span>
                </li>
              ))}
              {!stats.deficiencies.length && (
                <li className="flex items-center gap-2 text-[13px] text-ok"><TrendingUp size={13} /> No deficiency detected in this batch.</li>
              )}
            </ul>
            {stats.best && stats.worst && stats.best !== stats.worst && stats.deficiencies.length > 0 && (
              <p className="mt-4 border-t border-line pt-3 text-[11.5px] leading-relaxed text-low">
                Best: Q{results.indexOf(stats.best) + 1} ({stats.best.delta >= 0 ? '+' : ''}{stats.best.delta.toFixed(2)}) ·
                Worst: Q{results.indexOf(stats.worst) + 1} ({stats.worst.delta.toFixed(2)}).
                Deficiencies on rephrased-but-unstored classes are expected until a first run stores their strategy — rerun them once to compare.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

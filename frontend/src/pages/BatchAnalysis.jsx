import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Play, RotateCcw, TrendingUp, TrendingDown, Minus, AlertTriangle, Sparkles, Layers,
  Plus, CheckCircle2, History as HistoryIcon, ChevronLeft,
} from 'lucide-react';
import { runLive } from '../data/neuranetDemo.js';

/* ── persistent batch history (localStorage) ── */
const HKEY = 'nn_batch_history';
const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch { return []; }
};
const persistHistory = (h) => localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 20)));

const SAMPLE = [
  'Identify the banking regulator of Ghana and verify it using official sources.',
  'Determine which institution supervises banking establishments operating in Ghana.',
  'Which central bank oversees commercial lenders in Ghana?',
];
const MAX_Q = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const classify = (delta) => (delta >= 0.03 ? 'improvement' : delta <= -0.03 ? 'deficiency' : 'neutral');

function explain(r) {
  const d = r.delta;
  if (r.error) return `execution failed (${r.error}) — excluded from averages`;
  if (r.variant === 'transfer') {
    if (d >= 0.03) return `semantic transfer at ${r.sim.toFixed(2)} guided execution: +${d.toFixed(2)} over baseline`;
    if (d <= -0.03) return `strategy matched (${r.sim.toFixed(2)}) but hurt this phrasing (-${Math.abs(d).toFixed(2)}) — stored procedure may not fit`;
    return `transferred at ${r.sim.toFixed(2)}; answer parity with baseline (${d >= 0 ? '+' : ''}${d.toFixed(2)})`;
  }
  if (d >= 0.03) return `fresh strategy + targeted sources beat baseline (+${d.toFixed(2)})`;
  if (d <= -0.03) return `no stored strategy for this class; retrieved web context added noise (-${Math.abs(d).toFixed(2)})`;
  return `no prior strategy; baseline parity (${d >= 0 ? '+' : ''}${d.toFixed(2)}) — experience now stored for next time`;
}

/* ── micro-components ─────────────────────────────────────────────── */

function CountUp({ target, decimals = 2, signed = false }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    let raf; const t0 = performance.now(); const dur = 650;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  const n = Number.isFinite(target) ? v : 0;
  return <span className="mono-num">{signed && n > 0 ? '+' : ''}{n.toFixed(decimals)}</span>;
}

function Glass({ children, className = '', glow = null }) {
  /* 1px gradient hairline + deep glass surface */
  const ring =
    glow === 'ok' ? 'from-ok/50 via-ok/[0.08] to-transparent'
      : glow === 'err' ? 'from-err/40 via-err/[0.06] to-transparent'
        : 'from-white/[0.14] via-white/[0.04] to-transparent';
  return (
    <div className={`rounded-[16px] bg-gradient-to-br p-[1px] ${ring}`}>
      <div className={`h-full rounded-[15px] bg-ink-850/90 backdrop-blur-sm ${className}`}>{children}</div>
    </div>
  );
}

function Stat({ label, value, sub, tone = 'neutral', count = false }) {
  const toneCls = tone === 'ok' ? 'text-ok' : tone === 'err' ? 'text-err' : 'text-hi';
  return (
    <Glass glow={tone === 'ok' ? 'ok' : tone === 'err' ? 'err' : null}>
      <div className="px-5 py-4">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-low">{label}</div>
        <div className={`mt-1.5 text-[30px] font-bold leading-none tracking-tight ${toneCls}`}>
          {count ? value : <span>{value}</span>}
        </div>
        {sub && <div className="mt-2 text-[11.5px] leading-snug text-low">{sub}</div>}
      </div>
    </Glass>
  );
}

const Pill = ({ kind }) => {
  const map = {
    improvement: { c: 'bg-ok/[0.12] text-ok border-ok/30', I: TrendingUp, t: 'improvement' },
    deficiency: { c: 'bg-err/[0.12] text-err border-err/30', I: TrendingDown, t: 'deficiency' },
    neutral: { c: 'bg-sem/[0.12] text-sem border-sem/30', I: Minus, t: 'neutral' },
    failed: { c: 'bg-white/[0.05] text-low border-line', I: Minus, t: 'failed' },
  }[kind];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${map.c}`}>
      <map.I size={11} strokeWidth={2.4} /> {map.t}
    </span>
  );
};

/* ── page ─────────────────────────────────────────────────────────── */

export default function BatchAnalysis() {
  const [raw, setRaw] = useState(''); // deliberately empty — the user asks
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState([]);
  const [history, setHistory] = useState(loadHistory);
  const [viewRunId, setViewRunId] = useState(null); // null → live batch
  const composerRef = useRef(null);

  /* the run being displayed: historical or the live one */
  const viewedRun = viewRunId != null ? history.find((h) => h.id === viewRunId) : null;
  const shownResults = viewedRun ? viewedRun.results : results;
  const isHistorical = !!viewedRun;

  function startNewBatch() {
    setResults([]);
    setRaw('');
    setProgress({ done: 0, total: 0 });
    setViewRunId(null);
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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
      await sleep(400);
    }
    setRunning(false);

    /* persist this completed run to history (localStorage, capped at 20) */
    const run = {
      id: Date.now(),
      date: new Date().toISOString(),
      questions: [...questions].slice(0, MAX_Q),
      results: acc,
    };
    const h = [run, ...loadHistory()].slice(0, 20);
    setHistory(h);
    persistHistory(h);
    setViewRunId(null); // stay on the live batch
  }

  const valid = shownResults.filter((r) => !r.error && r.delta != null);
  const stats = useMemo(() => {
    if (!valid.length) return null;
    const avg = (f) => valid.reduce((a, r) => a + f(r), 0) / valid.length;
    const improvements = valid.filter((r) => classify(r.delta) === 'improvement');
    const deficiencies = valid.filter((r) => classify(r.delta) === 'deficiency');
    const neutral = valid.filter((r) => classify(r.delta) === 'neutral');
    const sorted = [...valid].sort((a, b) => b.delta - a.delta);
    return {
      n: valid.length,
      avgQ: avg((r) => r.quality),
      avgB: avg((r) => r.baselineQuality),
      avgDelta: avg((r) => r.delta),
      improvements, deficiencies, neutral,
      best: sorted[0], worst: sorted[sorted.length - 1],
    };
  }, [shownResults]);

  const chartData = shownResults.map((r, i) => ({
    name: `Q${i + 1}`,
    guided: r.quality ?? 0,
    baseline: r.baselineQuality ?? 0,
    delta: r.delta ?? 0,
  }));

  const globalTone = !stats ? 'neutral'
    : classify(stats.avgDelta) === 'improvement' ? 'ok'
      : classify(stats.avgDelta) === 'deficiency' ? 'err' : 'neutral';

  return (
    <div className="relative mx-auto max-w-[1500px] px-8 pb-20 pt-10">
      {/* ambient accent */}
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[720px] -translate-x-1/2 rounded-full bg-sem/[0.07] blur-[110px]" />

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex items-center gap-2.5">
          <span className={`flex h-2 w-2 rounded-full ${running ? 'animate-pulse bg-sem' : 'bg-ok'}`} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mid">Batch Analysis</span>
          <span className="mono-num rounded-full border border-line bg-ink-850 px-2.5 py-0.5 text-[10.5px] text-low">
            PRODUCTION · CALLER-MODEL
          </span>
        </div>
        <h1 className="mt-3 max-w-3xl text-[34px] font-extrabold leading-[1.12] tracking-tight">
          Measure NeuraNet against{' '}
          <span className="bg-gradient-to-r from-sem via-[#9b8bfb] to-semdeep bg-clip-text text-transparent">
            its own absence
          </span>
        </h1>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-mid">
          Every question runs the full real pipeline, then the identical model answers again alone.
          The gap is the infrastructure's contribution — measured per question, honestly classified.
        </p>
      </motion.div>

      {/* ── Composer ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.35 }} className="mt-8" ref={composerRef}>
        <Glass>
          <div className="p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Layers size={14} className="text-sem" />
                <span className="text-[13px] font-semibold text-hi">Your questions</span>
                <span className="text-[11.5px] text-low">one per line · min 8 chars</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRaw(SAMPLE.join('\n'))}
                  disabled={running}
                  className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12px] font-medium text-mid transition-colors hover:border-white/20 hover:text-hi disabled:opacity-40"
                >
                  <RotateCcw size={11.5} /> Load samples
                </button>
                <span className={`mono-num rounded-full px-3 py-1 text-[11.5px] ${
                  questions.length > MAX_Q ? 'bg-warn/10 text-warn' : 'bg-white/[0.05] text-mid'
                }`}>
                  {Math.min(questions.length, MAX_Q)} / {MAX_Q}
                </span>
              </div>
            </div>

            <textarea
              id="batch-input"
              rows={questions.length ? Math.min(Math.max(questions.length, 3), 8) : 3}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              disabled={running}
              placeholder={'Ask anything…\ne.g. Identify the central bank of Senegal using primary sources'}
              className="w-full resize-y rounded-xl border border-line bg-ink-900/70 px-5 py-4 text-[14px] leading-relaxed text-hi shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-low/70 focus:border-sem/40 focus:outline-none focus:ring-4 focus:ring-sem/[0.07] disabled:opacity-60"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {running ? (
                <span className="flex items-center gap-2 text-[12.5px] text-mid">
                  <Sparkles size={13} className="animate-pulse text-sem" />
                  Executing real pipeline — question {progress.done} of {progress.total}
                </span>
              ) : (
                <span className="text-[12px] text-low">
                  Each run stores its strategy — rerunning an unfamiliar class usually flips it to TRANSFER.
                </span>
              )}
              <button
                onClick={runBatch}
                disabled={running || questions.length === 0}
                className="group relative flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-b from-[#6b82f3] to-semdeep px-6 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_4px_24px_rgba(85,112,241,0.35)] transition-all hover:shadow-[0_6px_32px_rgba(85,112,241,0.5)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                <Play size={14} className="transition-transform group-hover:scale-110" />
                {running ? `Running… ${progress.done}/${progress.total}` : 'Run batch'}
              </button>
            </div>

            {running && (
              <div className="mt-4 h-1 overflow-hidden rounded-full bg-ink-700">
                <motion.div
                  animate={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
                  transition={{ duration: 0.35 }}
                  className="h-full rounded-full bg-gradient-to-r from-semdeep via-sem to-ok"
                />
              </div>
            )}
            {questions.length > MAX_Q && (
              <p className="mt-3 flex items-center gap-1.5 text-[12px] text-warn">
                <AlertTriangle size={12} /> Only the first {MAX_Q} will run (API quota protection).
              </p>
            )}
          </div>
        </Glass>
      </motion.div>

      {/* ── Completion banner ── */}
      {!running && progress.total > 0 && results.length === progress.total && !isHistorical && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-[16px] border border-ok/25 bg-ok/[0.06] px-6 py-4"
        >
          <span className="flex items-center gap-2.5 text-[13.5px] font-medium text-hi">
            <CheckCircle2 size={16} className="text-ok" />
            Batch complete — {progress.total} question{progress.total > 1 ? 's' : ''} scored and saved to history.
          </span>
          <button
            onClick={startNewBatch}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-[#6b82f3] to-semdeep px-5 py-2 text-[12.5px] font-semibold text-white shadow-[0_4px_20px_rgba(85,112,241,0.35)] transition-shadow hover:shadow-[0_6px_28px_rgba(85,112,241,0.5)]"
          >
            <Plus size={13} /> New batch
          </button>
        </motion.div>
      )}

      {/* ── Historical banner ── */}
      {isHistorical && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-sem/25 bg-sem/[0.05] px-6 py-4">
          <span className="flex items-center gap-2.5 text-[13px] text-mid">
            <HistoryIcon size={14} className="text-sem" />
            Viewing batch from{' '}
            <b className="text-hi">{new Date(viewedRun.date).toLocaleString()}</b>
            {' '}· {viewedRun.results.length} questions
          </span>
          <button
            onClick={() => setViewRunId(null)}
            className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-[12.5px] font-medium text-mid hover:text-hi"
          >
            <ChevronLeft size={13} /> Back to current
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {!shownResults.length && !running && !isHistorical && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="mt-8 flex h-44 items-center justify-center rounded-[16px] border border-dashed border-line"
        >
          <p className="text-[13px] text-low">
            No batch yet. Add your questions above — the comparison appears here.
          </p>
        </motion.div>
      )}

      {/* ── Global scores ── */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
          className="mt-10"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-bold tracking-tight">Global scorecard</h2>
            <span className="mono-num text-[11.5px] text-low">n = {stats.n} scored · paired per question</span>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Avg quality — guided" tone="ok" count
              value={<CountUp target={stats.avgQ} />}
              sub={`baseline alone averages ${stats.avgB.toFixed(2)}`} />
            <Stat label="Infrastructure Δ" tone={globalTone === 'ok' ? 'ok' : globalTone === 'err' ? 'err' : 'neutral'} count signed
              value={<CountUp target={stats.avgDelta} decimals={3} signed />}
              sub={classify(stats.avgDelta) === 'improvement' ? 'net positive contribution'
                : classify(stats.avgDelta) === 'deficiency' ? 'net regression — see deficiencies'
                  : 'parity across the batch'} />
            <Stat label="Improvements" tone={stats.improvements.length ? 'ok' : 'neutral'}
              value={<span>{stats.improvements.length}<span className="text-low text-[18px]"> / {stats.n}</span></span>}
              sub="Δ ≥ +0.03 vs baseline" />
            <Stat label="Deficiencies" tone={stats.deficiencies.length ? 'err' : 'ok'}
              value={<span>{stats.deficiencies.length}<span className="text-low text-[18px]"> / {stats.n}</span></span>}
              sub={stats.deficiencies.length ? 'Δ ≤ −0.03 — diagnosed below' : 'none detected ✓'} />
          </div>
        </motion.div>
      )}

      {/* ── Chart ── */}
      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mt-6">
          <Glass>
            <div className="p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-[15px] font-semibold tracking-tight">Per-question comparison</h3>
                <div className="flex flex-wrap gap-2">
                  {[['Improvement', '#3ECF8E'], ['Neutral', '#5570F1'], ['Deficiency', '#F0655A'], ['Baseline', '#39414f']].map(([l, c]) => (
                    <span key={l} className="flex items-center gap-1.5 rounded-full border border-line bg-ink-900/60 px-2.5 py-1 text-[10.5px] font-medium text-mid">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} /> {l}
                    </span>
                  ))}
                </div>
              </div>
              <div className="h-[320px]" role="img" aria-label="Guided versus baseline quality per question">
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -18 }} barGap={5}>
                    <CartesianGrid stroke="#171c26" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#9AA3B0', fontSize: 12 }} axisLine={{ stroke: '#212733' }} tickLine={false} />
                    <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tick={{ fill: '#5B6472', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: '#ffffff05' }}
                      contentStyle={{
                        background: 'rgba(19,23,32,0.96)', border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: 12, fontSize: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                      }}
                      formatter={(v, k) => [Number(v).toFixed(2), k === 'guided' ? 'With NeuraNet' : 'Baseline']}
                      labelFormatter={(l) => `Question ${l.slice(1)}`}
                    />
                    <Bar dataKey="baseline" fill="#39414f" radius={[6, 6, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="guided" radius={[6, 6, 0, 0]} maxBarSize={30}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={
                          d.delta == null ? '#39414f'
                            : classify(d.delta) === 'improvement' ? '#3ECF8E'
                              : classify(d.delta) === 'deficiency' ? '#F0655A' : '#5570F1'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Glass>
        </motion.div>
      )}

      {/* ── Table ── */}
      {shownResults.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mt-6">
          <Glass>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-[10px] uppercase tracking-[0.14em] text-low">
                    <th className="px-6 py-3.5 font-semibold">#</th>
                    <th className="px-3 py-3.5 font-semibold">Question</th>
                    <th className="px-3 py-3.5 font-semibold">Mode</th>
                    <th className="px-3 py-3.5 text-right font-semibold">Guided</th>
                    <th className="px-3 py-3.5 text-right font-semibold">Baseline</th>
                    <th className="px-3 py-3.5 text-right font-semibold">Δ infra</th>
                    <th className="px-6 py-3.5 font-semibold">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {shownResults.map((r, i) => {
                    const cls = r.error ? 'failed' : classify(r.delta ?? 0);
                    return (
                      <tr key={i} className="group border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]">
                        <td className="mono-num px-6 py-4 align-top text-low">Q{i + 1}</td>
                        <td className="max-w-[380px] py-4 pr-3 align-top">
                          <span className="block truncate text-hi" title={r.task}>{r.task}</span>
                          {!r.error && r.path && (
                            <span className="mono-num block truncate text-[10.5px] text-low/80">{r.path}</span>
                          )}
                          {r.error && <span className="block text-[10.5px] text-err">{r.error}</span>}
                        </td>
                        <td className="py-4 pr-3 align-top">
                          {r.variant !== '?' ? (
                            <span className={`mono-num inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              r.variant === 'transfer' ? 'border-ok/30 bg-ok/[0.08] text-ok' : 'border-sem/30 bg-sem/[0.08] text-sem'
                            }`}>
                              {r.variant === 'transfer' ? `transfer ${r.sim.toFixed(2)}` : 'new path'}
                            </span>
                          ) : <span className="text-low">—</span>}
                        </td>
                        <td className="mono-num py-4 pr-3 text-right align-top font-semibold text-hi">{r.quality?.toFixed(2) ?? '—'}</td>
                        <td className="mono-num py-4 pr-3 text-right align-top text-mid">{r.baselineQuality?.toFixed(2) ?? '—'}</td>
                        <td className={`mono-num py-4 pr-3 text-right align-top text-[14px] font-bold ${
                          cls === 'improvement' ? 'text-ok' : cls === 'deficiency' ? 'text-err' : 'text-mid'
                        }`}>
                          {r.delta != null ? `${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-4 pl-3 align-top"><Pill kind={cls} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Glass>
        </motion.div>
      )}

      {/* ── Diagnosis ── */}
      {stats && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <Glass glow={stats.improvements.length ? 'ok' : null}>
              <div className="p-6">
                <div className="flex items-center gap-2.5">
                  <TrendingUp size={14} className="text-ok" />
                  <h3 className="text-[14px] font-bold tracking-tight">What improved</h3>
                </div>
                <ul className="mt-4 space-y-3">
                  {[
                    ...stats.improvements.map((r) => ({ r, why: explain(r) })),
                    ...(stats.neutral.length ? [{ r: stats.neutral[0], why: `${explain(stats.neutral[0])}${stats.neutral.length > 1 ? ` (+${stats.neutral.length - 1} other neutral runs)` : ''}` }] : []),
                  ].map(({ r, why }, i) => (
                    <li key={i} className="flex gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                      <span className="mono-num shrink-0 rounded-md bg-ink-900 px-2 py-1 text-[10.5px] font-bold text-low">
                        Q{shownResults.indexOf(r) + 1}
                      </span>
                      <span className="text-[12.5px] leading-relaxed text-mid">{why}</span>
                    </li>
                  ))}
                  {!stats.improvements.length && !stats.neutral.length && (
                    <li className="text-[13px] text-low">None observed in this batch.</li>
                  )}
                </ul>
              </div>
            </Glass>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.06 }}>
            <Glass glow={stats.deficiencies.length ? 'err' : null}>
              <div className="p-6">
                <div className="flex items-center gap-2.5">
                  <TrendingDown size={14} className="text-err" />
                  <h3 className="text-[14px] font-bold tracking-tight">Deficiencies & diagnosis</h3>
                </div>
                <ul className="mt-4 space-y-3">
                  {stats.deficiencies.map((r) => (
                    <li key={shownResults.indexOf(r)} className="flex gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                      <span className="mono-num shrink-0 rounded-md bg-ink-900 px-2 py-1 text-[10.5px] font-bold text-low">
                        Q{shownResults.indexOf(r) + 1}
                      </span>
                      <span className="text-[12.5px] leading-relaxed text-mid">{explain(r)}</span>
                    </li>
                  ))}
                  {!stats.deficiencies.length && (
                    <li className="flex items-center gap-2 rounded-lg border border-ok/20 bg-ok/[0.05] p-3 text-[13px] text-ok">
                      <TrendingUp size={13} /> No deficiency detected in this batch.
                    </li>
                  )}
                </ul>
                {stats.best && stats.worst && stats.best !== stats.worst && stats.deficiencies.length > 0 && (
                  <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11.5px] leading-relaxed text-low">
                    Spread: best Q{shownResults.indexOf(stats.best) + 1} ({stats.best.delta >= 0 ? '+' : ''}{stats.best.delta.toFixed(2)})
                    {' \u2192 '}worst Q{shownResults.indexOf(stats.worst) + 1} ({stats.worst.delta.toFixed(2)}).
                    Deficiencies on unstored phrasings are expected — each run stores its strategy, so rerun once to compare.
                  </p>
                )}
              </div>
            </Glass>
          </motion.div>
        </div>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10">
          <div className="mb-3 flex items-center gap-2.5">
            <HistoryIcon size={14} className="text-low" />
            <h3 className="text-[14px] font-bold tracking-tight">Batch history</h3>
            <span className="mono-num text-[11px] text-low">{history.length} saved · local to this browser</span>
          </div>
          <Glass>
            <div className="divide-y divide-white/[0.04]">
              {history.map((h) => {
                const scored = h.results.filter((r) => !r.error && r.delta != null);
                const avgD = scored.length ? scored.reduce((a, r) => a + r.delta, 0) / scored.length : null;
                const imp = scored.filter((r) => classify(r.delta) === 'improvement').length;
                const def = scored.filter((r) => classify(r.delta) === 'deficiency').length;
                const active = viewRunId === h.id;
                return (
                  <button
                    key={h.id}
                    onClick={() => setViewRunId(active ? null : h.id)}
                    className={`flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-white/[0.02] ${active ? 'bg-sem/[0.05]' : ''}`}
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      {active
                        ? <ChevronLeft size={14} className="shrink-0 text-sem" />
                        : <HistoryIcon size={13} className="shrink-0 text-low" />}
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-hi">
                          {new Date(h.date).toLocaleString()} · {h.results.length} questions
                        </div>
                        <div className="truncate text-[11.5px] text-low">{h.questions[0]}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={`mono-num rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        avgD == null ? 'text-low'
                          : classify(avgD) === 'improvement' ? 'bg-ok/10 text-ok'
                            : classify(avgD) === 'deficiency' ? 'bg-err/10 text-err' : 'bg-sem/10 text-sem'
                      }`}>
                        {avgD == null ? '—' : `${avgD >= 0 ? '+' : ''}${avgD.toFixed(3)} Δ`}
                      </span>
                      <span className="hidden text-[11px] text-low sm:inline">{imp}↑ · {def}↓</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Glass>
        </motion.div>
      )}
    </div>
  );
}

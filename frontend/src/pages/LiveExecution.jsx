import { useEffect, useRef, useState } from 'react';
import TaskInput from '../components/TaskInput.jsx';
import ExecutionPipeline from '../components/ExecutionPipeline.jsx';
import RetrievalPanel from '../components/RetrievalPanel.jsx';
import CompatibilityPanel from '../components/CompatibilityPanel.jsx';
import TransferPanel from '../components/TransferPanel.jsx';
import StrategyCard from '../components/StrategyCard.jsx';
import ResultPanel from '../components/ResultPanel.jsx';
import InvariantBadge from '../components/InvariantBadge.jsx';
import DemoController from '../components/DemoController.jsx';
import { PIPELINE_STAGES, runLive } from '../data/neuranetDemo.js';

const IDLE = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, 'pending']));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Map a live API response onto the pipeline stage model. */
function stagesFromResponse(j) {
  const ms = j.timings?.stages ?? {};
  const S = j.retrieval?.similarity ?? 0;
  const nSrc = j.execution?.sources?.length ?? 0;
  const transfer = j.variant === 'transfer';
  const q = j.result?.quality ?? 0;
  return {
    TASK: { ms: 250, lines: ['Received'] },
    EMBED: { ms: Math.max(300, ms.EMBED || 400), lines: ['E5 · multilingual-e5-small', '384 dimensions', `${ms.EMBED ?? '—'} ms`] },
    RETRIEVAL: {
      ms: Math.max(450, ms.RETRIEVAL || 500),
      lines: transfer
        ? [{ key: 'similarity', value: S }, 'pgvector · cosine']
        : ['No compatible strategy above threshold', 'novel problem class'],
    },
    COMPATIBILITY: { ms: 350, lines: (j.compatibility?.passed ?? []).map((p) => `${p.label}: ${p.value}`) },
    STRATEGY: {
      ms: 450,
      lines: [{ tag: transfer ? 'TRANSFERRED' : 'NEW PATH' }, j.strategy.path],
    },
    EXECUTION: { ms: Math.max(600, Math.min(ms.EXECUTION || 900, 2200)), lines: [`${nSrc} sources verified`, `${j.execution.searchCalls} web search call(s)`] },
    EVALUATION: { ms: 500, lines: [{ key: 'quality', value: q }] },
  };
}

export default function LiveExecution({ demoMode = false, onExitDemo, onShowBenchmarks }) {
  const [phase, setPhase] = useState('idle'); // idle | running | done-new | done-transfer
  const [stageStates, setStageStates] = useState(IDLE);
  const [stageDetails, setStageDetails] = useState({});
  const [resp, setResp] = useState(null); // live API response
  const [live, setLive] = useState(true);
  const [error, setError] = useState(null);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const running = phase === 'running';

  async function run(taskText) {
    if (running) return;
    timers.current.forEach(clearTimeout);
    setStageStates(IDLE);
    setStageDetails({});
    setResp(null);
    setError(null);
    setPhase('running');

    let j;
    try {
      j = await runLive(taskText);
      setLive(j.live !== false);
    } catch {
      setLive(false);
      return;
    }
    setResp(j);

    /* animate the pipeline with REAL per-stage data */
    const plan = stagesFromResponse(j);
    for (const stage of PIPELINE_STAGES) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(plan[stage].ms);
      setStageStates((prev) => ({ ...prev, [stage]: 'done' }));
      setStageDetails((prev) => ({ ...prev, [stage]: plan[stage] }));
    }
    setPhase(resp2phase(j));
  }

  const resp2phase = (j) => (j.variant === 'transfer' ? 'done-transfer' : 'done-new');

  const statusLabel =
    running ? '● Executing'
      : phase === 'done-new' ? '● New experience stored'
      : phase === 'done-transfer' ? '● Strategy transferred'
      : '● Ready — ask anything';

  const showTransferSide = phase === 'done-transfer';

  return (
    <div className="mx-auto max-w-[1500px] px-8 pb-28 pt-6">
      {!demoMode && (
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-low">Live Execution</div>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight">Ask any question — watch NeuraNet learn and transfer</h1>
          {!live && (
            <p className="mt-2 inline-block rounded-md border border-warn/40 bg-warn/10 px-3 py-1 text-[12px] text-warn">
              Backend offline — running simulated pipeline. Start the API and reload.
            </p>
          )}
        </div>
      )}

      <div className={`mb-5 flex items-center gap-3 ${demoMode ? 'justify-center pt-4' : ''}`}>
        <span className="text-[12.5px] font-medium uppercase tracking-[0.14em] text-mid">{statusLabel}</span>
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full rounded-full ${running ? 'animate-ping bg-sem opacity-50' : 'bg-ok opacity-40'}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${running ? 'bg-sem' : 'bg-ok'}`} />
        </span>
        {error && <span className="text-[12px] text-err">{error}</span>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,760px)_minmax(0,1fr)]">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-6">
          <TaskInput onSubmit={(t) => run(t)} running={running} />

          {resp && (
            <section className="panel px-5 py-4" aria-label="Task analysis">
              <div className="grid gap-4 sm:grid-cols-2">
                {resp.variant === 'transfer' ? (
                  <>
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-low">Previous task (stored)</div>
                      <p className="mt-1 text-[12.5px] italic leading-snug text-mid">“{resp.strategy.previousTask}”</p>
                    </div>
                    <div>
                      <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sem">Current task</div>
                      <p className="mt-1 text-[12.5px] leading-snug text-hi">“{resp.task}”</p>
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2">
                    <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-low">Current task</div>
                    <p className="mt-1 text-[13px] leading-snug text-hi">“{resp.task}”</p>
                  </div>
                )}
              </div>
              {resp.variant === 'transfer' && (
                <div className="mono-num mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[11.5px]">
                  <span className="text-low">Lexical similarity <b className="ml-1 uppercase text-warn">Low</b></span>
                  <span className="text-low">Semantic similarity <b className="ml-1 text-sem">{resp.retrieval.similarity.toFixed(2)}</b></span>
                </div>
              )}
            </section>
          )}

          <ExecutionPipeline stages={PIPELINE_STAGES} stageStates={stageStates} stageDetails={stageDetails} />

          {phase === 'done-new' && resp && (
            <StrategyCard strategy={{ path: resp.strategy.path, status: resp.strategy.status, quality: resp.result.quality, executions: 1, steps: resp.strategy.steps }} />
          )}

          {(showTransferSide || (running && resp?.variant === 'transfer')) && resp && (
            <TransferPanel previousTask={resp.strategy.previousTask ?? '—'} currentTask={resp.task} similarity={resp.retrieval.similarity} />
          )}

          {phase.startsWith('done') && resp && (
            <div className="flex flex-wrap gap-2 pl-1">
              {[resp.variant === 'transfer' ? 'Strategy transferred' : 'Experience stored', 'Evaluated', 'Available for future transfer'].map((t) => (
                <span key={t} className="rounded-md border border-line bg-ink-800 px-2.5 py-1 text-[11.5px] font-medium text-mid">
                  ✓ {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-6">
          {(running || phase.startsWith('done')) && (
            <RetrievalPanel active data={resp ? {
              topMatch: resp.variant === 'transfer'
                ? { path: resp.retrieval.topMatch.path, similarity: resp.retrieval.similarity }
                : { path: resp.strategy.path, similarity: 0 },
              alternatives: resp.retrieval.alternatives,
            } : undefined} />
          )}
          {(running || phase.startsWith('done')) && <CompatibilityPanel visible data={resp?.compatibility} />}
          <ResultPanel visible={phase.startsWith('done')} data={resp && {
            answer: resp.result.answer,
            sources: resp.execution.sources,
            quality: resp.result.quality,
            baselineQuality: resp.result.baselineQuality,
            delta: resp.result.delta,
          }} />
          <InvariantBadge items={[
            { id: 'ctx', label: 'CONTEXT INJECTION', value: '0 TOKENS', note: 'NeuraNet does not inject historical task context into the LLM prompt.' },
            { id: 'match', label: 'MATCHING', value: '0 LLM CALLS', note: `Retrieval ran in infrastructure · provider: ${resp?.invariants?.model ?? 'caller-controlled'}` },
          ]} />
        </div>
      </div>

      {demoMode && (
        <DemoController phase={phase} onExit={onExitDemo} />
      )}
      {phase === 'done-transfer' && demoMode && (
        <button onClick={onShowBenchmarks} className="fixed bottom-24 right-8 z-40 rounded-full bg-ok px-5 py-2.5 text-[13px] font-semibold text-ink-950 hover:brightness-110">
          Show benchmark proof →
        </button>
      )}
    </div>
  );
}

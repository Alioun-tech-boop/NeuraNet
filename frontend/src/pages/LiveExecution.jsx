import { useEffect, useMemo, useRef, useState } from 'react';
import TaskInput from '../components/TaskInput.jsx';
import ExecutionPipeline from '../components/ExecutionPipeline.jsx';
import RetrievalPanel from '../components/RetrievalPanel.jsx';
import CompatibilityPanel from '../components/CompatibilityPanel.jsx';
import TransferPanel from '../components/TransferPanel.jsx';
import StrategyCard from '../components/StrategyCard.jsx';
import ResultPanel from '../components/ResultPanel.jsx';
import InvariantBadge from '../components/InvariantBadge.jsx';
import DemoController from '../components/DemoController.jsx';
import { PIPELINE_STAGES, DEMO_TASKS, api, STRATEGIES, RESULT } from '../data/neuranetDemo.js';

const IDLE_STATES = Object.fromEntries(PIPELINE_STAGES.map((s) => [s, 'pending']));

export default function LiveExecution({ demoMode = false, onExitDemo, onShowBenchmarks }) {
  const [variant, setVariant] = useState('first'); // which task the input currently holds
  const [phase, setPhase] = useState('idle'); // idle | running1 | done1 | running2 | done2
  const [stageStates, setStageStates] = useState(IDLE_STATES);
  const [stageDetails, setStageDetails] = useState({});
  const [outcome, setOutcome] = useState(null); // {newPath} | {result}
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const running = phase === 'running1' || phase === 'running2';

  async function run(variantKey) {
    if (running) return;
    timers.current.forEach(clearTimeout);
    setStageStates(IDLE_STATES);
    setStageDetails({});
    setOutcome(null);
    setPhase(variantKey === 'first' ? 'running1' : 'running2');

    await api.runExecution(variantKey, {
      onStage: (stage, detail, elapsed) => {
        setStageStates((prev) => {
          const next = { ...prev, [stage]: 'done' };
          // mark previous stages done too (they are)
          return next;
        });
        setStageDetails((prev) => ({ ...prev, [stage]: detail }));
      },
    });

    /* resolve outcome */
    setOutcome(variantKey === 'first' ? { newPath: STRATEGIES[0] } : { result: RESULT });
    setPhase(variantKey === 'first' ? 'done1' : 'done2');
  }

  function runFirst() {
    setVariant('first');
    run('first');
  }
  function runSecond() {
    setVariant('second');
    run('second');
  }

  const statusLabel =
    running ? `● Executing` : phase === 'done1' ? '● Experience stored' : phase === 'done2' ? '● Strategy transferred' : '● Ready';

  return (
    <div className="mx-auto max-w-[1500px] px-8 pb-28 pt-6">
      {!demoMode && (
        <div className="mb-6 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-low">Live Execution</div>
            <h1 className="mt-1 text-[24px] font-bold tracking-tight">Watch NeuraNet learn and transfer a strategy</h1>
          </div>
        </div>
      )}

      {/* status line */}
      <div className={`mb-5 flex items-center gap-3 ${demoMode ? 'justify-center pt-4' : ''}`}>
        <span className="text-[12.5px] font-medium uppercase tracking-[0.14em] text-mid">{statusLabel}</span>
        <span className={`relative flex h-2 w-2 ${running ? '' : 'opacity-90'}`}>
          <span className={`absolute inline-flex h-full w-full rounded-full ${running ? 'animate-ping bg-sem opacity-50' : 'bg-ok'} ${running ? '' : 'opacity-40'}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${running ? 'bg-sem' : 'bg-ok'}`} />
        </span>
      </div>

      <div className={`grid gap-6 ${phase === 'done2' ? 'xl:grid-cols-[minmax(0,1fr)_420px]' : 'xl:grid-cols-[minmax(0,760px)_minmax(0,1fr)]'}`}>
        {/* ── Left column ── */}
        <div className="flex flex-col gap-6">
          <TaskInput
            key={variant}
            initialText={DEMO_TASKS[variant].text}
            onSubmit={() => (variant === 'first' ? runFirst() : runSecond())}
            running={running}
            ctaLabel={variant === 'second' ? 'RUN SEMANTIC TRANSFER' : 'RUN AGENT'}
          />

          {/* task contrast for the wow moment */}
          {variant === 'second' && (
            <section className="panel px-5 py-4" aria-label="Task comparison">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-low">Previous task</div>
                  <p className="mt-1 text-[12.5px] italic leading-snug text-mid">“{DEMO_TASKS.first.text}”</p>
                </div>
                <div>
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-sem">Current task</div>
                  <p className="mt-1 text-[12.5px] leading-snug text-hi">“{DEMO_TASKS.second.text}”</p>
                </div>
              </div>
              <div className="mono-num mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[11.5px]">
                <span className="text-low">Lexical similarity <b className="ml-1 uppercase text-warn">Low</b></span>
                <span className="text-low">Semantic similarity <b className="ml-1 text-sem">0.89</b></span>
              </div>
            </section>
          )}

          <ExecutionPipeline stages={PIPELINE_STAGES} stageStates={stageStates} stageDetails={stageDetails} />

          {/* outcome after pipeline completes */}
          {phase === 'done1' && outcome?.newPath && (
            <>
              <StrategyCard strategy={outcome.newPath} />
              <div className="flex flex-wrap gap-2 pl-1">
                {['Stored', 'Evaluated', 'Available for future transfer'].map((t) => (
                  <span key={t} className="rounded-md border border-line bg-ink-800 px-2.5 py-1 text-[11.5px] font-medium text-mid">
                    ✓ {t}
                  </span>
                ))}
              </div>
            </>
          )}

          {variant === 'second' && (phase === 'done2' || running) && <TransferPanel />}

          {phase === 'idle' && !demoMode && (
            <button
              onClick={runSecond}
              className="self-start text-[13px] font-medium text-sem underline-offset-4 hover:underline"
            >
              Try semantic transfer →
            </button>
          )}
          {demoMode && phase !== 'idle' && (
            <button
              onClick={() => { setVariant('first'); }}
              className="self-start text-[12px] text-low hover:text-mid"
            >
              ← Reset to first task
            </button>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-6">
          {(running && variant === 'second') || phase === 'done2' ? (
            <>
              <RetrievalPanel active />
              <CompatibilityPanel visible />
            </>
          ) : (
            <CompatibilityPanel visible={running || phase === 'done1'} />
          )}
          <ResultPanel visible={phase === 'done2'} />
          <InvariantBadge items={[
            { id: 'ctx', label: 'CONTEXT INJECTION', value: '0 TOKENS', note: 'NeuraNet does not inject historical task context into the LLM prompt.' },
            { id: 'match', label: 'MATCHING', value: '0 LLM CALLS', note: 'Semantic retrieval and strategy selection happen outside the model.' },
          ]} />
          {!demoMode && (
            <p className="pl-1 text-[11.5px] leading-relaxed text-low">
              Provider neutrality: the model is controlled by the caller. Switch it in the top bar — matching behavior is unchanged.
            </p>
          )}
        </div>
      </div>

      {demoMode && (
        <DemoController
          phase={phase}
          onRunFirst={runFirst}
          onRunSecond={runSecond}
          onExit={onExitDemo}
        />
      )}
      {/* anchor for demo step 5 */}
      {phase === 'done2' && demoMode && (
        <button onClick={onShowBenchmarks} className="fixed bottom-24 right-8 z-40 rounded-full bg-ok px-5 py-2.5 text-[13px] font-semibold text-ink-950 hover:brightness-110">
          Show benchmark proof →
        </button>
      )}
    </div>
  );
}

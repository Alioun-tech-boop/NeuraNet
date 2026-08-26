import PipelineStep from './PipelineStep.jsx';

export default function ExecutionPipeline({ stages, stageStates, stageDetails }) {
  return (
    <ol className="panel px-6 py-5" aria-label="Execution pipeline">
      {stages.map((s, i) => (
        <PipelineStep
          key={s}
          label={s}
          index={i}
          last={i === stages.length - 1}
          state={stageStates[s]}
          detail={stageDetails[s]}
        />
      ))}
    </ol>
  );
}

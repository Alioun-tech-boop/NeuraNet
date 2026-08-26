import ExperienceGraph from '../components/ExperienceGraph.jsx';

export default function ExperienceGraphPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-8 pb-16 pt-8">
      <div className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-low">Experience Graph</div>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight">How tasks, strategies and transfers connect</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-mid">
          Click any node to inspect its metadata. Dashed edges are semantic transfers — different wording,
          same underlying problem class.
        </p>
      </div>
      <ExperienceGraph />
    </div>
  );
}

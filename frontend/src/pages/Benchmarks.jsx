import BenchmarkCard, { CompareStat, LiftStat } from '../components/BenchmarkCard.jsx';
import BenchmarkChart from '../components/BenchmarkChart.jsx';
import { BENCHMARKS } from '../data/neuranetDemo.js';

export default function Benchmarks() {
  const b = BENCHMARKS;
  return (
    <div className="mx-auto max-w-[1500px] px-8 pb-16 pt-8">
      <div className="mb-7">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-low">NeuraNet Benchmark</div>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight">Measured claims, not promises</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-mid">
          Locked test set, paired comparisons, bootstrap confidence intervals.
          Results below are the actual measured outcomes — including the one that did not replicate.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <BenchmarkCard title="Semantic Retrieval" footer="E5 multilingual-small · 384 dims vs PostgreSQL trigram baseline">
          <CompareStat labelA="E5 MRR" valueA={b.retrieval.e5.mrr} delta={b.retrieval.improvement} labelB="pg_trgm MRR" valueB={b.retrieval.trgm.mrr} />
        </BenchmarkCard>

        <BenchmarkCard
          title="Controlled Transfer"
          footer={`n = ${b.transfer.n} paired tasks · bootstrap B = ${b.transfer.bootstrapB.toLocaleString()} · negative transfer ${(b.transfer.negativeTransferRate * 100).toFixed(1)}%`}
        >
          <div className="grid grid-cols-2 gap-3">
            <LiftStat label="Transfer lift (E−A)" mean={b.transfer.lift.mean} ci={b.transfer.lift.ci} />
            <LiftStat label="Relevance lift (E−F)" mean={b.transfer.relevance.mean} ci={b.transfer.relevance.ci} />
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-low">
            E = full NeuraNet · A = baseline without strategy · F = shuffled strategy control.
            Positive relevance lift means the gain comes from the <em>right</em> strategy, not from extra context.
          </p>
        </BenchmarkCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="panel p-6">
          <div className="panel-title mb-3">Condition comparison</div>
          <BenchmarkChart />
        </div>

        <div className="panel p-6">
          <div className="panel-title">Provider neutrality</div>
          <table className="mt-4 w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-[0.12em] text-low">
                <th className="pb-2 pr-3 font-medium">Model</th>
                <th className="pb-2 pr-3 font-medium">Lift E−A</th>
                <th className="pb-2 font-medium">95% CI</th>
              </tr>
            </thead>
            <tbody>
              {b.providers.map((p) => (
                <tr key={p.model} className="border-b border-line last:border-0">
                  <td className="mono-num py-2.5 pr-3 text-hi">{p.model}</td>
                  <td className={`mono-num py-2.5 pr-3 font-bold ${p.lift.startsWith('+') ? 'text-ok' : 'text-mid'}`}>{p.lift}</td>
                  <td className={`mono-num py-2.5 ${p.significant ? 'text-ok' : 'text-low'}`}>{p.ci}{!p.significant && ' · ns'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11.5px] leading-relaxed text-low">
            Lift is positive and significant on the 7B model; inconclusive on the 20B reasoning model.
            We report both. The capability-ladder study quantifying where guidance helps most is running in Colab.
          </p>
        </div>
      </div>

      <p className="mt-8 max-w-3xl text-[11.5px] leading-relaxed text-low">
        Methodology: dataset locked before evaluation · temporal leakage 0 · shuffled control seeded per task ·
        deterministic blind judge (temperature 0) with measured consistency · quality scored by an independent model,
        never by the executing model itself.
      </p>
    </div>
  );
}

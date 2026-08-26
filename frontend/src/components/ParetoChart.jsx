import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, ZAxis } from 'recharts';
import { PARETO } from '../data/neuranetDemo.js';

/** Strategy Evolution — dominated candidates fade; only the frontier stays active. */
export default function ParetoChart() {
  const frontier = PARETO.frontier.map((p) => ({ ...p, kind: 'frontier' }));
  const dominated = PARETO.dominated.map((p) => ({ ...p, kind: 'dominated' }));

  return (
    <div className="h-[320px] w-full" role="img" aria-label="Pareto frontier of strategy cost versus quality">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 18, left: 0 }}>
          <CartesianGrid stroke="#1a1f2b" strokeDasharray="0" vertical={false} />
          <XAxis
            type="number"
            dataKey="cost"
            name="Cost"
            domain={[0, 0.01]}
            tickFormatter={(v) => `$${(v * 1000).toFixed(1)}e-3`}
            tick={{ fill: '#5B6472', fontSize: 11 }}
            axisLine={{ stroke: '#212733' }}
            tickLine={false}
            label={{ value: 'Cost per execution', position: 'insideBottom', offset: -8, fill: '#5B6472', fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="quality"
            name="Quality"
            domain={[0.5, 0.97]}
            tick={{ fill: '#5B6472', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Quality', angle: -90, position: 'insideLeft', fill: '#5B6472', fontSize: 11 }}
          />
          <ZAxis range={[110, 110]} />

          {/* frontier envelope */}
          {frontier.map((p) => (
            <ReferenceLine key={p.path} x={p.cost} y={p.quality} stroke="#3ECF8E22" strokeWidth={1} />
          ))}

          <Scatter name="Dominated" data={dominated} fill="#39414f" fillOpacity={0.55} />
          <Scatter name="Pareto frontier" data={frontier} fill="#3ECF8E" />
        </ScatterChart>
      </ResponsiveContainer>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3 px-1 text-[11.5px]">
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 text-mid"><span className="h-2 w-2 rounded-full bg-ok" /> Pareto frontier — active</span>
          <span className="flex items-center gap-1.5 text-low"><span className="h-2 w-2 rounded-full bg-[#39414f]" /> Dominated — eliminated</span>
        </div>
        <span className="text-low">Only non-dominated strategies remain active.</span>
      </div>
    </div>
  );
}

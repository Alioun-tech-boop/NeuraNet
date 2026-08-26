import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BENCHMARKS } from '../data/neuranetDemo.js';

const DATA = [
  { name: 'Baseline', q: BENCHMARKS.transfer.baseline },
  { name: 'Shuffled', q: BENCHMARKS.transfer.shuffled },
  { name: 'NeuraNet', q: BENCHMARKS.transfer.neuranet },
];

export default function BenchmarkChart() {
  return (
    <div className="h-[260px] w-full" role="img" aria-label="Controlled transfer quality by condition">
      <ResponsiveContainer>
        <BarChart data={DATA} margin={{ top: 10, right: 12, bottom: 4, left: -18 }}>
          <CartesianGrid stroke="#1a1f2b" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#9AA3B0', fontSize: 12 }} axisLine={{ stroke: '#212733' }} tickLine={false} />
          <YAxis domain={[0.7, 0.95]} tick={{ fill: '#5B6472', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toFixed(2)} />
          <Tooltip
            cursor={{ fill: '#ffffff06' }}
            contentStyle={{ background: '#131720', border: '1px solid #212733', borderRadius: 10, fontSize: 12 }}
            formatter={(v) => [v.toFixed(3), 'Mean quality']}
          />
          <Bar dataKey="q" radius={[6, 6, 0, 0]} maxBarSize={72}>
            {DATA.map((d) => (
              <Cell key={d.name} fill={d.name === 'NeuraNet' ? '#3ECF8E' : d.name === 'Shuffled' ? '#5570F166' : '#39414f'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="px-1 pt-1 text-[11.5px] text-low">
        n = {BENCHMARKS.transfer.n} paired tasks · bootstrap B = {BENCHMARKS.transfer.bootstrapB.toLocaleString()} ·
        negative transfer rate {(BENCHMARKS.transfer.negativeTransferRate * 100).toFixed(1)}%
      </div>
    </div>
  );
}

import { useState } from 'react';
import { chat as neuraChat } from '../lib/neuraAdapter.js';
import { motion } from 'framer-motion';

const AVAILABLE_MODELS = [
  { provider: 'groq', id: 'allam-2-7b', label: 'Allam 2 7B' },
  { provider: 'groq', id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B' },
  { provider: 'openrouter', id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
  { provider: 'gemini', id: 'gemini-flash-latest', label: 'Gemini Flash' },
];

export default function ModelCompare() {
  const [task, setTask] = useState('Explain quantum computing in simple terms');
  const [selected, setSelected] = useState(['allam-2-7b', 'gemini-flash-latest']);
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(0, 3));
  }

  async function run() {
    if (!task.trim() || selected.length === 0) return;
    setRunning(true);
    setResults({});
    const promises = selected.map(async id => {
      const m = AVAILABLE_MODELS.find(x => x.id === id);
      try {
        const res = await neuraChat({ message: task, model: { provider: m.provider, id: m.id } });
        return [id, { text: res.reply, experience: res.experience, error: null }];
      } catch (e) {
        return [id, { text: '', error: e.message }];
      }
    });
    const entries = await Promise.all(promises);
    const map = Object.fromEntries(entries);
    setResults(map);
    setRunning(false);
  }

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <h1 className="text-[22px] font-bold tracking-tight">Compare models</h1>
      <p className="mt-1 text-[13px] text-neura-muted">You choose the models. NeuraNet experience remains independent from the provider. Results appear side-by-side.</p>

      <div className="mt-6 rounded-2xl border border-neura-border bg-neura-panel p-4">
        <textarea
          value={task} onChange={e => setTask(e.target.value)}
          rows={2} placeholder="Task to run across models"
          className="w-full resize-none rounded-xl border border-neura-border bg-neura-bg px-4 py-3 text-[14px] focus:border-neura-accent/40 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {AVAILABLE_MODELS.map(m => (
            <button
              key={m.id}
              onClick={() => toggle(m.id)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${selected.includes(m.id) ? 'border-neura-accent bg-neura-accent/15 text-neura-accent' : 'border-neura-border bg-neura-surface text-neura-muted'}`}
            >
              {m.label}
            </button>
          ))}
          <button onClick={run} disabled={running} className="ml-auto rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-neura-bg disabled:opacity-40">
            {running ? 'Running…' : 'Compare'}
          </button>
        </div>
        <div className="mt-2 text-[11px] text-neura-muted">NeuraNet does not select a winner — you do.</div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {selected.map(id => {
          const m = AVAILABLE_MODELS.find(x => x.id === id);
          const r = results[id];
          return (
            <motion.div key={id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-neura-border bg-neura-panel p-4">
              <div className="text-[12px] font-semibold text-neura-muted">{m.label} · {m.provider}</div>
              {!r && <div className="mt-3 text-[13px] text-neura-muted">{running ? 'Waiting…' : 'Not yet run'}</div>}
              {r?.error && <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-[12px] text-red-300">{r.error}</div>}
              {r?.text && <div className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-neura-hi">{r.text.slice(0, 1200)}</div>}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

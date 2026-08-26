import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, TrendingUp, Clock, Repeat, ArrowRight } from 'lucide-react';
import { getExperiences } from '../lib/neuraAdapter.js';

const WORKFLOW_LABELS = {
  research: 'Research', code: 'Coding', data: 'Data analysis', finance: 'Financial analysis', decision: 'Decision',
  neura: 'General', demo: 'Demo',
};

export default function ExperiencePage({ onOpenStrategy }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getExperiences().then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-neura-muted">Loading experiences…</div>;
  if (error) return (
    <div className="p-8">
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-[13px] text-red-300">NeuraNet experience temporarily unavailable — {error}</div>
    </div>
  );

  const experiences = data?.experiences || [];
  const byWorkflow = data?.byWorkflow || {};

  // Group for display
  const groups = Object.entries(byWorkflow).length ? Object.entries(byWorkflow) : [['all', experiences]];

  return (
    <div className="mx-auto max-w-[1100px] px-8 py-8">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Your Experience</h1>
          <p className="mt-1 text-[13px] text-neura-muted">What NEURA has learned from your tasks — procedural strategies, not answers.</p>
        </div>
        <span className="rounded-full border border-neura-border bg-neura-panel px-3 py-1 text-[11px] font-medium text-neura-muted">{experiences.length} strategies</span>
      </div>

      {experiences.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-neura-border bg-neura-panel p-10 text-center">
          <Layers size={20} className="mx-auto text-neura-muted" />
          <div className="mt-3 text-[14px] font-medium">No experience yet</div>
          <div className="mt-1 text-[13px] text-neura-muted">Complete a few tasks in the workspace — Neura will learn how you solve them.</div>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {groups.map(([wf, list]) => (
            <section key={wf}>
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-neura-muted">{WORKFLOW_LABELS[wf] || wf}</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-mono text-neura-sub">{list.length}</span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {list.map((exp, i) => (
                  <motion.button
                    key={exp.path || i}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    onClick={() => onOpenStrategy?.(exp)}
                    className="rounded-2xl border border-neura-border bg-neura-panel p-4 text-left hover:border-white/10 hover:bg-neura-elevated transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-mono text-[12.5px] font-medium text-neura-hi truncate">{exp.path || exp.name}</div>
                      <ArrowRight size={13} className="shrink-0 text-neura-muted" />
                    </div>
                    <div className="mt-1 line-clamp-2 text-[12.5px] text-neura-sub">{exp.description?.slice(0, 120) || 'Procedural strategy'}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-neura-sub"><TrendingUp size={10} /> {(exp.confidence * 100).toFixed(0)}%</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-neura-sub"><Repeat size={10} /> {exp.steps?.steps?.length || exp.steps?.length || 0} steps</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-1 text-neura-sub"><Clock size={10} /> {new Date(exp.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

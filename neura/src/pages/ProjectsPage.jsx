import { useState } from 'react';
import { FolderKanban, Plus, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ProjectsPage({ projects, onCreateProject, onOpenProject, onSelectConversation }) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  function handleCreate() {
    if (!name.trim()) return;
    onCreateProject({ name: name.trim() });
    setName('');
    setCreating(false);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-8 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-[13px] text-neura-muted">Group conversations, files and relevant experiences by workspace context.</p>
        </div>
        <button onClick={() => setCreating(v => !v)} className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-neura-bg">
          <Plus size={14} /> New project
        </button>
      </div>

      {creating && (
        <div className="mt-6 flex gap-2">
          <input
            value={name} onChange={e => setName(e.target.value)} placeholder="Project name"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="flex-1 rounded-xl border border-neura-border bg-neura-panel px-4 py-2.5 text-[14px] placeholder:text-neura-muted focus:border-neura-accent/40 focus:outline-none"
          />
          <button onClick={handleCreate} className="rounded-xl bg-neura-accent px-4 py-2 text-[13px] font-semibold text-white">Create</button>
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {projects.map((p, i) => (
          <motion.div
            key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => onOpenProject(p.id)}
            className="cursor-pointer rounded-2xl border border-neura-border bg-neura-panel p-5 hover:bg-neura-elevated hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl text-white" style={{ background: p.color }}>
                <FolderKanban size={14} />
              </span>
              <div className="font-semibold text-[14px]">{p.name}</div>
              <span className="ml-auto text-[11px] text-neura-muted">{p.conversations?.length || 0} chats</span>
            </div>
            <div className="mt-3 space-y-1">
              {(p.conversations || []).slice(0, 3).map(cid => (
                <div key={cid} className="flex items-center gap-1.5 text-[12px] text-neura-sub">
                  <MessageSquare size={12} /> {cid}
                </div>
              ))}
              {(!p.conversations || p.conversations.length === 0) && <div className="text-[12px] text-neura-muted">No conversations yet</div>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

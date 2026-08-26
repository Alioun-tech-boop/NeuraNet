import NeuraBrand from './NeuraBrand.jsx';
import { Plus, MessageSquare, FolderKanban, Sparkles, Layers, Settings, Search, GitCompare } from 'lucide-react';

const NAV = [
  { id: 'home', label: 'Home', icon: Sparkles },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'experiences', label: 'Experiences', icon: Layers },
  { id: 'compare', label: 'Compare', icon: GitCompare },
];

export default function Sidebar({ view, onNavigate, conversations = [], activeId, onNewChat }) {
  return (
    <aside className="flex w-[244px] shrink-0 flex-col border-r border-neura-border bg-neura-surface">
      <div className="flex h-[56px] items-center gap-3 border-b border-neura-border px-4">
        <NeuraBrand size={24} />
      </div>

      <div className="p-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[13px] font-semibold text-neura-bg hover:bg-zinc-100"
        >
          <Plus size={14} /> New
        </button>
      </div>

      <nav className="flex-1 overflow-auto px-2 py-2">
        <div className="space-y-1">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${view === item.id ? 'bg-white text-neura-bg font-medium' : 'text-neura-sub hover:bg-white/[0.06] hover:text-neura-hi'}`}
            >
              <item.icon size={15} strokeWidth={view === item.id ? 2.2 : 1.7} />
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neura-muted">Conversations</div>
          <div className="mt-2 space-y-0.5">
            {conversations.length === 0 && <div className="px-3 py-2 text-[12px] text-neura-muted">No conversations yet</div>}
            {conversations.slice(0, 20).map(c => (
              <button
                key={c.id}
                onClick={() => onNavigate('chat', c.id)}
                className={`flex w-full items-center gap-2 truncate rounded-lg px-3 py-2 text-left text-[12.5px] ${activeId === c.id ? 'bg-white/[0.08] text-neura-hi' : 'text-neura-sub hover:bg-white/[0.04]'}`}
              >
                <MessageSquare size={13} className="shrink-0 opacity-60" />
                <span className="truncate">{c.title || 'Untitled'}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="border-t border-neura-border p-2">
        <button onClick={() => onNavigate('settings')} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] ${view === 'settings' ? 'bg-white text-neura-bg' : 'text-neura-sub hover:bg-white/[0.06]'}`}>
          <Settings size={15} /> Settings
        </button>
      </div>
    </aside>
  );
}

import NeuraBrand from './NeuraBrand.jsx';
import { Plus, MessageSquare, FolderKanban, Sparkles, Layers, Settings, Search, GitCompare, Code2, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { motion } from 'framer-motion';

const NAV = [
  { id: 'home', label: 'Home', icon: Sparkles },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'code', label: 'Code', icon: Code2 },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'experiences', label: 'Experience', icon: Layers },
  { id: 'compare', label: 'Compare', icon: GitCompare },
];

export default function Sidebar({ view, onNavigate, conversations = [], activeId, onNewChat, collapsed, onToggleCollapse }) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 244 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="flex shrink-0 flex-col overflow-hidden border-r border-neura-border bg-neura-surface"
    >
      <div className="flex h-[56px] items-center justify-between gap-2 border-b border-neura-border px-3">
        {!collapsed ? <NeuraBrand size={24} /> : <NeuraBrand size={22} showText={false} />}
        <button onClick={onToggleCollapse} className="flex h-7 w-7 items-center justify-center rounded-lg text-neura-muted hover:bg-white/[0.06] hover:text-neura-hi">
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      <div className="p-2">
        <button
          onClick={onNewChat}
          className={`flex w-full items-center justify-center gap-2 rounded-xl bg-white text-neura-bg hover:bg-zinc-100 ${collapsed ? 'px-2 py-2.5' : 'px-3 py-2.5 text-[13px] font-semibold'}`}
          title="New (⌘N)"
        >
          <Plus size={14} />
          {!collapsed && 'New'}
        </button>
      </div>

      <nav className="flex-1 overflow-auto px-2 py-2">
        <div className="space-y-0.5">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              title={collapsed ? item.label : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${view === item.id ? 'bg-white text-neura-bg font-medium' : 'text-neura-sub hover:bg-white/[0.06] hover:text-neura-hi'} ${collapsed ? 'justify-center' : ''}`}
            >
              <item.icon size={15} strokeWidth={view === item.id ? 2.2 : 1.7} />
              {!collapsed && item.label}
            </button>
          ))}
        </div>

        {!collapsed && (
          <div className="mt-6">
            <div className="px-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-neura-muted">Recents</div>
            <div className="mt-2 space-y-0.5">
              {conversations.length === 0 && <div className="px-2.5 py-2 text-[12px] text-neura-muted">Nothing here yet.</div>}
              {conversations.slice(0, 12).map(c => (
                <button
                  key={c.id}
                  onClick={() => onNavigate('chat', c.id)}
                  className={`flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-2 text-left text-[12.5px] ${activeId === c.id ? 'bg-white/[0.08] text-neura-hi' : 'text-neura-sub hover:bg-white/[0.04]'}`}
                >
                  <MessageSquare size={12} className="shrink-0 opacity-60" />
                  <span className="truncate">{c.title || 'Untitled'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-neura-border p-2">
        <button onClick={() => onNavigate('settings')} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] ${view === 'settings' ? 'bg-white text-neura-bg' : 'text-neura-sub hover:bg-white/[0.06]'} ${collapsed ? 'justify-center' : ''}`} title="Settings">
          <Settings size={15} />
          {!collapsed && 'Settings'}
        </button>
        {!collapsed && <div className="px-2.5 pt-2 text-[10px] text-neura-muted">⌘K · ⌘N · ⌘,</div>}
      </div>
    </motion.aside>
  );
}

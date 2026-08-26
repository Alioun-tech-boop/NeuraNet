import { Activity, Boxes, GitBranch, LayoutDashboard, ListChecks, Network, Settings2, Server, Webhook } from 'lucide-react';

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'live', label: 'Live Execution', icon: Activity },
  { id: 'batch', label: 'Batch Analysis', icon: ListChecks },
  { id: 'graph', label: 'Experience Graph', icon: Network },
  { id: 'strategies', label: 'Strategies', icon: GitBranch },
  { id: 'benchmarks', label: 'Benchmarks', icon: Boxes },
];

const FOOTER = [
  { id: 'system', label: 'System', icon: Server },
  { id: 'api', label: 'API', icon: Webhook },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

export default function Sidebar({ view, onNavigate, onDemoMode }) {
  const Item = ({ item }) => (
    <button
      onClick={() => onNavigate(item.id)}
      aria-current={view === item.id ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] transition-colors duration-150 ${
        view === item.id ? 'bg-sem/10 font-medium text-hi' : 'text-mid hover:bg-white/[0.04] hover:text-hi'
      }`}
    >
      <item.icon size={16} strokeWidth={1.8} className={view === item.id ? 'text-sem' : 'text-low'} />
      {item.label}
    </button>
  );

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[228px] flex-col border-r border-line bg-ink-900 px-4 pb-5 pt-6">
      <div className="mb-9 flex items-center gap-2.5 px-2">
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="#10131A" stroke="#212733" />
          <path d="M9 23V9l14 14V9" stroke="#7C8CF8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <div className="text-[15px] font-bold leading-none tracking-wide">NEURANET</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-low">Infrastructure</div>
        </div>
      </div>

      <nav aria-label="Primary" className="flex flex-col gap-0.5">
        {NAV.map((i) => <Item key={i.id} item={i} />)}
      </nav>

      <nav aria-label="Secondary" className="mt-auto flex flex-col gap-0.5 border-t border-line pt-4">
        {FOOTER.map((i) => <Item key={i.id} item={i} />)}
        <button
          onClick={onDemoMode}
          className="mt-2 flex items-center gap-3 rounded-lg border border-sem/25 bg-sem/[0.07] px-3 py-2 text-[13px] font-medium text-sem transition-colors duration-150 hover:bg-sem/15"
        >
          <Activity size={15} strokeWidth={2} />
          YC Demo Mode
        </button>
      </nav>
    </aside>
  );
}

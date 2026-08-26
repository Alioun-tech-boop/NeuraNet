import ModelSelector from './ModelSelector.jsx';
import SystemStatus from './SystemStatus.jsx';
import { Search } from 'lucide-react';

export default function TopBar({ model, onModelChange, onDemo }) {
  return (
    <header className="flex h-[56px] items-center justify-between border-b border-neura-border bg-neura-bg/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full border border-neura-border bg-neura-panel px-3 py-1.5 text-[12px] text-neura-muted md:flex">
          <Search size={13} />
          <span>Search conversations</span>
          <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">⌘K</span>
        </div>
        {onDemo && (
          <button onClick={onDemo} className="hidden rounded-full bg-violet-500/15 px-3 py-1.5 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/25 md:inline-flex">
            Demo
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-[11px] text-neura-muted md:inline">Model selected by you</span>
        <ModelSelector value={model} onChange={onModelChange} compact />
        <SystemStatus compact />
      </div>
    </header>
  );
}

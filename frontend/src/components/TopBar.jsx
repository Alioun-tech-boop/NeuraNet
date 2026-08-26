import ProviderSelector from './ProviderSelector.jsx';

export default function TopBar({ provider, model, onProviderChange, onModelChange }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-ink-900/80 px-8 backdrop-blur-md">
      <div className="flex items-center gap-6 text-[12.5px] text-mid">
        <span className="flex items-center gap-2">
          Workspace <span className="font-medium text-hi">Demo</span>
        </span>
        <span className="hidden items-center gap-2 lg:flex">
          Environment <span className="font-medium text-hi">Production</span>
        </span>
        <ProviderSelector
          provider={provider}
          model={model}
          onProviderChange={onProviderChange}
          onModelChange={onModelChange}
        />
      </div>
      <div className="flex items-center gap-2 text-[12.5px] text-mid">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
        </span>
        Operational
      </div>
    </header>
  );
}

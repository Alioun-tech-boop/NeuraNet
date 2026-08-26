import { ChevronDown } from 'lucide-react';
import { PROVIDERS } from '../data/neuranetDemo.js';

/** Provider/model picker. Communicates: the caller controls the model — NeuraNet is provider-neutral. */
export default function ProviderSelector({ provider, model, onProviderChange, onModelChange, compact = false }) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="prov-select" className="sr-only">Provider</label>
      <select
        id="prov-select"
        value={provider}
        onChange={(e) => onProviderChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-md border border-line bg-ink-850 py-1 pl-2.5 pr-6 text-[12.5px] font-medium text-hi focus:border-sem/50 focus:outline-none"
      >
        {PROVIDERS.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>

      <label htmlFor="model-select" className="sr-only">Model</label>
      <select
        id="model-select"
        value={model}
        onChange={(e) => onModelChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-md border border-line bg-ink-850 py-1 pl-2.5 pr-6 mono-num text-[12px] text-mid focus:border-sem/50 focus:outline-none"
      >
        {(PROVIDERS.find((p) => p.id === provider)?.models ?? []).map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      {!compact && <ChevronDown size={12} className="-ml-5 mr-1 pointer-events-none text-low" aria-hidden="true" />}
      <span className="hidden rounded border border-line bg-ink-850 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-low xl:inline">
        Model controlled by caller
      </span>
    </div>
  );
}

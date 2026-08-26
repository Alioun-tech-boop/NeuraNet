import { useState } from 'react';

export default function TaskInput({ initialText, onSubmit, running, ctaLabel = 'RUN AGENT' }) {
  const [text, setText] = useState(initialText);

  return (
    <form
      className="panel p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!running) onSubmit(text);
      }}
    >
      <label htmlFor="task-input" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-low">
        Task
      </label>
      <textarea
        id="task-input"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={running}
        className="mt-2 w-full resize-none rounded-lg border border-line bg-ink-900 px-4 py-3 text-[15px] leading-relaxed text-hi placeholder:text-low focus:border-sem/50 focus:outline-none disabled:opacity-60"
        placeholder="Describe the task for the agent…"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11.5px] text-low">Executed by the caller's model — NeuraNet never replaces it.</span>
        <button
          type="submit"
          disabled={running}
          className="rounded-lg bg-semdeep px-5 py-2 text-[13px] font-semibold tracking-wide text-white transition-colors duration-150 hover:bg-[#6b82f3] disabled:cursor-wait disabled:opacity-50"
        >
          {running ? 'Running…' : ctaLabel}
        </button>
      </div>
    </form>
  );
}

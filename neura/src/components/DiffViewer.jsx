export default function DiffViewer({ diff, onAccept, onReject }) {
  if (!diff) return (
    <div className="rounded-xl border border-dashed border-neura-border p-6 text-center text-[13px] text-neura-muted">
      No changes to review yet.
    </div>
  );
  return (
    <div className="overflow-hidden rounded-xl border border-neura-border bg-neura-panel">
      <div className="flex items-center justify-between border-b border-neura-border px-4 py-2">
        <span className="font-mono text-[12px] text-neura-muted">{diff.file}</span>
        <div className="flex gap-2">
          <button onClick={onReject} className="rounded-lg border border-neura-border px-3 py-1 text-[12px] text-neura-muted hover:text-neura-hi">Reject</button>
          <button onClick={onAccept} className="rounded-lg bg-emerald-500 px-3 py-1 text-[12px] font-semibold text-white">Accept</button>
        </div>
      </div>
      <div className="grid grid-cols-2 font-mono text-[12px] leading-6">
        <div className="border-r border-neura-border bg-red-500/[0.06] p-3">
          <div className="text-[11px] uppercase tracking-widest text-red-300">Before</div>
          <pre className="mt-2 whitespace-pre-wrap text-neura-sub">{diff.before}</pre>
        </div>
        <div className="bg-emerald-500/[0.06] p-3">
          <div className="text-[11px] uppercase tracking-widest text-emerald-300">After</div>
          <pre className="mt-2 whitespace-pre-wrap text-neura-hi">{diff.after}</pre>
        </div>
      </div>
    </div>
  );
}

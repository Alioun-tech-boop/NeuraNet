import { useRef, useState } from 'react';
import { Paperclip, Globe, SlidersHorizontal, ArrowUp, Square } from 'lucide-react';

export default function Composer({ onSend, onStop, streaming, selectedModel, projectId }) {
  const [text, setText] = useState('');
  const [web, setWeb] = useState(true);
  const fileRef = useRef(null);
  const [files, setFiles] = useState([]);

  const canSend = text.trim().length > 2 && !streaming;

  function handleSend() {
    if (!canSend) return;
    onSend({ text: text.trim(), web, files, projectId });
    setText('');
    setFiles([]);
  }

  function handleFiles(e) {
    const list = Array.from(e.target.files || []);
    setFiles(prev => [...prev, ...list].slice(0, 5));
  }

  return (
    <div className="rounded-[20px] border border-neura-border bg-neura-panel p-3 shadow-card">
      {/* files preview */}
      {files.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-neura-border bg-neura-surface px-2.5 py-1 text-[11.5px] text-neura-sub">
              {f.name.slice(0, 28)}
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-neura-muted hover:text-neura-hi">×</button>
            </span>
          ))}
        </div>
      )}

      <textarea
        rows={text.split('\n').length > 2 ? 3 : 2}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
        }}
        placeholder="What are you working on?"
        className="w-full resize-none bg-transparent px-3 py-2 text-[14.5px] leading-relaxed placeholder:text-neura-muted focus:outline-none"
      />

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button onClick={() => fileRef.current?.click()} className="flex h-8 w-8 items-center justify-center rounded-full border border-neura-border bg-neura-surface text-neura-muted hover:text-neura-hi">
            <Paperclip size={14} />
          </button>
          <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.csv,.png,.jpg,.jpeg" onChange={handleFiles} className="hidden" />
          <button
            onClick={() => setWeb(v => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${web ? 'border-neura-accent/30 bg-neura-accent/10 text-neura-accent' : 'border-neura-border bg-neura-surface text-neura-muted'}`}
          >
            <Globe size={13} /> Web
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded-full border border-neura-border bg-neura-surface text-neura-muted hover:text-neura-hi">
            <SlidersHorizontal size={13} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {streaming ? (
            <button onClick={onStop} className="flex h-9 w-9 items-center justify-center rounded-full bg-neura-hi text-neura-bg">
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-neura-accent text-white disabled:opacity-40 hover:bg-neura-accentHover transition-colors"
            >
              <ArrowUp size={16} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

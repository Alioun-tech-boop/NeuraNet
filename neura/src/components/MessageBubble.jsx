import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); };
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-neura-border bg-[#0B0E13]">
      <div className="flex items-center justify-between border-b border-neura-border px-3 py-1.5">
        <span className="text-[11px] font-mono text-neura-muted">{lang || 'code'}</span>
        <button onClick={copy} className="text-neura-muted hover:text-neura-hi">{copied ? <Check size={12} /> : <Copy size={12} />}</button>
      </div>
      <pre className="overflow-auto p-3 text-[13px] leading-relaxed text-neura-hi"><code>{code}</code></pre>
    </div>
  );
}

function renderMarkdown(text) {
  if (!text) return null;
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts.map((part, i) => {
    if (part.startsWith('```')) {
      const inner = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
      const lang = part.match(/^```(\w*)/)?.[1] || '';
      return <CodeBlock key={i} code={inner.trim()} lang={lang} />;
    }
    // inline code, bold, links
    const html = part
      .replace(/`([^`]+)`/g, '<code class="rounded bg-white/10 px-1 py-0.5 font-mono text-[13px]">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-neura-accent hover:underline">$1</a>');
    return <span key={i} dangerouslySetInnerHTML={{ __html: html.replace(/\n/g, '<br/>') }} />;
  });
}

export function UserBubble({ text }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <div className="max-w-[78%] rounded-[18px] bg-white px-4 py-2.5 text-[14px] leading-relaxed text-neura-bg shadow-sm">
        {text}
      </div>
    </motion.div>
  );
}

export function AssistantBubble({ text, streaming, sources }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="max-w-[760px]">
      <div className="prose prose-invert max-w-none text-[14.5px] leading-relaxed text-neura-hi">
        {renderMarkdown(text)}
        {streaming && <span className="inline-block h-3 w-1.5 animate-pulse bg-neura-accent ml-0.5 align-middle" />}
      </div>
      {sources?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {sources.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="rounded-full border border-neura-border bg-neura-panel px-2.5 py-1 text-[11px] text-neura-sub hover:text-neura-hi">
              [{i+1}] {s.title?.slice(0, 48) || s.url}
            </a>
          ))}
        </div>
      )}
    </motion.div>
  );
}

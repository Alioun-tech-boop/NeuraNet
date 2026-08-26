import { useState, useEffect } from 'react';

const SAMPLES = {
  'auth.service.js': `import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function createToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// TODO: add refresh token rotation
`,
  'Button.jsx': `export default function Button({ children, ...props }) {
  return (
    <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold" {...props}>
      {children}
    </button>
  );
}`,
  'default': `// Select a file from the explorer
// Neura Code Mode — powered by your selected model, guided by NeuraNet experience
`,
};

export default function EditorPane({ file, onChange, dirty, onDirty }) {
  const initial = SAMPLES[file] ?? SAMPLES.default;
  const [value, setValue] = useState(initial);

  useEffect(() => { setValue(SAMPLES[file] ?? SAMPLES.default); }, [file]);

  function handleChange(v) {
    setValue(v);
    onDirty?.(v !== initial);
    onChange?.(v);
  }

  return (
    <div className="flex h-full flex-col bg-[#0B0E13]">
      <div className="flex items-center gap-2 border-b border-neura-border bg-neura-panel px-3 py-1.5">
        <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-neura-sub">{file || 'untitled'}</span>
        {dirty && <span className="h-2 w-2 rounded-full bg-amber-400" />}
        <span className="ml-auto font-mono text-[11px] text-neura-muted">{value.split('\n').length} lines</span>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="select-none border-r border-neura-border bg-neura-panel px-2 py-3 text-right font-mono text-[12px] leading-6 text-neura-muted">
          {value.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <textarea
          value={value}
          onChange={e => handleChange(e.target.value)}
          spellCheck={false}
          className="flex-1 resize-none bg-transparent p-3 font-mono text-[13px] leading-6 text-neura-hi focus:outline-none"
        />
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import FileTree from '../components/FileTree.jsx';
import EditorPane from '../components/EditorPane.jsx';
import AgentPanel from '../components/AgentPanel.jsx';
import TerminalPanel from '../components/TerminalPanel.jsx';
import DiffViewer from '../components/DiffViewer.jsx';
import { chat as neuraChat } from '../lib/neuraAdapter.js';

export default function CodeMode({ selectedModel, projectId, initialTask }) {
  const [file, setFile] = useState('auth.service.js');
  const [dirty, setDirty] = useState(false);
  const [agentMode, setAgentMode] = useState('EDIT');
  const [activity, setActivity] = useState([]);
  const [logs, setLogs] = useState([]);
  const [diff, setDiff] = useState(null);
  const [agentInput, setAgentInput] = useState(initialTask || '');
  const [running, setRunning] = useState(false);

  useEffect(() => { if (initialTask) setAgentInput(initialTask); }, [initialTask]);

  async function handleAgentRun() {
    if (!agentInput.trim() || running) return;
    const task = agentInput.trim();
    setAgentInput('');
    setRunning(true);
    setActivity([
      { label: 'Inspecting repository', done: false },
      { label: 'Searching authentication module', done: false },
      { label: 'NeuraNet: retrieving coding experience', done: false },
      { label: 'Editing auth.service.js', done: false },
      { label: 'Running tests', done: false },
      { label: 'Verifying result', done: false },
    ]);
    setLogs([]);
    setDiff(null);

    // Simulate stepwise progress (real NeuraNet retrieval happens inside neuraChat)
    const steps = [0, 1, 2, 3, 4, 5];
    for (let i = 0; i < steps.length; i++) {
      // On step 2, actually call NeuraNet to get coding experience
      if (i === 2) {
        try {
          const res = await neuraChat({ message: task, model: selectedModel, projectId });
          setActivity(a => a.map((x, j) => j === i ? { ...x, done: true, detail: res.experience?.found ? `strategy ${res.experience.strategyPath}` : 'new strategy' } : x));
        } catch { setActivity(a => a.map((x, j) => j === i ? { ...x, done: true } : x)); }
      } else {
        await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
        setActivity(a => a.map((x, j) => j === i ? { ...x, done: true } : x));
      }
      if (i === 3) {
        setDiff({
          file: 'src/api/auth.service.js',
          before: `export async function hashPassword(pw) {\n  return bcrypt.hash(pw, 10);\n}`,
          after: `export async function hashPassword(pw) {\n  return bcrypt.hash(pw, 12);\n}\n\nexport async function rotateRefreshToken(oldToken) {\n  // Neura-guided: verify → rotate → persist\n  const payload = jwt.verify(oldToken, process.env.REFRESH_SECRET);\n  return createToken(payload);\n}`,
        });
      }
      if (i === 4) setLogs([{ text: '✔ 3 tests passed (auth)', ok: true }, { text: '✔ build succeeded', ok: true }]);
    }
    setRunning(false);
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col bg-neura-bg">
      {/* Code top bar */}
      <div className="flex h-9 items-center gap-2 border-b border-neura-border bg-neura-surface px-3">
        <div className="flex items-center gap-1 rounded-full bg-neura-panel p-1">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neura-bg">Code</span>
          <span className="px-2.5 py-1 text-[11px] text-neura-muted">Chat</span>
        </div>
        <span className="ml-2 font-mono text-[11px] text-neura-muted">project: {projectId || 'neuranet'}</span>
        <span className="ml-auto text-[11px] text-neura-muted">Model selected by you · {selectedModel?.name || selectedModel?.id}</span>
        <button onClick={handleAgentRun} disabled={running} className="rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold text-neura-bg disabled:opacity-40">
          {running ? 'Running…' : 'Run'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[220px] shrink-0 border-r border-neura-border">
          <FileTree selected={file} onSelect={setFile} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-neura-border bg-neura-panel px-2">
            <span className="rounded-t-lg bg-neura-bg px-3 py-1.5 font-mono text-[12px] text-neura-hi border border-neura-border border-b-transparent">{file}</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <EditorPane file={file} dirty={dirty} onDirty={setDirty} />
          </div>
        </div>
        <div className="w-[340px] shrink-0 border-l border-neura-border">
          <AgentPanel mode={agentMode} onModeChange={setAgentMode} activity={activity} />
          <div className="border-t border-neura-border p-3">
            <div className="flex gap-2">
              <input
                value={agentInput} onChange={e => setAgentInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAgentRun()}
                placeholder="Add authentication to this API…"
                className="flex-1 rounded-xl border border-neura-border bg-neura-bg px-3 py-2 text-[13px] placeholder:text-neura-muted focus:border-neura-accent/40 focus:outline-none"
              />
              <button onClick={handleAgentRun} disabled={running} className="rounded-xl bg-neura-accent px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-40">Send</button>
            </div>
            <div className="mt-2 text-[11px] text-neura-muted">Agent sees concise activity only — no chain-of-thought.</div>
          </div>
        </div>
      </div>

      <div className="h-[180px] shrink-0">
        <TerminalPanel logs={logs} />
      </div>

      {diff && (
        <div className="border-t border-neura-border bg-neura-panel p-4">
          <DiffViewer diff={diff} onAccept={() => setDiff(null)} onReject={() => setDiff(null)} />
        </div>
      )}
    </div>
  );
}

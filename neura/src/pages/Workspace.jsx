import { useEffect, useRef, useState } from 'react';
import Composer from '../components/Composer.jsx';
import { UserBubble, AssistantBubble } from '../components/MessageBubble.jsx';
import ExperienceIndicator from '../components/ExperienceIndicator.jsx';
import ExperiencePanel from '../components/ExperiencePanel.jsx';
import { chat as neuraChat } from '../lib/neuraAdapter.js';

export default function Workspace({ conversation, onUpdateConversation, selectedModel, projectId, pendingMessage, onClearPending, onBuildInCode }) {
  const [streaming, setStreaming] = useState(false);
  const [showExp, setShowExp] = useState(false);
  const [lastExperience, setLastExperience] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [conversation?.messages]);

  async function executeTask(text, { addUserMessage = true } = {}) {
    const assistantId = `m_${Date.now() + 1}_a`;
    if (addUserMessage) {
      const userMsg = { id: `m_${Date.now()}`, role: 'user', content: text, createdAt: new Date().toISOString() };
      onUpdateConversation(prev => ({
        ...prev,
        messages: [...(prev.messages || []), userMsg, { id: assistantId, role: 'assistant', content: '', streaming: true, experience: null }],
      }));
    } else {
      onUpdateConversation(prev => ({
        ...prev,
        messages: [...(prev.messages || []), { id: assistantId, role: 'assistant', content: '', streaming: true, experience: null }],
      }));
    }
    setStreaming(true);
    setShowExp(false);
    try {
      const res = await neuraChat({ message: text, model: selectedModel, conversationId: conversation.id, projectId });
      onUpdateConversation(prev => {
        const msgs = [...prev.messages];
        const idx = msgs.findIndex(m => m.id === assistantId);
        const final = { id: assistantId, role: 'assistant', content: res.reply, streaming: false, experience: res.experience, sources: res.sources, evaluation: res.evaluation, model: res.model };
        if (idx !== -1) msgs[idx] = final; else msgs.push(final);
        return { ...prev, messages: msgs, title: prev.title === 'Untitled' ? text.slice(0, 48) : prev.title };
      });
      setLastExperience(res.experience);
    } catch (e) {
      const msg = e.status === 429 ? 'Rate limited — try again shortly.' : e.status === 401 ? 'Invalid API key — check Settings.' : e.message || 'NeuraNet experience temporarily unavailable';
      onUpdateConversation(prev => {
        const msgs = [...prev.messages];
        const idx = msgs.findIndex(m => m.id === assistantId);
        const errMsg = { id: assistantId, role: 'assistant', content: msg, streaming: false, error: true };
        if (idx !== -1) msgs[idx] = errMsg; else msgs.push(errMsg);
        return { ...prev, messages: msgs };
      });
    } finally {
      setStreaming(false);
    }
  }

  async function handleSend({ text }) {
    return executeTask(text, { addUserMessage: true });
  }

  // Auto-trigger for Home → Workspace handoff (first message already in conversation)
  useEffect(() => {
    if (pendingMessage && conversation.messages?.length === 1 && conversation.messages[0].role === 'user' && conversation.messages[0].content === pendingMessage) {
      const text = pendingMessage;
      onClearPending?.();
      const t = setTimeout(() => executeTask(text, { addUserMessage: false }), 150);
      return () => clearTimeout(t);
    }
  }, [pendingMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStop() {
    setStreaming(false);
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div ref={listRef} className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-[820px] space-y-6">
          {(!conversation.messages || conversation.messages.length === 0) && (
            <div className="py-10 text-center">
              <div className="mx-auto max-w-md rounded-2xl border border-dashed border-neura-border bg-neura-panel p-6">
                <div className="text-[13px] font-medium text-neura-hi">Start the conversation</div>
                <div className="mt-1 text-[12.5px] text-neura-muted">Neura will remember how you solve this — and reuse it next time.</div>
              </div>
            </div>
          )}
          {(conversation.messages || []).map(m => (
            <div key={m.id} className="space-y-3">
              {m.role === 'user' ? (
                <UserBubble text={m.content} />
              ) : (
                <>
                  <AssistantBubble text={m.content} streaming={m.streaming} sources={m.sources} />
                  {m.experience && (
                    <ExperienceIndicator experience={m.experience} onExpand={() => setShowExp(v => !v)} />
                  )}
                  {m.role === 'assistant' && !m.streaming && !m.error && (
                    <button onClick={() => onBuildInCode?.(conversation.messages.find(x => x.role === 'user')?.content || m.content.slice(0, 80))} className="inline-flex items-center gap-1.5 rounded-full border border-neura-border bg-neura-panel px-3 py-1.5 text-[12px] font-medium text-neura-accent hover:bg-neura-accent/10">
                      Build this in Code →
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          {showExp && lastExperience && (
            <ExperiencePanel experience={lastExperience} open={showExp} onClose={() => setShowExp(false)} />
          )}
        </div>
      </div>

      <div className="border-t border-neura-border bg-neura-bg px-6 py-4">
        <div className="mx-auto max-w-[820px]">
          <Composer onSend={handleSend} onStop={handleStop} streaming={streaming} selectedModel={selectedModel} projectId={projectId} />
          <div className="mt-2 text-center text-[11px] text-neura-muted">Neura can make mistakes. Verify important results.</div>
        </div>
      </div>
    </div>
  );
}

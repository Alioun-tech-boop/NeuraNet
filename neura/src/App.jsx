import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import Home from './pages/Home.jsx';
import Workspace from './pages/Workspace.jsx';
import ExperiencePage from './pages/ExperiencePage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ModelCompare from './pages/ModelCompare.jsx';
import Settings from './pages/Settings.jsx';
import StrategyDetail from './components/StrategyDetail.jsx';
import ArchitectureView from './components/ArchitectureView.jsx';
import SystemStatus from './components/SystemStatus.jsx';
import NeuraDemoMode from './components/NeuraDemoMode.jsx';
import { loadConversations, saveConversations, loadProjects, saveProjects, loadSelectedModel, saveSelectedModel, newConversationId } from './lib/storage.js';

const DEFAULT_MODEL = { provider: 'groq', id: 'allam-2-7b', name: 'Allam 2 7B' };

export default function App() {
  const [view, setView] = useState('home');
  const [conversations, setConversations] = useState(() => loadConversations());
  const [projects, setProjects] = useState(() => loadProjects());
  const [selectedModel, setSelectedModel] = useState(() => loadSelectedModel() || DEFAULT_MODEL);
  const [activeId, setActiveId] = useState(null);
  const [strategyDetail, setStrategyDetail] = useState(null);
  const [showArch, setShowArch] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => { saveConversations(conversations); }, [conversations]);
  useEffect(() => { saveProjects(projects); }, [projects]);
  useEffect(() => { saveSelectedModel(selectedModel); }, [selectedModel]);

  // hash routing for deep links
  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace('#/', '');
      if (['home','chat','projects','experiences','compare','settings','arch'].includes(h)) setView(h);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function navigate(id, param) {
    if (id === 'chat' && param) { setActiveId(param); setView('chat'); location.hash = '#/chat'; }
    else if (id === 'home') { setView('home'); location.hash = '#/home'; }
    else { setView(id); location.hash = `#/${id}`; }
  }

  function handleNewChat() {
    const conv = { id: newConversationId(), title: 'Untitled', messages: [], createdAt: new Date().toISOString(), projectId: null };
    setConversations(prev => [conv, ...prev]);
    setActiveId(conv.id);
    setView('chat');
    location.hash = '#/chat';
  }

  const [pendingMessage, setPendingMessage] = useState(null);

  function handleSendFromHome({ text }) {
    const conv = {
      id: newConversationId(),
      title: text.slice(0, 48),
      messages: [{ id: `m_${Date.now()}`, role: 'user', content: text, createdAt: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
      projectId: null,
    };
    setConversations(prev => [conv, ...prev]);
    setActiveId(conv.id);
    setPendingMessage(text);
    setView('chat');
    location.hash = '#/chat';
  }

  function handleUpdateConversation(updater) {
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === activeId);
      if (idx === -1) return prev;
      const current = prev[idx];
      const next = typeof updater === 'function' ? updater(current) : updater;
      // updater may be object with same id
      const resolved = next.id ? next : { ...current, ...next };
      const copy = [...prev];
      copy[idx] = resolved;
      return copy;
    });
  }

  function handleCreateProject({ name }) {
    const p = { id: `p_${Date.now()}`, name, color: '#6C7CFF', conversations: [] };
    setProjects(prev => [...prev, p]);
  }

  const activeConversation = conversations.find(c => c.id === activeId) || null;

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector('input[placeholder*="Search"]')?.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); handleNewChat(); }
      if ((e.metaKey || e.ctrlKey) && e.key === ',') { e.preventDefault(); navigate('settings'); }
      if (e.key === 'Escape') setShowArch(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [activeId]);

  return (
    <div className="flex h-screen overflow-hidden bg-neura-bg">
      <Sidebar
        view={view}
        onNavigate={navigate}
        conversations={conversations}
        activeId={activeId}
        onNewChat={handleNewChat}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar model={selectedModel} onModelChange={setSelectedModel} onDemo={() => setDemoOpen(true)} />

        <main className="flex-1 overflow-auto">
          {view === 'home' && (
            <Home onSend={handleSendFromHome} selectedModel={selectedModel} projectId={null} />
          )}

          {view === 'chat' && (
            activeConversation ? (
              <Workspace
                key={activeId}
                conversation={activeConversation}
                onUpdateConversation={handleUpdateConversation}
                selectedModel={selectedModel}
                projectId={activeConversation.projectId}
                pendingMessage={pendingMessage}
                onClearPending={() => setPendingMessage(null)}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-8">
                <div className="text-center">
                  <div className="text-[14px] font-medium">No conversation selected</div>
                  <button onClick={handleNewChat} className="mt-3 rounded-xl bg-white px-4 py-2 text-[13px] font-semibold text-neura-bg">Start a new chat</button>
                </div>
              </div>
            )
          )}

          {view === 'experiences' && !strategyDetail && (
            <ExperiencePage onOpenStrategy={setStrategyDetail} />
          )}
          {view === 'experiences' && strategyDetail && (
            <StrategyDetail strategy={strategyDetail} onBack={() => setStrategyDetail(null)} />
          )}

          {view === 'projects' && (
            <ProjectsPage projects={projects} onCreateProject={handleCreateProject} onOpenProject={(id) => { setView('chat'); /* filter conversations by project */ }} onSelectConversation={(id) => { setActiveId(id); setView('chat'); }} />
          )}

          {view === 'compare' && <ModelCompare />}

          {view === 'settings' && <Settings />}

          {showArch && (
            <div className="p-8">
              <ArchitectureView />
            </div>
          )}
        </main>

        {/* Floating architecture toggle for demos */}
        <button
          onClick={() => setShowArch(v => !v)}
          className="fixed bottom-4 right-4 rounded-full border border-neura-border bg-neura-panel px-3 py-1.5 text-[11px] font-medium text-neura-muted hover:text-neura-hi"
        >
          {showArch ? 'Hide architecture' : 'Show architecture'}
        </button>

        {demoOpen && (
          <NeuraDemoMode
            onClose={() => setDemoOpen(false)}
            onDemoMessage={({ role, content, experience, sources }) => {
              // Inject demo messages into current or new conversation
              let targetId = activeId;
              if (!targetId || !conversations.find(c => c.id === targetId)) {
                const conv = { id: newConversationId(), title: 'Demo: Ghana regulator', messages: [], createdAt: new Date().toISOString(), projectId: null };
                setConversations(prev => [conv, ...prev]);
                targetId = conv.id;
                setActiveId(targetId);
                setView('chat');
              }
              setConversations(prev => prev.map(c => c.id === targetId ? {
                ...c,
                messages: [...c.messages, { id: `m_${Date.now()}_${Math.random().toString(36).slice(2,4)}`, role, content, experience, sources, createdAt: new Date().toISOString() }],
                title: c.title === 'Untitled' && role === 'user' ? content.slice(0, 48) : c.title,
              } : c));
            }}
          />
        )}
      </div>
    </div>
  );
}

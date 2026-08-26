import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import Overview from './pages/Overview.jsx';
import LiveExecution from './pages/LiveExecution.jsx';
import BatchAnalysis from './pages/BatchAnalysis.jsx';
import ExperienceGraphPage from './pages/ExperienceGraphPage.jsx';
import Strategies from './pages/Strategies.jsx';
import Benchmarks from './pages/Benchmarks.jsx';
import SystemPage from './pages/SystemPage.jsx';

const VIEWS = ['overview', 'live', 'batch', 'graph', 'strategies', 'benchmarks', 'system', 'api', 'settings'];

export default function App() {
  const [view, setView] = useState('overview');
  const [demoMode, setDemoMode] = useState(false);
  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('allam-2-7b');

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace('#/', '');
      if (h && VIEWS.includes(h)) setView(h);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function navigate(v) {
    location.hash = `/${v}`;
    setView(v);
  }

  if (demoMode) {
    return (
      <div className="min-h-screen bg-ink-900">
        <div className="flex items-center justify-between border-b border-line px-8 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sem">YC Demo Mode</span>
          <span className="mono-num text-[12px] text-low">NEURANET · procedural experience infrastructure</span>
        </div>
        <LiveExecution
          demoMode
          onExitDemo={() => setDemoMode(false)}
          onShowBenchmarks={() => { setDemoMode(false); navigate('benchmarks'); }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Sidebar view={view} onNavigate={navigate} onDemoMode={() => setDemoMode(true)} />
      <div className="pl-[228px]">
        <TopBar
          provider={provider}
          model={model}
          onProviderChange={(p) => {
            setProvider(p);
            const first = { groq: 'allam-2-7b', openrouter: 'meta-llama/llama-3.3-70b-instruct' }[p];
            setModel(first);
          }}
          onModelChange={setModel}
        />
        <main>
          {view === 'overview' && <Overview onNavigate={navigate} />}
          {view === 'live' && <LiveExecution onExitDemo={() => setDemoMode(false)} />}
          {view === 'batch' && <BatchAnalysis />}
          {view === 'graph' && <ExperienceGraphPage />}
          {view === 'strategies' && <Strategies />}
          {view === 'benchmarks' && <Benchmarks />}
          {['system', 'api', 'settings'].includes(view) && <SystemPage tab={view} />}
        </main>
      </div>
    </div>
  );
}

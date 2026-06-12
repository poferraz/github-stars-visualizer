import React, { useState } from 'react';
import WindowFrame from './components/WindowFrame';
import DesktopIcon from './components/DesktopIcon';
import SettingsWindow from './components/SettingsWindow';
import GraphWindow from './components/GraphWindow';
import DetailWindow from './components/DetailWindow';
import HelpWindow from './components/HelpWindow';
import Taskbar from './components/Taskbar';
import { audio } from './utils/audio';
import { buildGraphData } from './utils/graphBuilder';
import { storage } from './services/storage';
import { useWindowManager } from './os/useWindowManager';
import { useIndexing } from './state/useIndexing';
import IndexerWindow from './components/IndexerWindow';

// Window chrome definitions: geometry defaults; live state (position, size,
// stacking, visibility) is owned by useWindowManager and persisted per user
const WINDOW_DEFS = {
  help: { title: 'Help Manual - READ.ME', icon: '❓', defaultOpen: true, width: 440, height: 380, offsetX: -30, offsetY: -30 },
  settings: { title: 'API Configuration & Auth Settings', icon: '⚙️', defaultOpen: true, width: 420, height: 480, offsetX: 30, offsetY: 30 },
  graph: { title: 'Stars Map Explorer v1.0', icon: '🕸️', defaultOpen: false, width: 640, height: 480, defaultMaximized: true },
  detail: { title: 'Properties - Explorer View', icon: '🔍', defaultOpen: false, width: 320, height: 420, offsetX: 160, offsetY: 40 }
};

const DEFAULT_SETTINGS = {
  username: '',
  githubToken: '',
  maxStars: 50,
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-2.5-flash',
  customUrl: ''
};

export default function App() {
  // 1. Desktop & CRT State
  const [crtEnabled, setCrtEnabled] = useState(true);
  const [isShutdown, setIsShutdown] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(null);

  // 2. Settings State — merged over defaults so new fields gain sane values
  // when older persisted shapes are loaded
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...storage.read('settings', {}, (v) => v && typeof v === 'object' && !Array.isArray(v))
  }));

  // 3. Cache & Computed Data
  const [repositories, setRepositories] = useState(() =>
    storage.read('repos', [], Array.isArray)
  );
  const [aiAnalysis, setAiAnalysis] = useState(() =>
    storage.read('ai', {}, (v) => v && typeof v === 'object' && !Array.isArray(v))
  );
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [minStars, setMinStars] = useState(0);

  const currentGraphData = React.useMemo(() => {
    return buildGraphData(repositories, aiAnalysis, {
      languages: selectedLanguages,
      minStars,
      rootName: settings.username || 'STARS'
    });
  }, [repositories, aiAnalysis, selectedLanguages, minStars, settings.username]);

  const allLanguages = React.useMemo(() => {
    const langs = new Set();
    repositories.forEach(repo => {
      if (repo.language) langs.add(repo.language);
    });
    return Array.from(langs).sort();
  }, [repositories]);

  const maxStarsLimit = React.useMemo(() => {
    if (repositories.length === 0) return 100;
    return Math.max(...repositories.map(r => r.stargazers_count || 0), 100);
  }, [repositories]);
  const [selectedNode, setSelectedNode] = useState(null);

  // 4. Window manager: position/size/stacking/visibility in one reducer
  const wm = useWindowManager(WINDOW_DEFS);
  const { windows } = wm;

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    storage.write('settings', newSettings);

    // Clear data cache if username changed to force re-fetch
    if (newSettings.username !== settings.username) {
      storage.remove('repos');
      storage.remove('ai');
      setRepositories([]);
      setAiAnalysis({});
      setSelectedLanguages([]);
      setMinStars(0);
    }

    wm.close('settings');
  };

  const handleResetAll = () => {
    // Scoped reset: clears only gitstars-owned keys, not the whole origin
    storage.resetApp();
    setSettings({ ...DEFAULT_SETTINGS });
    setRepositories([]);
    setAiAnalysis({});
    setSelectedLanguages([]);
    setMinStars(0);
    setSelectedNode(null);
    audio.playError();

    wm.close('graph');
    wm.close('detail');
    wm.open('settings');
  };

  // 5. Indexer pipeline (fetch -> AI -> cache) and its modal state
  const indexer = useIndexing({
    settings,
    onComplete: (fetchedRepos, analysis) => {
      setRepositories(fetchedRepos);
      setAiAnalysis(analysis);
      wm.open('graph');
    }
  });

  const handleStartIndexing = () => {
    if (!settings.username) {
      alert('Error: Please configure your GitHub Username in Settings first!');
      wm.open('settings');
      return;
    }
    setSelectedLanguages([]);
    setMinStars(0);
    indexer.startIndexing();
  };

  const handleSelectNode = (node) => {
    setSelectedNode(node);
    // Auto-focus the properties window on selection; afterwards it stacks
    // normally (no forced always-on-top), so it can't permanently occlude
    // the graph it describes
    wm.open('detail');
  };

  return (
    <div className={`crt-flicker`} style={{ height: '100%' }}>
      {/* Optional screen CRT filter */}
      {crtEnabled && (
        <>
          <div className="crt-overlay" />
          <div className="crt-vignette" />
        </>
      )}

      {/* Shutdown screen */}
      {isShutdown ? (
        <div className="shutdown-screen">
          <div className="shutdown-msg">It is now safe to turn off your computer.</div>
          <div className="shutdown-desc">
            Or, click this button to restart the explorer environment:
          </div>
          <button 
            className="win95-btn" 
            style={{ marginTop: '20px', padding: '6px 12px' }} 
            onClick={() => {
              audio.playSuccess();
              setIsShutdown(false);
            }}
          >
            Restart Explorer
          </button>
        </div>
      ) : (
        <>
          {/* Main Desktop Space */}
          <div className="desktop" onClick={() => setSelectedIcon(null)}>
            
            {/* Desktop Icons */}
            <DesktopIcon
              title="My Computer"
              icon="💻"
              isSelected={selectedIcon === 'my_computer'}
              onClick={() => setSelectedIcon('my_computer')}
              onDoubleClick={() => wm.toggle('help')}
            />
            <DesktopIcon
              title="API Settings"
              icon="⚙️"
              isSelected={selectedIcon === 'settings'}
              onClick={() => setSelectedIcon('settings')}
              onDoubleClick={() => wm.toggle('settings')}
            />
            <DesktopIcon
              title="Stars Map"
              icon="🕸️"
              isSelected={selectedIcon === 'graph'}
              onClick={() => setSelectedIcon('graph')}
              onDoubleClick={() => {
                if (repositories.length > 0) {
                  wm.toggle('graph');
                } else {
                  handleStartIndexing();
                }
              }}
            />
            <DesktopIcon
              title="Help Manual"
              icon="❓"
              isSelected={selectedIcon === 'help'}
              onClick={() => setSelectedIcon('help')}
              onDoubleClick={() => wm.toggle('help')}
            />

            {/* Draggable Help Window */}
            <WindowFrame
              win={windows.help}
              isActive={windows.help.isActive}
              zIndex={windows.help.zIndex}
              onClose={() => wm.close('help')}
              onFocus={() => wm.focus('help')}
              onMove={(x, y) => wm.move('help', x, y)}
              onResize={(w, h) => wm.resize('help', w, h)}
              onToggleMaximize={() => wm.toggleMaximize('help')}
            >
              <HelpWindow onClose={() => wm.close('help')} />
            </WindowFrame>

            {/* Draggable Settings Window */}
            <WindowFrame
              win={windows.settings}
              isActive={windows.settings.isActive}
              zIndex={windows.settings.zIndex}
              onClose={() => wm.close('settings')}
              onFocus={() => wm.focus('settings')}
              onMove={(x, y) => wm.move('settings', x, y)}
              onResize={(w, h) => wm.resize('settings', w, h)}
              onToggleMaximize={() => wm.toggleMaximize('settings')}
            >
              <SettingsWindow 
                settings={settings} 
                onSave={handleSaveSettings} 
                onClose={() => wm.close('settings')} 
              />
            </WindowFrame>

            {/* Draggable Indexer/Installer Window (Progress Panel) */}
            {indexer.isIndexing && (
              <IndexerWindow
                progress={indexer.progress}
                logs={indexer.logs}
                onClose={indexer.closeIndexer}
              />
            )}

            {/* Draggable Mind Map Graph Window */}
            <WindowFrame
              win={windows.graph}
              isActive={windows.graph.isActive}
              zIndex={windows.graph.zIndex}
              onClose={() => wm.close('graph')}
              onFocus={() => wm.focus('graph')}
              onMove={(x, y) => wm.move('graph', x, y)}
              onResize={(w, h) => wm.resize('graph', w, h)}
              onToggleMaximize={() => wm.toggleMaximize('graph')}
            >
              <GraphWindow
                graphData={currentGraphData}
                onSelectNode={handleSelectNode}
                selectedNodeId={selectedNode?.id}
                selectedLanguages={selectedLanguages}
                setSelectedLanguages={setSelectedLanguages}
                minStars={minStars}
                setMinStars={setMinStars}
                allLanguages={allLanguages}
                maxStarsLimit={maxStarsLimit}
                onResync={handleStartIndexing}
              />
            </WindowFrame>

            {/* Draggable Properties Window */}
            <WindowFrame
              win={windows.detail}
              isActive={windows.detail.isActive}
              zIndex={windows.detail.zIndex}
              onClose={() => wm.close('detail')}
              onFocus={() => wm.focus('detail')}
              onMove={(x, y) => wm.move('detail', x, y)}
              onResize={(w, h) => wm.resize('detail', w, h)}
              onToggleMaximize={() => wm.toggleMaximize('detail')}
            >
              <DetailWindow 
                node={selectedNode} 
                allNodes={currentGraphData.nodes}
                allLinks={currentGraphData.links}
                onSelectNode={handleSelectNode}
                onClose={() => wm.close('detail')}
              />
            </WindowFrame>

          </div>

          {/* Bottom Taskbar */}
          <Taskbar
            windows={windows}
            crtEnabled={crtEnabled}
            onToggleWindow={wm.toggle}
            onFocusWindow={wm.focus}
            onToggleCrt={() => {
              audio.playClick();
              setCrtEnabled(!crtEnabled);
            }}
            onShutdown={() => {
              audio.playError();
              setIsShutdown(true);
            }}
            onResetAll={handleResetAll}
          />
        </>
      )}
    </div>
  );
}

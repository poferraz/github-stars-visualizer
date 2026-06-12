import React, { useState } from 'react';
import WindowFrame from './components/WindowFrame';
import DesktopIcon from './components/DesktopIcon';
import SettingsWindow from './components/SettingsWindow';
import GraphWindow from './components/GraphWindow';
import DetailWindow from './components/DetailWindow';
import HelpWindow from './components/HelpWindow';
import Taskbar from './components/Taskbar';
import { audio } from './utils/audio';
import { fetchStarredRepos } from './services/github';
import { analyzeStars } from './services/aiAnalysis';
import { buildGraphData } from './utils/graphBuilder';
import { storage } from './services/storage';
import { useWindowManager } from './os/useWindowManager';

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
  const [searchQuery, setSearchQuery] = useState('');

  // 4. Indexer / Installer State
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexingLogs, setIndexingLogs] = useState([]);
  const [installProgress, setInstallProgress] = useState(0);

  // 5. Window manager: position/size/stacking/visibility in one reducer
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

  // Coordinated stars fetching & AI mapping
  const handleStartIndexing = async () => {
    if (!settings.username) {
      alert('Error: Please configure your GitHub Username in Settings first!');
      wm.open('settings');
      return;
    }

    setSelectedLanguages([]);
    setMinStars(0);
    setIsIndexing(true);
    setIndexingLogs([]);
    setInstallProgress(5);
    audio.playClick();

    const addLog = (text, type = 'info') => {
      setIndexingLogs(prev => [...prev, { text, type, id: Date.now() + Math.random() }]);
    };

    try {
      // Step 1: Play mechanical floppy seek sound
      addLog('💾 INITIALIZING FLOPPY SEEKER...', 'info');
      await audio.playFloppySeek(1200);
      setInstallProgress(15);

      // Step 2: Fetch Stars from GitHub
      addLog(`🕸️ CONNECTING TO GITHUB API FOR USER: ${settings.username}...`, 'info');
      const fetchedRepos = await fetchStarredRepos(
        settings.username,
        settings.githubToken,
        settings.maxStars
      );
      addLog(`✓ SUCCESSFULLY RETRIEVED ${fetchedRepos.length} STARRED REPOSITORIES.`, 'success');
      setInstallProgress(40);
      await audio.playFloppySeek(500);

      // Step 3: Run AI analysis
      if (settings.apiKey) {
        addLog(`🤖 CONNECTING TO AI ROUTER (${settings.provider.toUpperCase()})...`, 'info');
        addLog('⏳ EXECUTING GRAPH MAP COMPUTATION PROMPT. PLEASE STAND BY...', 'info');
        
        const { analysis, meta } = await analyzeStars({
          repositories: fetchedRepos,
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
          customUrl: settings.customUrl,
          onProgress: (text, type = 'info', progress = null) => {
            addLog(text, type);
            if (progress !== null) {
              setInstallProgress(progress);
            }
          }
        });

        // Honest reporting: a partial or failed AI run must not look like success
        if (meta.analyzed === 0) {
          addLog('❌ AI ANALYSIS FAILED FOR ALL BATCHES. MAP USES LANGUAGE GROUPS ONLY.', 'error');
        } else if (meta.failedBatches > 0 || meta.analyzed < meta.total) {
          addLog(`⚠️ PARTIAL AI MAP: ${meta.analyzed}/${meta.total} REPOS CATEGORIZED (${meta.failedBatches} BATCH(ES) FAILED). REST FALL BACK TO LANGUAGE GROUPS.`, 'warning');
        } else {
          addLog('✓ SEMANTIC CONNECTIONS FORGED BY AI ARCHIVIST.', 'success');
        }
        setInstallProgress(85);
        await audio.playFloppySeek(800);

        // Save cache (+ coverage metadata so future UI can show map provenance)
        storage.write('repos', fetchedRepos);
        storage.write('ai', analysis);
        storage.write('aiMeta', { ...meta, analyzedAt: Date.now() });

        setRepositories(fetchedRepos);
        setAiAnalysis(analysis);

        addLog('✓ GRAPH DATA GENERATED SUCCESSFULLY.', 'success');
      } else {
        // Fallback if no AI key configured
        addLog('⚠️ WARNING: NO AI API KEY PROVIDED. GENERATING DEFAULT GRAPH (NO SEMANTIC CONNECTIONS).', 'warning');
        storage.write('repos', fetchedRepos);
        storage.write('ai', {});
        
        setRepositories(fetchedRepos);
        setAiAnalysis({});
        addLog('✓ DEFAULT GRAPH DATA GENERATED.', 'success');
      }

      setInstallProgress(100);
      addLog('🎉 WORKSPACE READY. OPENING STAR EXPLORER GRAPH...', 'success');
      audio.playSuccess();

      // Delay slightly so user sees 100% completion before opening graph
      setTimeout(() => {
        setIsIndexing(false);
        wm.open('graph');
      }, 800);

    } catch (err) {
      console.error(err);
      addLog(`❌ SYSTEM ERROR: ${err.message}`, 'error');
      audio.playError();
      // Allow user to close error window
      setInstallProgress(-1);
    }
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
            {isIndexing && (
              <div 
                className="win95-window win95-raised" 
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '460px',
                  zIndex: 99999,
                  boxShadow: '10px 10px 30px rgba(0,0,0,0.6)'
                }}
              >
                <div className="win95-title-bar active">
                  <div className="win95-title-text">💾 Indexer Manager v1.0</div>
                  {installProgress === -1 && (
                    <button 
                      className="win95-btn win95-btn-close"
                      onClick={() => setIsIndexing(false)}
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontWeight: 'bold' }}>Scanning and Indexing GitHub Stars:</div>
                  
                  {/* Outer Recessed Progress Bar */}
                  <div 
                    className="win95-recessed" 
                    style={{ 
                      height: '24px', 
                      backgroundColor: '#e6e6e6', 
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${Math.max(0, installProgress)}%`, 
                        backgroundColor: '#000080', 
                        transition: 'width 0.2s ease-in-out' 
                      }} 
                    />
                    <div 
                      style={{ 
                        position: 'absolute', 
                        width: '100%', 
                        textAlign: 'center', 
                        fontWeight: 'bold', 
                        color: installProgress > 50 ? '#ffffff' : '#000000',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {installProgress === -1 ? 'INDEXING FAILED' : `${installProgress}%`}
                    </div>
                  </div>

                  {/* Installer Terminal Logs */}
                  <div 
                    className="win95-recessed terminal-view" 
                    style={{ height: '180px', display: 'flex', flexDirection: 'column-reverse' }}
                  >
                    <div>
                      {indexingLogs.map(log => (
                        <div 
                          key={log.id} 
                          className={`terminal-line ${
                            log.type === 'success' ? 'terminal-success' :
                            log.type === 'error' ? 'terminal-error' :
                            log.type === 'warning' ? 'terminal-warning' : 'terminal-info'
                          }`}
                        >
                          {log.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  {installProgress === -1 && (
                    <button 
                      type="button" 
                      className="win95-btn" 
                      style={{ alignSelf: 'flex-end', padding: '4px 12px' }}
                      onClick={() => {
                        audio.playClick();
                        setIsIndexing(false);
                      }}
                    >
                      Close Setup
                    </button>
                  )}
                </div>
              </div>
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
              <div className="layout-col" style={{ height: '100%' }}>
                {/* Floating search highlight box inside window header area */}
                <div className="layout-row align-center justify-between" style={{ paddingBottom: '6px', borderBottom: '1px solid #777' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <label htmlFor="search-stars" style={{ margin: 0 }}>🔍 Highlight Star:</label>
                    <input
                      id="search-stars"
                      type="text"
                      placeholder="Type name (e.g. react)"
                      style={{ width: '160px', height: '22px', fontSize: '12px' }}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button 
                        type="button"
                        className="win95-btn" 
                        style={{ height: '22px', padding: '0 4px', fontSize: '10px' }}
                        onClick={() => setSearchQuery('')}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <button 
                    type="button"
                    className="win95-btn"
                    onClick={() => {
                      audio.playClick();
                      handleStartIndexing();
                    }}
                  >
                    🔄 Re-Sync Stars
                  </button>
                </div>
                
                <div className="layout-flex win95-recessed" style={{ overflow: 'hidden' }}>
                  <GraphWindow 
                    graphData={currentGraphData} 
                    onSelectNode={handleSelectNode} 
                    selectedNodeId={selectedNode?.id}
                    searchQuery={searchQuery}
                    selectedLanguages={selectedLanguages}
                    setSelectedLanguages={setSelectedLanguages}
                    minStars={minStars}
                    setMinStars={setMinStars}
                    allLanguages={allLanguages}
                    maxStarsLimit={maxStarsLimit}
                  />
                </div>
              </div>
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

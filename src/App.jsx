import React, { useState, useEffect } from 'react';
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

export default function App() {
  // 1. Desktop & CRT State
  const [crtEnabled, setCrtEnabled] = useState(true);
  const [isShutdown, setIsShutdown] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(null);

  // 2. Settings State
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('gitstars_settings');
      return stored ? JSON.parse(stored) : {
        username: '',
        githubToken: '',
        maxStars: 50,
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-2.5-flash',
        customUrl: ''
      };
    } catch (e) {
      return { username: '', githubToken: '', maxStars: 50, provider: 'gemini', apiKey: '', model: 'gemini-2.5-flash', customUrl: '' };
    }
  });

  // 3. Cache & Computed Data
  const [repositories, setRepositories] = useState(() => {
    try {
      const stored = localStorage.getItem('gitstars_cached_repos');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [aiAnalysis, setAiAnalysis] = useState(() => {
    try {
      const stored = localStorage.getItem('gitstars_cached_ai');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [minStars, setMinStars] = useState(0);

  const currentGraphData = React.useMemo(() => {
    return buildGraphData(repositories, aiAnalysis, {
      languages: selectedLanguages,
      minStars
    });
  }, [repositories, aiAnalysis, selectedLanguages, minStars]);

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

  // Helper to dynamically calculate initial centered window positions
  const getInitialWindows = () => {
    const isClient = typeof window !== 'undefined';
    const w = isClient ? window.innerWidth : 1024;
    const h = isClient ? window.innerHeight : 768;

    return {
      help: { 
        id: 'help', 
        title: 'Help Manual - READ.ME', 
        isOpen: true, 
        isActive: false, 
        zIndex: 2, 
        icon: '❓',
        x: Math.max(10, Math.round((w - 440) / 2) - 30),
        y: Math.max(10, Math.round((h - 380) / 2) - 30),
        width: '440px',
        height: '380px'
      },
      settings: { 
        id: 'settings', 
        title: 'API Configuration & Auth Settings', 
        isOpen: true, 
        isActive: true, 
        zIndex: 3, 
        icon: '⚙️',
        x: Math.max(10, Math.round((w - 420) / 2) + 30),
        y: Math.max(10, Math.round((h - 480) / 2) + 30),
        width: '420px',
        height: '480px'
      },
      graph: { 
        id: 'graph', 
        title: 'Stars Map Explorer v1.0', 
        isOpen: false, 
        isActive: false, 
        zIndex: 1, 
        icon: '🕸️',
        x: Math.max(10, Math.round((w - 640) / 2)),
        y: Math.max(10, Math.round((h - 480) / 2)),
        width: '640px',
        height: '480px'
      },
      detail: { 
        id: 'detail', 
        title: 'Properties - Explorer View', 
        isOpen: false, 
        isActive: false, 
        zIndex: 1, 
        icon: '🔍',
        x: Math.max(10, Math.round((w - 320) / 2) + 160),
        y: Math.max(10, Math.round((h - 420) / 2) + 40),
        width: '320px',
        height: '420px'
      }
    };
  };

  // 5. Windows Management
  const [windows, setWindows] = useState(getInitialWindows());



  // Window focusing / Layer management
  const focusWindow = (id) => {
    setWindows(prev => {
      // Find highest active Z-index (excluding detail)
      const maxZ = Math.max(...Object.entries(prev).map(([winId, w]) => winId === 'detail' ? 0 : w.zIndex), 3);
      const updated = {};
      Object.entries(prev).forEach(([winId, win]) => {
        let newZ = win.zIndex;
        if (winId === id) {
          newZ = maxZ + 1;
        }
        updated[winId] = {
          ...win,
          isActive: winId === id,
          zIndex: newZ
        };
      });

      // If detail is open, ensure its zIndex is always the absolute highest (at least maxZ + 2)
      if (prev.detail.isOpen) {
        const currentHighestZ = Math.max(...Object.entries(updated).map(([winId, w]) => winId === 'detail' ? 0 : w.zIndex), 3);
        updated.detail.zIndex = currentHighestZ + 1;
        if (id === 'detail') {
          updated.detail.isActive = true;
        }
      }
      return updated;
    });
  };

  const toggleWindow = (id) => {
    setWindows(prev => {
      const win = prev[id];
      const nextOpen = !win.isOpen;
      
      if (nextOpen) {
        // Play disk read noise on open
        audio.playClick();
        
        // Find highest active Z-index (excluding detail)
        const maxZ = Math.max(...Object.entries(prev).map(([winId, w]) => winId === 'detail' ? 0 : w.zIndex), 3);
        const updated = {};
        Object.entries(prev).forEach(([winId, w]) => {
          updated[winId] = {
            ...w,
            isOpen: winId === id ? true : w.isOpen,
            isActive: winId === id,
            zIndex: winId === id ? maxZ + 1 : w.zIndex
          };
        });

        // Ensure detail is highest if open
        if (updated.detail.isOpen) {
          const currentHighestZ = Math.max(...Object.entries(updated).map(([winId, w]) => winId === 'detail' ? 0 : w.zIndex), 3);
          updated.detail.zIndex = currentHighestZ + 1;
        }

        return updated;
      } else {
        return {
          ...prev,
          [id]: { ...win, isOpen: false, isActive: false }
        };
      }
    });
  };

  const handleSaveSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('gitstars_settings', JSON.stringify(newSettings));
    
    // Clear data cache if username changed to force re-fetch
    if (newSettings.username !== settings.username) {
      localStorage.removeItem('gitstars_cached_repos');
      localStorage.removeItem('gitstars_cached_ai');
      setRepositories([]);
      setAiAnalysis({});
      setSelectedLanguages([]);
      setMinStars(0);
    }

    setWindows(prev => ({
      ...prev,
      settings: { ...prev.settings, isOpen: false, isActive: false }
    }));
  };

  const handleResetAll = () => {
    localStorage.clear();
    setSettings({
      username: '',
      githubToken: '',
      maxStars: 50,
      provider: 'gemini',
      apiKey: '',
      model: 'gemini-2.5-flash',
      customUrl: ''
    });
    setRepositories([]);
    setAiAnalysis({});
    setSelectedLanguages([]);
    setMinStars(0);
    setSelectedNode(null);
    audio.playError();
    
    setWindows(prev => ({
      ...prev,
      settings: { ...prev.settings, isOpen: true, isActive: true },
      graph: { ...prev.graph, isOpen: false },
      detail: { ...prev.detail, isOpen: false }
    }));
  };

  // Coordinated stars fetching & AI mapping
  const handleStartIndexing = async () => {
    if (!settings.username) {
      alert('Error: Please configure your GitHub Username in Settings first!');
      toggleWindow('settings');
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
        
        const analysis = await analyzeStars({
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

        addLog('✓ SEMANTIC CONNECTIONS FORGED BY AI ARCHIVIST.', 'success');
        setInstallProgress(85);
        await audio.playFloppySeek(800);

        // Save cache
        localStorage.setItem('gitstars_cached_repos', JSON.stringify(fetchedRepos));
        localStorage.setItem('gitstars_cached_ai', JSON.stringify(analysis));
        
        setRepositories(fetchedRepos);
        setAiAnalysis(analysis);
        
        addLog('✓ GRAPH DATA GENERATED SUCCESSFULLY.', 'success');
      } else {
        // Fallback if no AI key configured
        addLog('⚠️ WARNING: NO AI API KEY PROVIDED. GENERATING DEFAULT GRAPH (NO SEMANTIC CONNECTIONS).', 'warning');
        localStorage.setItem('gitstars_cached_repos', JSON.stringify(fetchedRepos));
        localStorage.setItem('gitstars_cached_ai', JSON.stringify({}));
        
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
        setWindows(prev => ({
          ...prev,
          graph: { ...prev.graph, isOpen: true, isActive: true, zIndex: 10 }
        }));
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
    setWindows(prev => {
      // Find highest active Z-index (excluding detail)
      const maxZ = Math.max(...Object.entries(prev).map(([winId, w]) => winId === 'detail' ? 0 : w.zIndex), 3);
      const updated = {};
      Object.entries(prev).forEach(([winId, w]) => {
        updated[winId] = {
          ...w,
          isOpen: winId === 'detail' ? true : w.isOpen,
          isActive: winId === 'detail',
          zIndex: winId === 'detail' ? maxZ + 1 : w.zIndex
        };
      });

      // Ensure detail is highest
      const currentHighestZ = Math.max(...Object.entries(updated).map(([winId, w]) => winId === 'detail' ? 0 : w.zIndex), 3);
      updated.detail.zIndex = currentHighestZ + 1;

      return updated;
    });
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
              onDoubleClick={() => toggleWindow('help')}
            />
            <DesktopIcon
              title="API Settings"
              icon="⚙️"
              isSelected={selectedIcon === 'settings'}
              onClick={() => setSelectedIcon('settings')}
              onDoubleClick={() => toggleWindow('settings')}
            />
            <DesktopIcon
              title="Stars Map"
              icon="🕸️"
              isSelected={selectedIcon === 'graph'}
              onClick={() => setSelectedIcon('graph')}
              onDoubleClick={() => {
                if (repositories.length > 0) {
                  toggleWindow('graph');
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
              onDoubleClick={() => toggleWindow('help')}
            />

            {/* Draggable Help Window */}
            <WindowFrame
              id="help"
              title={windows.help.title}
              isOpen={windows.help.isOpen}
              isActive={windows.help.isActive}
              zIndex={windows.help.zIndex}
              defaultX={windows.help.x}
              defaultY={windows.help.y}
              width={windows.help.width}
              height={windows.help.height}
              icon={windows.help.icon}
              onClose={() => toggleWindow('help')}
              onFocus={() => focusWindow('help')}
            >
              <HelpWindow onClose={() => toggleWindow('help')} />
            </WindowFrame>

            {/* Draggable Settings Window */}
            <WindowFrame
              id="settings"
              title={windows.settings.title}
              isOpen={windows.settings.isOpen}
              isActive={windows.settings.isActive}
              zIndex={windows.settings.zIndex}
              defaultX={windows.settings.x}
              defaultY={windows.settings.y}
              width={windows.settings.width}
              height={windows.settings.height}
              icon={windows.settings.icon}
              onClose={() => toggleWindow('settings')}
              onFocus={() => focusWindow('settings')}
            >
              <SettingsWindow 
                settings={settings} 
                onSave={handleSaveSettings} 
                onClose={() => toggleWindow('settings')} 
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
              id="graph"
              title={windows.graph.title}
              isOpen={windows.graph.isOpen}
              isActive={windows.graph.isActive}
              zIndex={windows.graph.zIndex}
              defaultX={windows.graph.x}
              defaultY={windows.graph.y}
              width={windows.graph.width}
              height={windows.graph.height}
              icon={windows.graph.icon}
              defaultMaximized={true}
              onClose={() => toggleWindow('graph')}
              onFocus={() => focusWindow('graph')}
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
              id="detail"
              title={windows.detail.title}
              isOpen={windows.detail.isOpen}
              isActive={windows.detail.isActive}
              zIndex={windows.detail.zIndex}
              defaultX={windows.detail.x}
              defaultY={windows.detail.y}
              width={windows.detail.width}
              height={windows.detail.height}
              icon={windows.detail.icon}
              onClose={() => toggleWindow('detail')}
              onFocus={() => focusWindow('detail')}
            >
              <DetailWindow 
                node={selectedNode} 
                allNodes={currentGraphData.nodes}
                allLinks={currentGraphData.links}
                onSelectNode={handleSelectNode}
                onClose={() => toggleWindow('detail')}
              />
            </WindowFrame>

          </div>

          {/* Bottom Taskbar */}
          <Taskbar
            windows={windows}
            crtEnabled={crtEnabled}
            onToggleWindow={toggleWindow}
            onFocusWindow={focusWindow}
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

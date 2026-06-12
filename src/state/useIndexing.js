import { useState, useCallback } from 'react';
import { fetchStarredRepos } from '../services/github';
import { analyzeStars } from '../services/aiAnalysis';
import { storage } from '../services/storage';
import { audio } from '../utils/audio';

// Orchestrates the index pipeline (GitHub fetch → AI analysis → cache) and
// owns its UI state (modal visibility, terminal log, progress). The caller
// receives the final data via onComplete and decides what to do with it.
export function useIndexing({ settings, onComplete }) {
  const [isIndexing, setIsIndexing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0); // 0–100, or -1 on failure

  const startIndexing = useCallback(async () => {
    setIsIndexing(true);
    setLogs([]);
    setProgress(5);
    audio.playClick();

    const addLog = (text, type = 'info') => {
      setLogs(prev => [...prev, { text, type, id: Date.now() + Math.random() }]);
    };

    try {
      // Step 1: Play mechanical floppy seek sound
      addLog('💾 INITIALIZING FLOPPY SEEKER...', 'info');
      await audio.playFloppySeek(1200);
      setProgress(15);

      // Step 2: Fetch Stars from GitHub
      addLog(`🕸️ CONNECTING TO GITHUB API FOR USER: ${settings.username}...`, 'info');
      const fetchedRepos = await fetchStarredRepos(
        settings.username,
        settings.githubToken,
        settings.maxStars
      );
      addLog(`✓ SUCCESSFULLY RETRIEVED ${fetchedRepos.length} STARRED REPOSITORIES.`, 'success');
      setProgress(40);
      await audio.playFloppySeek(500);

      // Step 3: Run AI analysis
      let analysis = {};
      if (settings.apiKey || settings.provider === 'custom') {
        addLog(`🤖 CONNECTING TO AI ROUTER (${settings.provider.toUpperCase()})...`, 'info');
        addLog('⏳ EXECUTING GRAPH MAP COMPUTATION PROMPT. PLEASE STAND BY...', 'info');

        const result = await analyzeStars({
          repositories: fetchedRepos,
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
          customUrl: settings.customUrl,
          onProgress: (text, type = 'info', value = null) => {
            addLog(text, type);
            if (value !== null) setProgress(value);
          }
        });
        analysis = result.analysis;
        const meta = result.meta;

        // Honest reporting: a partial or failed AI run must not look like success
        if (meta.analyzed === 0) {
          addLog('❌ AI ANALYSIS FAILED FOR ALL BATCHES. MAP USES LANGUAGE GROUPS ONLY.', 'error');
        } else if (meta.failedBatches > 0 || meta.analyzed < meta.total) {
          addLog(`⚠️ PARTIAL AI MAP: ${meta.analyzed}/${meta.total} REPOS CATEGORIZED (${meta.failedBatches} BATCH(ES) FAILED). REST FALL BACK TO LANGUAGE GROUPS.`, 'warning');
        } else {
          addLog('✓ SEMANTIC CONNECTIONS FORGED BY AI ARCHIVIST.', 'success');
        }
        setProgress(85);
        await audio.playFloppySeek(800);
        storage.write('aiMeta', { ...meta, analyzedAt: Date.now() });
        addLog('✓ GRAPH DATA GENERATED SUCCESSFULLY.', 'success');
      } else {
        addLog('⚠️ WARNING: NO AI API KEY PROVIDED. GENERATING DEFAULT GRAPH (NO SEMANTIC CONNECTIONS).', 'warning');
        addLog('✓ DEFAULT GRAPH DATA GENERATED.', 'success');
      }

      storage.write('repos', fetchedRepos);
      storage.write('ai', analysis);

      setProgress(100);
      addLog('🎉 WORKSPACE READY. OPENING STAR EXPLORER GRAPH...', 'success');
      audio.playSuccess();

      // Delay slightly so user sees 100% completion before opening graph
      setTimeout(() => {
        setIsIndexing(false);
        onComplete(fetchedRepos, analysis);
      }, 800);
    } catch (err) {
      console.error(err);
      addLog(`❌ SYSTEM ERROR: ${err.message}`, 'error');
      audio.playError();
      // Allow user to close error window
      setProgress(-1);
    }
  }, [settings, onComplete]);

  const closeIndexer = useCallback(() => setIsIndexing(false), []);

  return { isIndexing, logs, progress, startIndexing, closeIndexer };
}

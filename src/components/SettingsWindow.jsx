import { useState } from 'react';
import { audio } from '../utils/audio';
import { aiRouter } from '../services/aiRouter';

export default function SettingsWindow({ settings, onSave, onClose }) {
  const [username, setUsername] = useState(settings.username || '');
  const [githubToken, setGithubToken] = useState(settings.githubToken || '');
  const [maxStars, setMaxStars] = useState(settings.maxStars || 100);
  const [provider, setProvider] = useState(settings.provider || 'gemini');
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [model, setModel] = useState(settings.model || 'gemini-2.5-flash');
  const [customUrl, setCustomUrl] = useState(settings.customUrl || '');

  // Testing connection state
  const [testStatus, setTestStatus] = useState({ state: 'idle', message: '' });

  // Re-sync the form when the settings object changes from outside (e.g.
  // Reset All). Render-time adjustment per React docs — avoids the
  // setState-in-effect cascade.
  const [prevSettings, setPrevSettings] = useState(settings);
  if (prevSettings !== settings) {
    setPrevSettings(settings);
    setUsername(settings.username || '');
    setGithubToken(settings.githubToken || '');
    setMaxStars(settings.maxStars || 50);
    setProvider(settings.provider || 'gemini');
    setApiKey(settings.apiKey || '');
    setModel(settings.model || 'gemini-2.5-flash');
    setCustomUrl(settings.customUrl || '');
  }

  const handleSave = (e) => {
    e.preventDefault();
    audio.playSuccess();
    onSave({
      username,
      githubToken,
      maxStars: Number(maxStars),
      provider,
      apiKey,
      model,
      customUrl
    });
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestStatus({ state: 'error', message: 'Enter an API key first!' });
      audio.playError();
      return;
    }
    
    setTestStatus({ state: 'loading', message: 'Pinging AI...' });
    audio.playClick();

    try {
      // Run a tiny test prompt
      await aiRouter.sendMessage({
        provider,
        apiKey,
        model,
        prompt: 'Say the word "Success" and nothing else.',
        customUrl
      });
      setTestStatus({ state: 'success', message: 'Connection Successful!' });
      audio.playSuccess();
    } catch (err) {
      setTestStatus({ state: 'error', message: err.message });
      audio.playError();
    }
  };

  return (
    <form onSubmit={handleSave} className="layout-col" style={{ height: '100%', overflowY: 'auto' }}>
      
      {/* GitHub Authentication Group */}
      <fieldset className="win95-raised" style={{ padding: '10px', margin: '5px 0' }}>
        <legend style={{ padding: '0 5px', fontSize: '12px', fontWeight: 'bold' }}>GitHub Authentication</legend>
        <div className="field-group">
          <label htmlFor="gh-username">GitHub Username (Public Stars):</label>
          <input
            id="gh-username"
            type="text"
            className="layout-flex"
            style={{ width: '100%' }}
            placeholder="e.g. torvalds"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="field-group">
          <label htmlFor="gh-pat">GitHub Personal Access Token (Optional):</label>
          <input
            id="gh-pat"
            type="password"
            className="layout-flex"
            style={{ width: '100%' }}
            placeholder="ghp_xxxxxxxxxxxx"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
          />
          <span style={{ fontSize: '10px', color: '#666', marginTop: '2px', display: 'block' }}>
            Increases rate limit from 60 to 5000 requests/hr. Required for private stars.
          </span>
        </div>
        <div className="field-group">
          <label htmlFor="gh-limit">Max Stars to Visualize:</label>
          <select
            id="gh-limit"
            style={{ width: '100%' }}
            value={maxStars}
            onChange={(e) => setMaxStars(e.target.value)}
          >
            <option value="30">30 Stars (Ultra Fast)</option>
            <option value="50">50 Stars (Recommended)</option>
            <option value="100">100 Stars (Detailed)</option>
            <option value="150">150 Stars (Max Recommended)</option>
            <option value="300">300 Stars (Large Graph - Slow)</option>
          </select>
        </div>
      </fieldset>

      {/* Universal AI Router Config */}
      <fieldset className="win95-raised" style={{ padding: '10px', margin: '5px 0' }}>
        <legend style={{ padding: '0 5px', fontSize: '12px', fontWeight: 'bold' }}>Universal AI Settings</legend>
        
        <div className="field-group">
          <label htmlFor="ai-provider">AI Provider:</label>
          <select
            id="ai-provider"
            style={{ width: '100%' }}
            value={provider}
            onChange={(e) => {
              const selected = e.target.value;
              setProvider(selected);
              if (selected === 'gemini') setModel('gemini-2.5-flash');
              else if (selected === 'openrouter') setModel('google/gemini-2.5-flash');
              else if (selected === 'openai') setModel('gpt-4o-mini');
              else if (selected === 'groq') setModel('llama3-8b-8192');
            }}
          >
            <option value="gemini">Google Gemini (Free Tier Available)</option>
            <option value="openrouter">OpenRouter (Access Free Models)</option>
            <option value="openai">OpenAI (GPT-4o-mini)</option>
            <option value="groq">Groq (Llama 3)</option>
            <option value="custom">Custom Endpoint (OpenAI-compatible)</option>
          </select>
        </div>

        <div className="field-group">
          <label htmlFor="ai-key">API Key (Saved Locally Only):</label>
          <input
            id="ai-key"
            type="password"
            className="layout-flex"
            style={{ width: '100%' }}
            placeholder="AI Key (stored securely in browser)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="field-group">
          <label htmlFor="ai-model">Model Name:</label>
          <input
            id="ai-model"
            type="text"
            className="layout-flex"
            style={{ width: '100%' }}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>

        {provider === 'custom' && (
          <div className="field-group">
            <label htmlFor="ai-custom-url">API Base URL:</label>
            <input
              id="ai-custom-url"
              type="text"
              className="layout-flex"
              style={{ width: '100%' }}
              placeholder="e.g. http://localhost:11434/v1/chat/completions"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
            <span style={{ fontSize: '10px', color: '#666', marginTop: '2px', display: 'block' }}>
              Called directly from your browser (no proxy). For local Ollama, start it with
              OLLAMA_ORIGINS=&quot;*&quot; (or this site&apos;s origin) so CORS allows the request. API key optional.
            </span>
          </div>
        )}

        {/* Informative billing protection warning */}
        <div 
          className="win95-recessed" 
          style={{ 
            padding: '6px', 
            fontSize: '11px', 
            backgroundColor: '#fffffa', 
            borderLeft: '4px solid #000080', 
            marginTop: '6px' 
          }}
        >
          <strong>🛡️ Zero-Cost Guarantee:</strong> If you use Google AI Studio (Gemini), do not add credit card info to your Google account. Gemini will block requests (HTTP 429) when the free tier limit (15 requests/min) is reached. It will never charge you.
        </div>
      </fieldset>

      {/* Control Buttons */}
      <div className="layout-row justify-between align-center" style={{ marginTop: '10px' }}>
        <button
          type="button"
          className="win95-btn"
          onClick={handleTestConnection}
          disabled={testStatus.state === 'loading'}
          style={{ padding: '6px 12px' }}
        >
          {testStatus.state === 'loading' ? 'Testing...' : 'Test Connection'}
        </button>

        <div className="layout-row" style={{ gap: '6px' }}>
          <button
            type="button"
            className="win95-btn"
            onClick={() => {
              audio.playClick();
              onClose();
            }}
            style={{ padding: '6px 12px' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="win95-btn"
            style={{ padding: '6px 16px', fontWeight: 'bold' }}
          >
            Save & Close
          </button>
        </div>
      </div>

      {/* Connection testing statuses */}
      {testStatus.state !== 'idle' && (
        <div
          className="win95-recessed"
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            backgroundColor: testStatus.state === 'error' ? '#ffeeee' : testStatus.state === 'success' ? '#eeffee' : '#f0f0f0',
            border: '1px solid #777',
            wordBreak: 'break-all'
          }}
        >
          {testStatus.state === 'loading' && <span style={{ color: '#000080' }}>⏳ {testStatus.message}</span>}
          {testStatus.state === 'success' && <span style={{ color: '#006600' }}>✓ {testStatus.message}</span>}
          {testStatus.state === 'error' && <span style={{ color: '#cc0000' }}>❌ Error: {testStatus.message}</span>}
        </div>
      )}

    </form>
  );
}

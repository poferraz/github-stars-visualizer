import { useRef, useState } from 'react';
import { audio } from '../utils/audio';
import { aiRouter } from '../services/aiRouter';
import { changeDestination } from '../services/settings';
import { CUSTOM_ENDPOINTS } from '../services/providerEndpoints';

export default function SettingsWindow({ settings, onSave, onClose }) {
  const [draft, setDraft] = useState(settings);
  const { username, githubToken, maxStars, provider, apiKey, model, customUrl } = draft;
  const [testStatus, setTestStatus] = useState({ state: 'idle', message: '' });
  const testVersion = useRef(0);

  function updateDraft(next) {
    testVersion.current += 1;
    setTestStatus({ state: 'idle', message: '' });
    setDraft(next);
  }

  const handleSave = (e) => {
    e.preventDefault();
    audio.playSuccess();
    onSave(draft);
  };

  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestStatus({ state: 'error', message: 'Enter an API key first!' });
      audio.playError();
      return;
    }
    
    if (provider === 'custom' && !CUSTOM_ENDPOINTS.includes(customUrl)) {
      setTestStatus({ state: 'error', message: 'Choose a provider endpoint first.' });
      return;
    }

    const version = ++testVersion.current;
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
      if (version !== testVersion.current) return;
      setTestStatus({ state: 'success', message: 'Connection Successful!' });
      audio.playSuccess();
    } catch (err) {
      if (version !== testVersion.current) return;
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
            onChange={(e) => updateDraft({ ...draft, username: e.target.value })}
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
            autoComplete="off"
            value={githubToken}
            onChange={(e) => updateDraft({ ...draft, githubToken: e.target.value })}
          />
          <span style={{ fontSize: '10px', color: '#666', marginTop: '2px', display: 'block' }}>
            Public stars work without a token. An optional token goes to GitHub and can increase your request limit.
          </span>
        </div>
        <div className="field-group">
          <label htmlFor="gh-limit">Max Stars to Visualize:</label>
          <select
            id="gh-limit"
            style={{ width: '100%' }}
            value={maxStars}
            onChange={(e) => updateDraft({ ...draft, maxStars: Number(e.target.value) })}
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
            onChange={(e) => updateDraft(changeDestination(draft, e.target.value, customUrl))}
          >
            <option value="gemini">Google Gemini</option>
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
            <option value="groq">Groq</option>
            <option value="custom">Custom endpoint via site relay</option>
          </select>
        </div>

        {provider === 'custom' && (
          <div className="field-group">
            <label htmlFor="ai-custom-url">Provider endpoint:</label>
            <select
              id="ai-custom-url"
              style={{ width: '100%' }}
              value={customUrl}
              required={Boolean(apiKey)}
              onChange={(e) => updateDraft(changeDestination(draft, provider, e.target.value))}
            >
              <option value="">Choose an endpoint</option>
              {CUSTOM_ENDPOINTS.map(url => <option key={url} value={url}>{url}</option>)}
            </select>
            <small>The site relay receives your AI key and prompt and forwards them to this endpoint.</small>
          </div>
        )}

        <div className="field-group">
          <label htmlFor="ai-key">AI API Key (optional):</label>
          <input
            id="ai-key"
            type="password"
            className="layout-flex"
            style={{ width: '100%' }}
            autoComplete="off"
            value={apiKey}
            onChange={(e) => updateDraft({ ...draft, apiKey: e.target.value })}
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
            onChange={(e) => updateDraft({ ...draft, model: e.target.value })}
          />
        </div>

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
          Keys are kept in this tab until you reload or close it. Testing a connection and indexing with AI both send requests. Your provider sets prices and quotas. Check your account’s billing settings before using a key.
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

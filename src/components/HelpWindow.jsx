import { audio } from '../utils/audio';

export default function HelpWindow({ onClose }) {
  return (
    <div className="layout-col scrollable" style={{ height: '100%', fontSize: '13px', lineHeight: '18px', paddingRight: '5px' }}>
      
      <div style={{ borderBottom: '2px solid var(--os-shadow)', paddingBottom: '8px', marginBottom: '10px' }}>
        <h2 style={{ fontFamily: 'var(--font-os)', fontSize: '18px' }}>📂 Welcome to GitStars Map v1.0</h2>
        <span style={{ fontSize: '11px', color: '#555' }}>Nostalgic Obsidian-style Explorer for GitHub Stars</span>
      </div>

      <p style={{ marginBottom: '12px' }}>
        Explore GitHub stars as a graph. You can browse by language or use an AI provider to suggest summaries, categories and related repositories.
      </p>

      {/* Guide Group */}
      <fieldset className="win95-raised" style={{ padding: '10px', marginBottom: '12px' }}>
        <legend style={{ padding: '0 4px', fontWeight: 'bold' }}>🚀 Quick Setup Guide</legend>
        
        <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <li>Open <strong>API Settings</strong> and enter the GitHub username whose public stars you want to explore.</li>
          <li>You can leave the GitHub token blank. If you need a higher request limit, use a token with read-only access to public repositories. <a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer" onClick={() => audio.playClick()} style={{ color: '#00f', textDecoration: 'underline' }}>GitHub token settings ↗</a></li>
          <li>For AI analysis, choose a provider and enter a key for that provider. Leave the key blank to browse a graph with language filters.</li>
          <li>Click <strong>Save &amp; Close</strong>, then double-click <strong>Stars Map</strong> to open the graph or start your first scan.</li>
        </ol>
      </fieldset>

      {/* Security Group */}
      <fieldset className="win95-raised" style={{ padding: '10px', marginBottom: '12px' }}>
        <legend style={{ padding: '0 4px', fontWeight: 'bold' }}>🛡️ Privacy and billing</legend>
        <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>API keys stay in tab memory until you reload or close it. The browser saves your preferences, repository data, AI results and local request counts. The Start menu’s <strong>Format Cache &amp; Keys</strong> clears these and forgets the keys in this tab.</li>
          <li>Your GitHub token goes to GitHub. With AI enabled, your chosen provider receives the AI key and a prompt containing repository names, descriptions and languages. Custom endpoint mode sends the key and prompt through this site’s relay to the selected endpoint.</li>
          <li>Testing a connection also sends a request to your provider. The app counts successful AI requests locally. Your account, model and provider determine your actual quota and charges.</li>
        </ul>
      </fieldset>

      {/* Graph Manipulation */}
      <fieldset className="win95-raised" style={{ padding: '10px', marginBottom: '12px' }}>
        <legend style={{ padding: '0 4px', fontWeight: 'bold' }}>🖱️ Navigation Controls</legend>
        <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li><strong>Drag Canvas:</strong> Hold Left-Click and move mouse to pan around.</li>
          <li><strong>Zoom:</strong> Scroll mouse wheel up/down to zoom in/out.</li>
          <li><strong>Drag Nodes:</strong> Click and hold any node to rearrange the structure.</li>
          <li><strong>Click Node:</strong> Click a node to open its properties drawer (details, summaries, connections).</li>
          <li><strong>Click Category:</strong> Click category nodes (magenta) to see a list of repositories in that folder.</li>
        </ul>
      </fieldset>

      <div style={{ marginTop: 'auto', textAlign: 'center', paddingTop: '10px' }}>
        <button
          type="button"
          className="win95-btn"
          style={{ width: '120px', padding: '6px' }}
          onClick={() => {
            audio.playClick();
            onClose();
          }}
        >
          OK
        </button>
      </div>

    </div>
  );
}

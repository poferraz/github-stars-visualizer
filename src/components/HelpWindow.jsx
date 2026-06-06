import React from 'react';
import { audio } from '../utils/audio';

export default function HelpWindow({ onClose }) {
  return (
    <div className="layout-col scrollable" style={{ height: '100%', fontSize: '13px', lineHeight: '18px', paddingRight: '5px' }}>
      
      <div style={{ borderBottom: '2px solid var(--os-shadow)', paddingBottom: '8px', marginBottom: '10px' }}>
        <h2 style={{ fontFamily: 'var(--font-os)', fontSize: '18px' }}>📂 Welcome to GitStars Map v1.0</h2>
        <span style={{ fontSize: '11px', color: '#555' }}>Nostalgic Obsidian-style Explorer for GitHub Stars</span>
      </div>

      <p style={{ marginBottom: '12px' }}>
        This program connects to your GitHub account, downloads your starred repositories, and uses AI to index, categorize, and forge semantic maps showing how your stars relate to each other—rendering them in an interactive, 3D-simulated canvas.
      </p>

      {/* Guide Group */}
      <fieldset className="win95-raised" style={{ padding: '10px', marginBottom: '12px' }}>
        <legend style={{ padding: '0 4px', fontWeight: 'bold' }}>🚀 Quick Setup Guide</legend>
        
        <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <li>
            <strong>Configure Credentials:</strong> Open the <strong>API Settings</strong> window from the desktop icon or Start menu.
          </li>
          <li>
            <strong>GitHub Username:</strong> Enter your public GitHub username.
          </li>
          <li>
            <strong>GitHub PAT Token (Optional but Recommended):</strong> 
            {' '}To avoid API rate limits, generate a fine-grained token with "Read-only access to public repositories" on 
            {' '}<a href="https://github.com/settings/tokens?type=beta" target="_blank" rel="noreferrer" onClick={() => audio.playClick()} style={{ color: '#00f', textDecoration: 'underline' }}>GitHub Settings ↗</a>{' '}.
          </li>
          <li>
            <strong>Get a FREE AI API Key:</strong> Get a free Gemini API key on 
            {' '}<a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" onClick={() => audio.playClick()} style={{ color: '#00f', textDecoration: 'underline' }}>Google AI Studio ↗</a>{' '}.
            The free tier allows 15 requests/min and 1500 requests/day, which is completely free!
          </li>
          <li>
            <strong>Execute indexer:</strong> Click <strong>Save & Close</strong> in Settings, then double-click <strong>Stars Map</strong> on the desktop to scan!
          </li>
        </ol>
      </fieldset>

      {/* Security Group */}
      <fieldset className="win95-raised" style={{ padding: '10px', marginBottom: '12px' }}>
        <legend style={{ padding: '0 4px', fontWeight: 'bold' }}>🛡️ Security & Safe Billing</legend>
        <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li>
            <strong>100% Serverless:</strong> Your credentials are saved strictly in your browser's private <code style={{ fontFamily: 'var(--font-mono)' }}>localStorage</code>. No external server receives your keys.
          </li>
          <li>
            <strong>No Auto-Billing:</strong> If you use Google AI Studio without linking a billing Cloud Console account, Google will **never** charge you. Once you hit the limit, requests simply fail with a `429 Too Many Requests` code.
          </li>
          <li>
            <strong>Local Guardrails:</strong> Our built-in rate limiter monitors your requests per-minute and per-day in local storage, blocking requests client-side before they can reach the limits.
          </li>
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

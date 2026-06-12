import { audio } from '../utils/audio';

// Modal progress panel for the indexing pipeline: progress bar + faux
// terminal log. Closable only after a failure (progress === -1).
export default function IndexerWindow({ progress, logs, onClose }) {
  return (
    <div
      className="win95-window win95-raised"
      role="dialog"
      aria-label="Indexer Manager"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(460px, 94vw)',
        zIndex: 99999,
        boxShadow: '10px 10px 30px rgba(0,0,0,0.6)'
      }}
    >
      <div className="win95-title-bar active">
        <div className="win95-title-text">💾 Indexer Manager v1.0</div>
        {progress === -1 && (
          <button
            className="win95-btn win95-btn-close"
            aria-label="Close indexer"
            onClick={onClose}
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
              width: `${Math.max(0, progress)}%`,
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
              color: progress > 50 ? '#ffffff' : '#000000',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)'
            }}
          >
            {progress === -1 ? 'INDEXING FAILED' : `${progress}%`}
          </div>
        </div>

        {/* Installer Terminal Logs */}
        <div
          className="win95-recessed terminal-view"
          aria-live="polite"
          style={{ height: '180px', display: 'flex', flexDirection: 'column-reverse' }}
        >
          <div>
            {logs.map(log => (
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

        {progress === -1 && (
          <button
            type="button"
            className="win95-btn"
            style={{ alignSelf: 'flex-end', padding: '4px 12px' }}
            onClick={() => {
              audio.playClick();
              onClose();
            }}
          >
            Close Setup
          </button>
        )}
      </div>
    </div>
  );
}

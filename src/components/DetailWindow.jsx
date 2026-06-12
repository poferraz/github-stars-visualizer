import { audio } from '../utils/audio';

export default function DetailWindow({ node, allNodes, allLinks, onSelectNode, onClose }) {
  if (!node) {
    return (
      <div className="layout-col justify-between" style={{ height: '100%', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Double-click or select any node on the graph to display properties.</p>
      </div>
    );
  }

  const handleSelectLink = (targetId) => {
    audio.playClick();
    const foundNode = allNodes.find(n => n.id === targetId);
    if (foundNode) {
      onSelectNode(foundNode);
    }
  };

  if (node.type === 'root') {
    const repoCount = allNodes.filter(n => n.type === 'repo').length;
    const categoryCount = allNodes.filter(n => n.type === 'category').length;
    return (
      <div className="layout-col" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ borderBottom: '1px solid #777', paddingBottom: '6px', marginBottom: '8px' }}>
          <h3 style={{ fontFamily: 'var(--font-os)', fontSize: '16px' }}>💾 Account: {node.name}</h3>
          <span style={{ fontSize: '11px', color: '#444' }}>Center of the star map</span>
        </div>
        <div className="win95-recessed" style={{ padding: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontFamily: 'var(--font-mono)' }}>
          <span>⭐ Repos: {repoCount}</span>
          <span>📁 Categories: {categoryCount}</span>
        </div>
        <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
          <button
            type="button"
            className="win95-btn"
            style={{ width: '100%' }}
            onClick={() => {
              audio.playClick();
              onClose();
            }}
          >
            Close Properties
          </button>
        </div>
      </div>
    );
  }

  if (node.type === 'category') {
    // Gather all repos connected to this category node
    const connectedRepos = allLinks
      .filter(l => l.target.id === node.id || l.target === node.id)
      .map(l => {
        const sourceId = l.source.id || l.source;
        return allNodes.find(n => n.id === sourceId);
      })
      .filter(n => n && n.type === 'repo');

    return (
      <div className="layout-col" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ borderBottom: '1px solid #777', paddingBottom: '6px', marginBottom: '8px' }}>
          <h3 style={{ fontFamily: 'var(--font-os)', fontSize: '16px' }}>📁 Category: {node.name}</h3>
          <span style={{ fontSize: '11px', color: '#444' }}>Contains {connectedRepos.length} repository nodes</span>
        </div>

        <div className="layout-flex scrollable win95-recessed" style={{ padding: '8px', maxHeight: '300px' }}>
          <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {connectedRepos.map(repo => (
              <li key={repo.id}>
                <button
                  type="button"
                  className="win95-btn"
                  style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => handleSelectLink(repo.id)}
                >
                  ⭐ {repo.name} ({repo.language})
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
          <button
            type="button"
            className="win95-btn"
            style={{ width: '100%' }}
            onClick={() => {
              audio.playClick();
              onClose();
            }}
          >
            Close Properties
          </button>
        </div>
      </div>
    );
  }

  // Repository details
  // Find semantic links connected to this repository
  const semanticLinks = allLinks
    .filter(l => l.type === 'semantic_connection' && (l.source.id === node.id || l.source === node.id || l.target.id === node.id || l.target === node.id))
    .map(l => {
      const sourceId = l.source.id || l.source;
      const targetId = l.target.id || l.target;
      const connectedId = sourceId === node.id ? targetId : sourceId;
      return allNodes.find(n => n.id === connectedId);
    })
    .filter(n => n);

  return (
    <div className="layout-col" style={{ height: '100%', overflowY: 'auto', fontSize: '12px' }}>
      
      {/* Title */}
      <div style={{ borderBottom: '1px solid #777', paddingBottom: '6px', marginBottom: '8px' }}>
        <h3 style={{ fontFamily: 'var(--font-os)', fontSize: '16px', wordBreak: 'break-all' }}>⭐ {node.name}</h3>
        <a 
          href={node.url} 
          target="_blank" 
          rel="noreferrer" 
          onClick={() => audio.playClick()}
          style={{ fontSize: '11px', color: '#0000ee', textDecoration: 'underline', wordBreak: 'break-all' }}
        >
          {node.fullName} ↗
        </a>
      </div>

      {/* Grid Stats */}
      <div 
        className="win95-recessed" 
        style={{ 
          padding: '6px', 
          backgroundColor: '#f5f5f5', 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '6px',
          fontFamily: 'var(--font-mono)' 
        }}
      >
        <div><strong>Language:</strong> {node.language}</div>
        <div><strong>Stars:</strong> {node.stars.toLocaleString()}</div>
        <div style={{ gridColumn: 'span 2' }}><strong>Forks:</strong> {node.forks.toLocaleString()}</div>
      </div>

      {/* Summary Group */}
      <div className="layout-col" style={{ gap: '4px', marginTop: '6px' }}>
        <strong>Description (GitHub):</strong>
        <div className="win95-recessed" style={{ padding: '6px', minHeight: '40px', backgroundColor: '#fff', fontStyle: 'italic', color: '#444' }}>
          {node.description || 'No description provided.'}
        </div>
      </div>

      {/* AI Insights Group */}
      <div className="layout-col" style={{ gap: '4px', marginTop: '8px' }}>
        <strong>🤖 AI Archivist Insight:</strong>
        <div 
          className="win95-recessed" 
          style={{ 
            padding: '8px', 
            minHeight: '60px', 
            backgroundColor: '#000000', 
            color: '#00ff00', 
            fontFamily: 'var(--font-mono)',
            lineHeight: '16px',
            border: '2px solid #808080'
          }}
        >
          {node.summary}
        </div>
      </div>

      {/* Connected Nodes List */}
      <div className="layout-col" style={{ gap: '4px', marginTop: '10px' }}>
        <strong>⚡ Semantic Connections ({semanticLinks.length}):</strong>
        {semanticLinks.length > 0 ? (
          <div className="win95-recessed" style={{ padding: '6px', maxHeight: '120px', overflowY: 'auto' }}>
            <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {semanticLinks.map(conn => (
                <li key={conn.id}>
                  <button
                    type="button"
                    className="win95-btn"
                    style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'left', fontSize: '11px' }}
                    onClick={() => handleSelectLink(conn.id)}
                  >
                    🔗 {conn.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div style={{ fontStyle: 'italic', color: '#666', fontSize: '11px', paddingLeft: '4px' }}>
            No related stars found in this collection.
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
        <button
          type="button"
          className="win95-btn"
          style={{ width: '100%' }}
          onClick={() => {
            audio.playClick();
            onClose();
          }}
        >
          Close Properties
        </button>
      </div>

    </div>
  );
}

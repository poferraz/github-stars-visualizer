import React, { useEffect, useRef, useState } from 'react';
import ForceGraph from 'force-graph';
import { forceCollide } from 'd3-force-3d';
import { audio } from '../utils/audio';

export default function GraphWindow({ 
  graphData, 
  onSelectNode, 
  selectedNodeId, 
  searchQuery,
  selectedLanguages = [],
  setSelectedLanguages,
  minStars = 0,
  setMinStars,
  allLanguages = [],
  maxStarsLimit = 100
}) {
  const containerRef = useRef(null);
  const graphInstanceRef = useRef(null);
  const [showSemantic, setShowSemantic] = useState(true);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const hasZoomedRef = useRef(false);

  // Store dynamic props in refs for canvas rendering and event handlers
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  const onSelectNodeRef = useRef(onSelectNode);
  onSelectNodeRef.current = onSelectNode;

  // Node drawing logic used by both initial mount and redraw triggers
  const drawNode = (node, ctx, globalScale) => {
    const isHighlighted = searchQueryRef.current && 
      node.name.toLowerCase().includes(searchQueryRef.current.toLowerCase());
    const isSelected = selectedNodeIdRef.current && node.id === selectedNodeIdRef.current;
    
    const label = node.name;
    const baseFontSize = node.type === 'category' ? 12 : 9;
    const fontSize = baseFontSize / globalScale;
    
    ctx.font = `${node.type === 'category' ? 'bold ' : ''}${fontSize}px var(--font-mono)`;

    // 1. Draw glowing outer halo for selected or searched nodes
    if (isSelected || isHighlighted) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val + (isSelected ? 5 : 3), 0, 2 * Math.PI, false);
      ctx.strokeStyle = isSelected ? '#ff00ff' : '#00ffff';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // 2. Draw core node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
    ctx.fillStyle = node.color;
    ctx.fill();

    // Thin stroke boundary for categories
    if (node.type === 'category') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // 3. Render Node labels (only if we aren't zoomed out extremely far)
    if (globalScale > 0.15) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw text background box for categories to make them readable
      if (node.type === 'category') {
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(13, 13, 13, 0.85)';
        ctx.fillRect(
          node.x - textWidth / 2 - 3,
          node.y + node.val + 2,
          textWidth + 6,
          fontSize + 4
        );
      }

      ctx.fillStyle = node.type === 'category' ? '#ff00ff' : (isSelected ? '#ff00ff' : '#00ff00');
      ctx.fillText(label, node.x, node.y + node.val + fontSize + (node.type === 'category' ? 2 : 1));
    }
  };

  // Initialize ForceGraph once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous instance/DOM elements
    containerRef.current.innerHTML = '';

    const graph = ForceGraph()(containerRef.current)
      .nodeId('id')
      .nodeVal('val')
      .nodeColor('color')
      .linkColor(link => link.type === 'semantic_connection' ? '#00ffff' : '#808080')
      .linkWidth(link => link.type === 'semantic_connection' ? 1.5 : 1)
      .linkDirectionalParticles(link => link.type === 'semantic_connection' ? 3 : 0) // Moving data streams
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleColor(() => '#00ffff')
      .linkDirectionalParticleWidth(2)
      .onNodeClick(node => {
        audio.playClick();
        if (onSelectNodeRef.current) {
          onSelectNodeRef.current(node);
        }
      })
      .backgroundColor('#0d0d0d');

    // Add repulsion, distance, and collision forces
    graph.d3Force('charge').strength(node => node.type === 'category' ? -400 : -120);
    graph.d3Force('link').distance(link => link.type === 'semantic_connection' ? 150 : 80);
    graph.d3Force('collide', forceCollide(node => node.val + 15));

    // Customize node rendering on Canvas to show labels and focus highlights
    graph.nodeCanvasObject(drawNode);

    graphInstanceRef.current = graph;

    // Implement ResizeObserver to set graph bounds dynamically
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        graph.width(width).height(height);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (graphInstanceRef.current) {
        graphInstanceRef.current.onEngineStop(null);
      }
      graphInstanceRef.current = null;
    };
  }, []);

  // Update graph data when graphData or showSemantic toggles change
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) {
      hasZoomedRef.current = false;
      return;
    }
    if (!graphInstanceRef.current) return;

    // Filter out semantic links if toggled off
    const filteredLinks = showSemantic 
      ? graphData.links 
      : graphData.links.filter(l => l.type !== 'semantic_connection');

    const filteredGraphData = {
      nodes: graphData.nodes,
      links: filteredLinks
    };

    graphInstanceRef.current.graphData(filteredGraphData);

    // Zoom to fit on initial load/first populate
    if (!hasZoomedRef.current) {
      hasZoomedRef.current = true;
      setTimeout(() => {
        if (graphInstanceRef.current) {
          graphInstanceRef.current.zoomToFit(200, 50);
        }
      }, 100);
    }
  }, [graphData, showSemantic]);

  // Refresh graph rendering on highlight/selection change (avoids full rebuilds)
  useEffect(() => {
    if (graphInstanceRef.current) {
      // Re-register the nodeCanvasObject with a new wrapper function reference.
      // This signals to force-graph that a redraw of the canvas is needed.
      graphInstanceRef.current.nodeCanvasObject((node, ctx, globalScale) => drawNode(node, ctx, globalScale));
    }
  }, [searchQuery, selectedNodeId]);

  const handleZoomFit = () => {
    audio.playClick();
    if (graphInstanceRef.current) {
      graphInstanceRef.current.zoomToFit(300, 80);
    }
  };

  return (
    <div className="graph-container">
      {/* Floating retro button controls on the graph */}
      <div className="graph-controls">
        <button className="win95-btn" onClick={handleZoomFit}>
          🔍 Center Graph
        </button>
        <button 
          className="win95-btn" 
          onClick={() => {
            audio.playClick();
            setShowSemantic(!showSemantic);
          }}
          style={{ fontWeight: showSemantic ? 'bold' : 'normal' }}
        >
          {showSemantic ? '⚡ Hide Connections' : '⚡ Show Connections'}
        </button>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Retro Legend */}
      <div className="graph-legend win95-raised" style={{ opacity: 0.9 }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px solid #333' }}>Legend</div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: '#ff00ff' }} />
          <span>Category Node</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: '#00ff00' }} />
          <span>Star Node (Python/Default)</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: '#f1e05a' }} />
          <span>JavaScript</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: '#3178c6' }} />
          <span>TypeScript</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: '#dea584' }} />
          <span>Rust</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ backgroundColor: '#00ffff' }} />
          <span>Semantic Relation</span>
        </div>
      </div>

      {/* Retro Filter Settings Box */}
      <div className="win95-window" style={{ position: 'absolute', top: '10px', right: '10px', width: '200px', zIndex: 11, fontSize: '11px' }}>
        <div 
          className="win95-title-bar active" 
          style={{ cursor: 'pointer', userSelect: 'none' }} 
          onClick={() => {
            audio.playClick();
            setIsFiltersOpen(!isFiltersOpen);
          }}
        >
          <span className="win95-title-text">🎛️ Filter Settings</span>
          <div className="win95-title-controls">
            <button className="win95-btn" style={{ width: '16px', height: '14px', padding: 0, fontSize: '9px', lineHeight: '10px' }}>
              {isFiltersOpen ? '▲' : '▼'}
            </button>
          </div>
        </div>
        {isFiltersOpen && (
          <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Languages filter */}
            <div className="win95-raised" style={{ padding: '4px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Languages:</div>
              <div className="win95-recessed" style={{ maxHeight: '100px', overflowY: 'auto', padding: '4px', backgroundColor: '#fff', color: '#000' }}>
                {allLanguages.map(lang => (
                  <label key={lang} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginBottom: '2px' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedLanguages.includes(lang)}
                      onChange={() => {
                        audio.playClick();
                        if (selectedLanguages.includes(lang)) {
                          setSelectedLanguages(selectedLanguages.filter(l => l !== lang));
                        } else {
                          setSelectedLanguages([...selectedLanguages, lang]);
                        }
                      }}
                    />
                    {lang}
                  </label>
                ))}
                {allLanguages.length === 0 && <span style={{ color: '#888' }}>No languages</span>}
              </div>
              {selectedLanguages.length > 0 && (
                <button 
                  className="win95-btn" 
                  style={{ width: '100%', marginTop: '4px', padding: '2px 0' }}
                  onClick={() => {
                    audio.playClick();
                    setSelectedLanguages([]);
                  }}
                >
                  Clear Selected
                </button>
              )}
            </div>

            {/* Min Stars slider */}
            <div className="win95-raised" style={{ padding: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
                <span>Min Stars:</span>
                <span style={{ color: '#0000ff' }}>{minStars}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max={maxStarsLimit}
                value={minStars}
                style={{ width: '100%', cursor: 'pointer' }}
                onChange={(e) => {
                  setMinStars(Number(e.target.value));
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#666' }}>
                <span>0</span>
                <span>{maxStarsLimit}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

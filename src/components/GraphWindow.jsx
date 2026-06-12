import { useEffect, useRef, useState } from 'react';
import ForceGraph from 'force-graph';
import { forceCollide } from 'd3-force-3d';
import { audio } from '../utils/audio';
import { applyRadialLayout, clearRadialLayout } from '../utils/radialLayout';

// Minimal HTML escaping for hover tooltips (category names come from the AI)
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

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
  const [layoutMode, setLayoutMode] = useState('web'); // 'web' (radial) | 'force' (organic)
  const [gravity, setGravity] = useState(-150);
  const [linkDistance, setLinkDistance] = useState(100);
  const [collisionRadius, setCollisionRadius] = useState(20);
  const hasZoomedRef = useRef(false);
  const prevLayoutModeRef = useRef(layoutMode);
  const orbitRadiiRef = useRef([]);

  // Mirror layoutMode into a ref so the canvas accessors registered once at
  // mount (linkColor, particles, onRenderFramePre) see the current mode.
  // Updated in an effect declared before the data-update effect so ordering
  // guarantees it is current when graphData is (re)applied.
  const layoutModeRef = useRef(layoutMode);
  useEffect(() => {
    layoutModeRef.current = layoutMode;
  }, [layoutMode]);

  // Store dynamic props in refs for canvas rendering and event handlers.
  // Synced in an effect (not during render) per the react-hooks/refs rule;
  // the redraw effect below depends on the same values and runs after this.
  const searchQueryRef = useRef(searchQuery);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const onSelectNodeRef = useRef(onSelectNode);
  useEffect(() => {
    searchQueryRef.current = searchQuery;
    selectedNodeIdRef.current = selectedNodeId;
    onSelectNodeRef.current = onSelectNode;
  }, [searchQuery, selectedNodeId, onSelectNode]);

  // Node drawing logic used by both initial mount and redraw triggers
  const drawNode = (node, ctx, globalScale) => {
    const isHighlighted = searchQueryRef.current &&
      node.name.toLowerCase().includes(searchQueryRef.current.toLowerCase());
    const isSelected = selectedNodeIdRef.current && node.id === selectedNodeIdRef.current;

    const label = node.name;
    const isHub = node.type === 'category' || node.type === 'root';
    const baseFontSize = node.type === 'root' ? 13 : node.type === 'category' ? 12 : 9;
    const fontSize = baseFontSize / globalScale;

    ctx.font = `${isHub ? 'bold ' : ''}${fontSize}px var(--font-mono)`;

    // 1. Draw glowing outer halo for selected or searched nodes
    if (isSelected || isHighlighted) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val + (isSelected ? 5 : 3), 0, 2 * Math.PI, false);
      ctx.strokeStyle = isSelected ? '#ff00ff' : '#00ffff';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // 2. Draw the node core
    if (node.type === 'root') {
      // Central root: dark rounded square with the account's initial,
      // mirroring the hub treatment in classic radial org maps
      const s = node.val + 4;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(node.x - s, node.y - s, s * 2, s * 2, 4);
      } else {
        ctx.rect(node.x - s, node.y - s, s * 2, s * 2);
      }
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${node.val * 1.2}px var(--font-mono)`; // graph units: scales with the square
      ctx.fillText(label.charAt(0).toUpperCase(), node.x, node.y + 0.5);
      ctx.font = `bold ${fontSize}px var(--font-mono)`;
    } else {
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
    }

    // 3. Labels: hubs are always labeled; repo labels appear only when zoomed
    // in or highlighted (hover tooltips carry identity at low zoom), keeping
    // the web readable at hundreds of nodes
    const showLabel = isHub
      ? globalScale > 0.15
      : (isSelected || isHighlighted || globalScale > 1.4);
    if (showLabel) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Draw text background box for hubs to make them readable
      if (isHub) {
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(13, 13, 13, 0.85)';
        ctx.fillRect(
          node.x - textWidth / 2 - 3,
          node.y + node.val + 2,
          textWidth + 6,
          fontSize + 4
        );
      }

      ctx.fillStyle = node.type === 'category' ? node.color
        : node.type === 'root' ? '#ffffff'
        : (isSelected ? '#ff00ff' : '#00ff00');
      ctx.fillText(label, node.x, node.y + node.val + fontSize + (isHub ? 2 : 1));
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
      // Web mode uses faint threads so the ring geometry reads as the structure;
      // force mode keeps the original brighter wiring
      .linkColor(link => {
        if (link.type === 'semantic_connection') {
          return layoutModeRef.current === 'web' ? 'rgba(0, 255, 255, 0.25)' : '#00ffff';
        }
        return layoutModeRef.current === 'web' ? 'rgba(255, 255, 255, 0.10)' : '#808080';
      })
      .linkWidth(link => link.type === 'semantic_connection' ? (layoutModeRef.current === 'web' ? 1 : 1.5) : 1)
      // Particles only in force mode: in the static web they read as noise
      // and keep the rAF loop hot after the layout has settled
      .linkDirectionalParticles(link =>
        layoutModeRef.current === 'force' && link.type === 'semantic_connection' ? 3 : 0)
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleColor(() => '#00ffff')
      .linkDirectionalParticleWidth(2)
      // Hover tooltip: identity at any zoom level without label clutter
      .nodeLabel(node => {
        if (node.type === 'root') {
          return `<div><b>${esc(node.name)}</b><br/>Starred repository map</div>`;
        }
        if (node.type === 'category') {
          return `<div><b>${esc(node.name)}</b><br/>Category</div>`;
        }
        return `<div><b>${esc(node.fullName || node.name)}</b><br/>${esc(node.language)} &middot; &#9733;${node.stars}</div>`;
      })
      .backgroundColor('#0d0d0d');

    // Faint concentric orbit guides behind the nodes (web mode only)
    graph.onRenderFramePre((ctx, globalScale) => {
      if (layoutModeRef.current !== 'web' || orbitRadiiRef.current.length === 0) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1 / globalScale;
      orbitRadiiRef.current.forEach(r => {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, 2 * Math.PI, false);
        ctx.stroke();
      });
      ctx.restore();
    });

    // Add repulsion, distance, and collision forces
    graph.d3Force('charge').strength(node => node.type === 'category' ? -400 : -120);
    graph.d3Force('link').distance(link => link.type === 'semantic_connection' ? 150 : 80);
    graph.d3Force('collide', forceCollide(node => node.val + 15));

    // Customize node rendering on Canvas to show labels and focus highlights
    graph.nodeCanvasObject(drawNode);

    // Ensure click target area matches the visually drawn node size
    // We scale the click target inversely with zoom so nodes remain easily clickable even when zoomed out
    graph.nodePointerAreaPaint((node, color, ctx, globalScale) => {
      const minScreenRadius = 8; // minimum click target size in screen pixels
      const radius = Math.max(node.val + 2, minScreenRadius / globalScale);
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.fill();
    });

    graphInstanceRef.current = graph;
    graph.nodeRelSize(1);

    // Custom Click Handling to bypass D3-zoom/pointerup conflict
    let clickStartX = 0;
    let clickStartY = 0;
    let clickStartTime = 0;

    const handlePointerDown = (e) => {
      clickStartX = e.clientX;
      clickStartY = e.clientY;
      clickStartTime = Date.now();
    };

    const handlePointerUp = (e) => {
      const duration = Date.now() - clickStartTime;
      const dx = e.clientX - clickStartX;
      const dy = e.clientY - clickStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 8 && duration < 500) {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const { x: graphX, y: graphY } = graph.screen2GraphCoords(x, y);

        const { nodes } = graph.graphData();
        let closestNode = null;
        let minDistance = Infinity;

        for (const node of nodes) {
          if (node.x === undefined || node.y === undefined) continue;
          const ndx = node.x - graphX;
          const ndy = node.y - graphY;
          const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
          const hitRadius = Math.max(node.val + 2, 10);
          if (ndist <= hitRadius && ndist < minDistance) {
            minDistance = ndist;
            closestNode = node;
          }
        }

        if (closestNode) {
          audio.playClick();
          if (onSelectNodeRef.current) {
            onSelectNodeRef.current(closestNode);
          }
        }
      }
    };

    const container = containerRef.current;
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointerup', handlePointerUp);

    // Implement ResizeObserver to set graph bounds dynamically
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        graph.width(width).height(height);
      }
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointerup', handlePointerUp);
      resizeObserver.disconnect();
      if (graphInstanceRef.current) {
        graphInstanceRef.current.onEngineStop(() => {});
      }
      graphInstanceRef.current = null;
    };
  }, []);

  // Update graph data when graphData, layout mode, or showSemantic change
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) {
      hasZoomedRef.current = false;
      return;
    }
    const graph = graphInstanceRef.current;
    if (!graph) return;

    if (layoutMode === 'web') {
      // Deterministic spider-web layout: pin every node, stop the simulation
      // immediately (zero physics cost), and disable drag so rings stay crisp
      const { orbitRadii } = applyRadialLayout(graphData);
      orbitRadiiRef.current = orbitRadii;
      graph.cooldownTicks(0);
      graph.enableNodeDrag(false);
    } else {
      clearRadialLayout(graphData);
      orbitRadiiRef.current = [];
      graph.cooldownTicks(Infinity);
      graph.enableNodeDrag(true);
      graph.d3ReheatSimulation();
    }

    // Filter out semantic links if toggled off
    const filteredLinks = showSemantic
      ? graphData.links
      : graphData.links.filter(l => l.type !== 'semantic_connection');

    graph.graphData({
      nodes: graphData.nodes,
      links: filteredLinks
    });

    // Zoom to fit on first populate and whenever the layout mode flips
    const layoutChanged = prevLayoutModeRef.current !== layoutMode;
    prevLayoutModeRef.current = layoutMode;
    if (!hasZoomedRef.current || layoutChanged) {
      hasZoomedRef.current = true;
      setTimeout(() => {
        if (graphInstanceRef.current) {
          graphInstanceRef.current.zoomToFit(300, 60);
        }
      }, layoutChanged ? 250 : 100);
    }
  }, [graphData, showSemantic, layoutMode]);

  // Refresh graph rendering on highlight/selection change (avoids full rebuilds)
  useEffect(() => {
    if (graphInstanceRef.current) {
      // Re-register the nodeCanvasObject with a new wrapper function reference.
      // This signals to force-graph that a redraw of the canvas is needed.
      graphInstanceRef.current.nodeCanvasObject((node, ctx, globalScale) => drawNode(node, ctx, globalScale));
    }
  }, [searchQuery, selectedNodeId]);

  // Handle dynamic update of D3 physics force settings (force mode only —
  // in web mode every node is pinned and the simulation is stopped)
  useEffect(() => {
    const graph = graphInstanceRef.current;
    if (!graph || layoutMode !== 'force') return;

    graph.d3Force('charge').strength(node => node.type === 'category' ? gravity * 3 : gravity);
    graph.d3Force('link').distance(link => link.type === 'semantic_connection' ? linkDistance * 1.5 : linkDistance);
    graph.d3Force('collide').radius(node => node.val + collisionRadius);
    graph.d3ReheatSimulation(); // reheat layout simulation after changes
  }, [gravity, linkDistance, collisionRadius, layoutMode]);

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
            setLayoutMode(layoutMode === 'web' ? 'force' : 'web');
          }}
        >
          {layoutMode === 'web' ? '🕸️ Web Layout' : '🌀 Force Layout'}
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

      {/* Retro Legend — generated from the categories actually on the map */}
      <div className="graph-legend win95-raised" style={{ opacity: 0.9 }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px', borderBottom: '1px solid #333' }}>Legend</div>
        {(graphData?.nodes || [])
          .filter(n => n.type === 'category')
          .slice(0, 8)
          .map(cat => (
            <div className="legend-item" key={cat.id}>
              <div className="legend-dot" style={{ backgroundColor: cat.color }} />
              <span>{cat.name}</span>
            </div>
          ))}
        {(graphData?.nodes || []).filter(n => n.type === 'category').length > 8 && (
          <div className="legend-item" style={{ color: '#888' }}>
            <span>…and {(graphData?.nodes || []).filter(n => n.type === 'category').length - 8} more</span>
          </div>
        )}
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

            {/* Divider */}
            <div style={{ borderTop: '1.5px solid var(--os-shadow)', borderBottom: '1.5px solid var(--os-light)', margin: '6px 0' }} />

            {/* Physics Settings: only meaningful in force mode (web mode pins all nodes) */}
            {layoutMode === 'web' && (
              <div style={{ fontSize: '10px', color: '#444' }}>
                Physics disabled in 🕸️ Web Layout — positions are fixed. Switch to 🌀 Force Layout to enable.
              </div>
            )}
            {layoutMode === 'force' && (<>
            <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Physics Config:</div>

            {/* Gravity Slider */}
            <div className="win95-raised" style={{ padding: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
                <span>Repulsion:</span>
                <span style={{ color: '#0000ff' }}>{-gravity}</span>
              </div>
              <input 
                type="range" 
                min="50" 
                max="1000"
                value={-gravity}
                style={{ width: '100%', cursor: 'pointer' }}
                onChange={(e) => {
                  setGravity(-Number(e.target.value));
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#666' }}>
                <span>50</span>
                <span>1000</span>
              </div>
            </div>

            {/* Link Distance Slider */}
            <div className="win95-raised" style={{ padding: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
                <span>Link Distance:</span>
                <span style={{ color: '#0000ff' }}>{linkDistance}</span>
              </div>
              <input 
                type="range" 
                min="30" 
                max="300"
                value={linkDistance}
                style={{ width: '100%', cursor: 'pointer' }}
                onChange={(e) => {
                  setLinkDistance(Number(e.target.value));
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#666' }}>
                <span>30</span>
                <span>300</span>
              </div>
            </div>

            {/* Collision Cushion Slider */}
            <div className="win95-raised" style={{ padding: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '4px' }}>
                <span>Collision Cushion:</span>
                <span style={{ color: '#0000ff' }}>{collisionRadius}</span>
              </div>
              <input 
                type="range" 
                min="5" 
                max="50"
                value={collisionRadius}
                style={{ width: '100%', cursor: 'pointer' }}
                onChange={(e) => {
                  setCollisionRadius(Number(e.target.value));
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#666' }}>
                <span>5</span>
                <span>50</span>
              </div>
            </div>
            </>)}
          </div>
        )}
      </div>
    </div>
  );
}

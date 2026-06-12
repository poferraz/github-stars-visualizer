// Deterministic radial ("spider web") layout.
// Pins node positions via d3 fx/fy: the root sits at the origin, category hubs
// sit on an inner ring, and repo nodes fill concentric orbit rings inside
// their category's angular sector (most-starred repos on the innermost orbit).
// Same input always produces the same positions, so filter changes never
// destroy the user's mental map.

const CATEGORY_RING_MIN = 140; // minimum radius of the category hub ring
const CATEGORY_ARC_SPACING = 78; // arc px reserved per hub (node + label)
const FIRST_ORBIT_GAP = 110; // gap between hub ring and first repo orbit
const ORBIT_GAP = 58; // gap between successive repo orbits
const NODE_ARC_SPACING = 30; // arc px reserved per repo node on an orbit
const SECTOR_PADDING = 0.05; // radians trimmed from each sector edge

export function applyRadialLayout(graphData) {
  const { nodes, links } = graphData;

  const root = nodes.find((n) => n.type === 'root');
  const categories = nodes.filter((n) => n.type === 'category');
  const repos = nodes.filter((n) => n.type === 'repo');
  if (categories.length === 0) return { orbitRadii: [] };

  if (root) {
    root.fx = 0;
    root.fy = 0;
  }

  // Group repos by category via belongs_to links. Links may hold plain ids or
  // node references (force-graph swaps ids for objects after first render).
  const categoryOf = new Map();
  links.forEach((l) => {
    if (l.type !== 'belongs_to') return;
    const source = typeof l.source === 'object' ? l.source.id : l.source;
    const target = typeof l.target === 'object' ? l.target.id : l.target;
    categoryOf.set(source, target);
  });

  const members = new Map(categories.map((c) => [c.id, []]));
  repos.forEach((r) => {
    const cat = categoryOf.get(r.id);
    if (members.has(cat)) members.get(cat).push(r);
  });

  // Angular sectors proportional to member count, sqrt-dampened so huge
  // categories don't crush small ones, with a floor so every hub gets room.
  const weights = categories.map(
    (c) => Math.sqrt(Math.max(members.get(c.id).length, 1)) + 0.5
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const categoryRadius = Math.max(
    CATEGORY_RING_MIN,
    (categories.length * CATEGORY_ARC_SPACING) / (2 * Math.PI)
  );
  const orbitRadii = new Set([categoryRadius]);

  let angle = -Math.PI / 2; // start at 12 o'clock
  categories.forEach((cat, i) => {
    const sector = (weights[i] / totalWeight) * 2 * Math.PI;
    const a0 = angle + SECTOR_PADDING;
    const a1 = angle + sector - SECTOR_PADDING;
    const mid = angle + sector / 2;

    cat.fx = Math.cos(mid) * categoryRadius;
    cat.fy = Math.sin(mid) * categoryRadius;

    const sorted = [...members.get(cat.id)].sort(
      (x, y) => (y.stars || 0) - (x.stars || 0)
    );

    let radius = categoryRadius + FIRST_ORBIT_GAP;
    let placed = 0;
    while (placed < sorted.length) {
      const span = Math.max(a1 - a0, 0.1);
      const capacity = Math.max(1, Math.floor((span * radius) / NODE_ARC_SPACING));
      const take = Math.min(capacity, sorted.length - placed);
      for (let k = 0; k < take; k++) {
        const t = take === 1 ? 0.5 : k / (take - 1);
        const a = a0 + t * span;
        const node = sorted[placed + k];
        node.fx = Math.cos(a) * radius;
        node.fy = Math.sin(a) * radius;
      }
      orbitRadii.add(radius);
      placed += take;
      radius += ORBIT_GAP;
    }

    angle += sector;
  });

  return { orbitRadii: [...orbitRadii].sort((a, b) => a - b) };
}

// Unpin all nodes so the d3 force simulation can take over again.
export function clearRadialLayout(graphData) {
  graphData.nodes.forEach((n) => {
    delete n.fx;
    delete n.fy;
  });
}

import { describe, it, expect } from 'vitest';
import { applyRadialLayout, clearRadialLayout } from '../radialLayout';
import { buildGraphData } from '../graphBuilder';

function makeRepo(name, stars, language = 'JavaScript') {
  return {
    full_name: `owner/${name}`,
    name,
    description: `${name} description`,
    language,
    stargazers_count: stars,
    html_url: `https://github.com/owner/${name}`
  };
}

function makeAnalysis(repos, category) {
  const analysis = {};
  repos.forEach(r => {
    analysis[r.full_name] = { category, summary: 's', related: [] };
  });
  return analysis;
}

describe('Radial (spider web) layout', () => {
  const reposA = Array.from({ length: 4 }, (_, i) => makeRepo(`alpha-${i}`, (i + 1) * 10));
  const reposB = Array.from({ length: 4 }, (_, i) => makeRepo(`beta-${i}`, (i + 1) * 5));
  const aiAnalysis = {
    ...makeAnalysis(reposA, 'Alpha Tools'),
    ...makeAnalysis(reposB, 'Beta Tools')
  };

  function build() {
    return buildGraphData([...reposA, ...reposB], aiAnalysis, { rootName: 'tester' });
  }

  it('pins the root node at the origin', () => {
    const graphData = build();
    applyRadialLayout(graphData);

    const root = graphData.nodes.find(n => n.type === 'root');
    expect(root.fx).toBe(0);
    expect(root.fy).toBe(0);
  });

  it('places all category hubs on a single inner ring', () => {
    const graphData = build();
    const { orbitRadii } = applyRadialLayout(graphData);

    const hubs = graphData.nodes.filter(n => n.type === 'category');
    const radii = hubs.map(h => Math.hypot(h.fx, h.fy));

    radii.forEach(r => expect(r).toBeCloseTo(radii[0], 5));
    expect(radii[0]).toBeCloseTo(orbitRadii[0], 5);
  });

  it('places repos on orbits outside the category ring, inside their own sector', () => {
    const graphData = build();
    applyRadialLayout(graphData);

    const hubs = graphData.nodes.filter(n => n.type === 'category');
    const hubRadius = Math.hypot(hubs[0].fx, hubs[0].fy);

    graphData.nodes.filter(n => n.type === 'repo').forEach(repo => {
      expect(Math.hypot(repo.fx, repo.fy)).toBeGreaterThan(hubRadius);

      // Same half-plane as the owning hub: with two equal sectors, a repo's
      // position vector must point the same way as its category hub's
      const catId = graphData.links.find(
        l => l.type === 'belongs_to' && l.source === repo.id
      ).target;
      const hub = hubs.find(h => h.id === catId);
      const dot = repo.fx * hub.fx + repo.fy * hub.fy;
      expect(dot).toBeGreaterThan(0);
    });
  });

  it('orders repos so the most-starred sit on the innermost orbit', () => {
    const manyRepos = Array.from({ length: 120 }, (_, i) => makeRepo(`solo-${i}`, i));
    const graphData = buildGraphData(manyRepos, makeAnalysis(manyRepos, 'Solo'), { rootName: 'tester' });
    const { orbitRadii } = applyRadialLayout(graphData);

    // 120 repos cannot fit one orbit (~51 capacity): layout must spill outward
    expect(orbitRadii.length).toBeGreaterThan(2); // hub ring + 2+ orbits

    const top = graphData.nodes.find(n => n.id === 'owner/solo-119');
    const bottom = graphData.nodes.find(n => n.id === 'owner/solo-0');
    expect(Math.hypot(top.fx, top.fy)).toBeLessThanOrEqual(Math.hypot(bottom.fx, bottom.fy));
  });

  it('is deterministic: identical input produces identical positions', () => {
    const a = build();
    const b = build();
    applyRadialLayout(a);
    applyRadialLayout(b);

    a.nodes.forEach((node, i) => {
      expect(node.fx).toBeCloseTo(b.nodes[i].fx, 10);
      expect(node.fy).toBeCloseTo(b.nodes[i].fy, 10);
    });
  });

  it('clearRadialLayout unpins every node', () => {
    const graphData = build();
    applyRadialLayout(graphData);
    clearRadialLayout(graphData);

    graphData.nodes.forEach(n => {
      expect(n.fx).toBeUndefined();
      expect(n.fy).toBeUndefined();
    });
  });

  it('handles links whose endpoints were resolved to node objects', () => {
    const graphData = build();
    // Simulate force-graph swapping ids for node references
    const byId = new Map(graphData.nodes.map(n => [n.id, n]));
    graphData.links.forEach(l => {
      l.source = byId.get(l.source);
      l.target = byId.get(l.target);
    });

    applyRadialLayout(graphData);
    graphData.nodes.forEach(n => {
      expect(Number.isFinite(n.fx)).toBe(true);
      expect(Number.isFinite(n.fy)).toBe(true);
    });
  });
});

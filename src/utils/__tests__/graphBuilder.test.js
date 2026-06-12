import { describe, it, expect } from 'vitest';
import { buildGraphData } from '../graphBuilder';

describe('Graph Data Builder Utility', () => {
  const mockRepos = [
    {
      full_name: 'owner/repo-a',
      name: 'repo-a',
      description: 'A cool web framework',
      language: 'JavaScript',
      stargazers_count: 100,
      html_url: 'https://github.com/owner/repo-a'
    },
    {
      full_name: 'owner/repo-b',
      name: 'repo-b',
      description: 'Validation library',
      language: 'TypeScript',
      stargazers_count: 50,
      html_url: 'https://github.com/owner/repo-b'
    }
  ];

  const mockAiAnalysis = {
    'owner/repo-a': {
      category: 'Web Frameworks',
      summary: 'A fast JavaScript framework.',
      related: ['owner/repo-b']
    },
    'owner/repo-b': {
      category: 'Utilities',
      summary: 'A validation helper library.',
      related: []
    }
  };

  it('should build nodes and links from repositories and AI analysis', () => {
    const graphData = buildGraphData(mockRepos, mockAiAnalysis);

    expect(graphData).toHaveProperty('nodes');
    expect(graphData).toHaveProperty('links');

    // Expected nodes: 2 repos + 2 category nodes = 4 nodes total
    expect(graphData.nodes).toHaveLength(4);

    const repoNodes = graphData.nodes.filter(n => n.type === 'repo');
    const categoryNodes = graphData.nodes.filter(n => n.type === 'category');

    expect(repoNodes).toHaveLength(2);
    expect(categoryNodes).toHaveLength(2);

    // Categories nodes should have unique IDs matching the categories
    const categoryIds = categoryNodes.map(c => c.id);
    expect(categoryIds).toContain('Web Frameworks');
    expect(categoryIds).toContain('Utilities');

    // Expected links: 
    // - repo-a to category 'Web Frameworks'
    // - repo-b to category 'Utilities'
    // - repo-a semantic link to repo-b
    expect(graphData.links).toHaveLength(3);

    const categoryLinks = graphData.links.filter(l => l.type === 'belongs_to');
    const semanticLinks = graphData.links.filter(l => l.type === 'semantic_connection');

    expect(categoryLinks).toHaveLength(2);
    expect(semanticLinks).toHaveLength(1);
    
    expect(semanticLinks[0]).toEqual({
      source: 'owner/repo-a',
      target: 'owner/repo-b',
      type: 'semantic_connection'
    });
  });

  it('should fallback to Uncategorized for repos missing AI analysis', () => {
    const graphData = buildGraphData(mockRepos, {}); // empty AI analysis

    expect(graphData.nodes.filter(n => n.type === 'category')[0].id).toBe('Uncategorized');
    expect(graphData.links.filter(l => l.type === 'belongs_to')).toHaveLength(2);
  });

  it('should filter repositories by language and minStars', () => {
    const filters = { languages: ['TypeScript'], minStars: 80 };
    const graphData = buildGraphData(mockRepos, mockAiAnalysis, filters);

    // repo-a is JavaScript (100 stars) - excluded by language
    // repo-b is TypeScript (50 stars) - excluded by minStars
    expect(graphData.nodes.filter(n => n.type === 'repo')).toHaveLength(0);
    expect(graphData.nodes.filter(n => n.type === 'category')).toHaveLength(0);
  });

  it('should add a root node linked to every category when rootName is provided', () => {
    const graphData = buildGraphData(mockRepos, mockAiAnalysis, { rootName: 'octocat' });

    const root = graphData.nodes.find(n => n.type === 'root');
    expect(root).toBeDefined();
    expect(root.id).toBe('__root__');
    expect(root.name).toBe('octocat');

    const rootLinks = graphData.links.filter(l => l.type === 'root_link');
    expect(rootLinks).toHaveLength(2); // one per category
    expect(rootLinks.every(l => l.source === '__root__')).toBe(true);
  });

  it('should not add a root node without rootName or when no repos survive filters', () => {
    expect(buildGraphData(mockRepos, mockAiAnalysis).nodes.find(n => n.type === 'root')).toBeUndefined();
    expect(
      buildGraphData(mockRepos, mockAiAnalysis, { rootName: 'octocat', minStars: 99999 })
        .nodes.find(n => n.type === 'root')
    ).toBeUndefined();
  });

  it('should give each category a distinct color and repos their category color', () => {
    const graphData = buildGraphData(mockRepos, mockAiAnalysis);

    const categoryNodes = graphData.nodes.filter(n => n.type === 'category');
    const colors = new Set(categoryNodes.map(c => c.color));
    expect(colors.size).toBe(categoryNodes.length); // all distinct

    const repoA = graphData.nodes.find(n => n.id === 'owner/repo-a');
    const webFrameworks = categoryNodes.find(c => c.id === 'Web Frameworks');
    expect(repoA.color).toBe(webFrameworks.color);
    expect(repoA.languageColor).toBeDefined();
  });

  it('should keep Uncategorized grey and color assignment stable across repo order', () => {
    const uncategorized = buildGraphData(mockRepos, {}).nodes.find(n => n.type === 'category');
    expect(uncategorized.id).toBe('Uncategorized');
    expect(uncategorized.color).toBe('#9aa0a6');

    const forward = buildGraphData(mockRepos, mockAiAnalysis);
    const reversed = buildGraphData([...mockRepos].reverse(), mockAiAnalysis);
    const colorOf = (gd, id) => gd.nodes.find(n => n.id === id).color;
    expect(colorOf(forward, 'Web Frameworks')).toBe(colorOf(reversed, 'Web Frameworks'));
    expect(colorOf(forward, 'Utilities')).toBe(colorOf(reversed, 'Utilities'));
  });

  it('should handle case-insensitive lookups and resolve semantic links with mismatched casing', () => {
    const reposWithDifferentCasing = [
      {
        full_name: 'Owner/Repo-A',
        name: 'Repo-A',
        description: 'A cool web framework',
        language: 'JavaScript',
        stargazers_count: 100,
        html_url: 'https://github.com/Owner/Repo-A'
      },
      {
        full_name: 'owner/repo-b',
        name: 'repo-b',
        description: 'Validation library',
        language: 'TypeScript',
        stargazers_count: 50,
        html_url: 'https://github.com/owner/repo-b'
      }
    ];

    const aiAnalysisWithMismatchedCasing = {
      // Key with lowercase casing, but original was Owner/Repo-A
      'owner/repo-a': {
        category: 'Web Frameworks',
        summary: 'A fast JavaScript framework.',
        related: ['Owner/Repo-B'] // Mismatched casing: Owner/Repo-B vs owner/repo-b
      },
      // Key with exact casing
      'owner/repo-b': {
        category: 'Utilities',
        summary: 'A validation helper library.',
        related: []
      }
    };

    const graphData = buildGraphData(reposWithDifferentCasing, aiAnalysisWithMismatchedCasing);

    // Verify nodes: Category nodes should be resolved correctly
    const categoryNodes = graphData.nodes.filter(n => n.type === 'category');
    const categoryIds = categoryNodes.map(c => c.id);
    expect(categoryIds).toContain('Web Frameworks');
    expect(categoryIds).toContain('Utilities');

    // Verify links: Semantic link should be resolved case-insensitively,
    // and both source and target in the link must use their exact original casing.
    const semanticLinks = graphData.links.filter(l => l.type === 'semantic_connection');
    expect(semanticLinks).toHaveLength(1);
    expect(semanticLinks[0]).toEqual({
      source: 'Owner/Repo-A',
      target: 'owner/repo-b',
      type: 'semantic_connection'
    });
  });
});

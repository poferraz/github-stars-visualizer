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
});

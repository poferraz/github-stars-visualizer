import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeStars } from '../aiAnalysis';
import { aiRouter } from '../aiRouter';

vi.mock('../aiRouter', () => ({
  aiRouter: {
    sendMessage: vi.fn()
  }
}));

describe('AI Stars Analysis Coordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return an empty analysis if no repositories are provided', async () => {
    const result = await analyzeStars({ repositories: [] });
    expect(result.analysis).toEqual({});
    expect(result.meta).toEqual({ total: 0, analyzed: 0, batches: 0, failedBatches: 0 });
    expect(aiRouter.sendMessage).not.toHaveBeenCalled();
  });

  it('should successfully parse raw JSON response', async () => {
    const mockResponse = JSON.stringify({
      'owner/repo': {
        category: 'Web Dev',
        summary: 'A framework.',
        related: []
      }
    });

    aiRouter.sendMessage.mockResolvedValueOnce(mockResponse);

    const result = await analyzeStars({
      repositories: [{ full_name: 'owner/repo', description: 'desc', language: 'JS' }],
      provider: 'gemini',
      apiKey: 'key',
      model: 'model'
    });

    expect(result.analysis).toHaveProperty('owner/repo');
    expect(result.analysis['owner/repo'].category).toBe('Web Dev');
  });

  it('should successfully extract JSON wrapped in markdown codeblocks', async () => {
    const mockResponse = `
    \`\`\`json
    {
      "owner/repo": {
        "category": "Web Dev",
        "summary": "A framework.",
        "related": []
      }
    }
    \`\`\`
    `;

    aiRouter.sendMessage.mockResolvedValueOnce(mockResponse);

    const result = await analyzeStars({
      repositories: [{ full_name: 'owner/repo', description: 'desc', language: 'JS' }],
      provider: 'gemini',
      apiKey: 'key',
      model: 'model'
    });

    expect(result.analysis).toHaveProperty('owner/repo');
    expect(result.analysis['owner/repo'].category).toBe('Web Dev');
  });

  it('should successfully parse JSON containing trailing commas and conversational text', async () => {
    const mockResponse = `Here is your JSON response:
    {
      "owner/repo": {
        "category": "Web Dev",
        "summary": "A framework.",
        "related": [],
      },
    }
    Hope this helps!`;

    aiRouter.sendMessage.mockResolvedValueOnce(mockResponse);

    const result = await analyzeStars({
      repositories: [{ full_name: 'owner/repo', description: 'desc', language: 'JS' }],
      provider: 'gemini',
      apiKey: 'key',
      model: 'model'
    });

    expect(result.analysis).toHaveProperty('owner/repo');
    expect(result.analysis['owner/repo'].category).toBe('Web Dev');
  });

  it('should call onProgress callback with correct stages', async () => {
    const mockResponse = JSON.stringify({
      'owner/repo1': {
        category: 'Frontend Tools',
        summary: 'A library.',
        related: ['owner/repo2']
      },
      'owner/repo2': {
        category: 'Backend Tools',
        summary: 'A framework.',
        related: []
      }
    });

    aiRouter.sendMessage.mockResolvedValueOnce(mockResponse);

    const onProgress = vi.fn();

    await analyzeStars({
      repositories: [
        { full_name: 'owner/repo1', description: 'desc', language: 'JS' },
        { full_name: 'owner/repo2', description: 'desc2', language: 'TS' }
      ],
      provider: 'gemini',
      apiKey: 'key',
      model: 'model',
      onProgress
    });

    expect(onProgress).toHaveBeenCalled();
    const logs = onProgress.mock.calls.map(call => call[0]);
    expect(logs.some(l => l.includes('Frontend Tools'))).toBe(true);
    expect(logs.some(l => l.includes('Backend Tools'))).toBe(true);
    expect(logs.some(l => l.includes('1 semantic connection'))).toBe(true);
  });

  it('should fallback gracefully to language-based categories and default structures if JSON is completely invalid', async () => {
    aiRouter.sendMessage.mockResolvedValueOnce('This is not JSON at all');

    const result = await analyzeStars({
      repositories: [{ full_name: 'owner/repo', description: 'desc', language: 'JavaScript' }],
      provider: 'gemini',
      apiKey: 'key',
      model: 'model'
    });

    expect(result.analysis).toHaveProperty('owner/repo');
    expect(result.analysis['owner/repo'].category).toBe('JavaScript');
    expect(result.analysis['owner/repo'].summary).toBe('desc');
    expect(result.analysis['owner/repo'].related).toEqual([]);
  });

  it('should recover using heuristic parsing when JSON has unescaped newlines and invalid relations', async () => {
    const malformedResponse = `
    {
      "owner/repo1": {
        "category": "Frontend Frameworks",
        "summary": "This is a multiline summary.
        It has unescaped newlines.",
        "related": ["owner/repo2"]
      },
      "owner/repo2": {
        "category": "Backend Tools",
        "summary": "Some backend tool.",
        "related": ["nonexistent/repo"]
      }
    }
    `;

    aiRouter.sendMessage.mockResolvedValueOnce(malformedResponse);

    const result = await analyzeStars({
      repositories: [
        { full_name: 'owner/repo1', description: 'desc1', language: 'JS' },
        { full_name: 'owner/repo2', description: 'desc2', language: 'TS' }
      ],
      provider: 'gemini',
      apiKey: 'key',
      model: 'model'
    });

    expect(result.analysis).toHaveProperty('owner/repo1');
    expect(result.analysis['owner/repo1'].category).toBe('Frontend Frameworks');
    expect(result.analysis['owner/repo1'].related).toEqual(['owner/repo2']);
    
    expect(result.analysis).toHaveProperty('owner/repo2');
    // Ensure nonexistent relation got filtered out to prevent crash
    expect(result.analysis['owner/repo2'].related).toEqual([]);
  });

  it('should handle case-insensitive lookups and normalize related repos casing in aiAnalysis', async () => {
    const mockResponse = JSON.stringify({
      // Key is lowercased compared to the original casing 'Owner/Repo1'
      'owner/repo1': {
        category: 'Frontend Tools',
        summary: 'A library.',
        related: ['owner/repo2'] // Casing is lowercased compared to the original 'Owner/Repo2'
      },
      'owner/repo2': {
        category: 'Backend Tools',
        summary: 'A framework.',
        related: []
      }
    });

    aiRouter.sendMessage.mockResolvedValueOnce(mockResponse);

    const result = await analyzeStars({
      repositories: [
        { full_name: 'Owner/Repo1', description: 'desc', language: 'JS' },
        { full_name: 'Owner/Repo2', description: 'desc2', language: 'TS' }
      ],
      provider: 'gemini',
      apiKey: 'key',
      model: 'model'
    });

    expect(result.analysis).toHaveProperty('Owner/Repo1');
    expect(result.analysis['Owner/Repo1'].category).toBe('Frontend Tools');
    // Casing of the related repo should be normalized to the original 'Owner/Repo2'
    expect(result.analysis['Owner/Repo1'].related).toEqual(['Owner/Repo2']);
  });

  it('should recover and normalize casing using heuristic parsing when JSON is malformed and has mismatched casing', async () => {
    const malformedResponse = `
    {
      "owner/repo1": {
        "category": "Frontend Frameworks",
        "summary": "This is a multiline summary.
        It has unescaped newlines.",
        "related": ["owner/repo2"]
      },
      "owner/repo2": {
        "category": "Backend Tools",
        "summary": "Some backend tool.",
        "related": []
      }
    }
    `;

    aiRouter.sendMessage.mockResolvedValueOnce(malformedResponse);

    const result = await analyzeStars({
      repositories: [
        { full_name: 'Owner/Repo1', description: 'desc1', language: 'JS' },
        { full_name: 'Owner/Repo2', description: 'desc2', language: 'TS' }
      ],
      provider: 'gemini',
      apiKey: 'key',
      model: 'model'
    });

    expect(result.analysis).toHaveProperty('Owner/Repo1');
    expect(result.analysis['Owner/Repo1'].category).toBe('Frontend Frameworks');
    // Casing should be normalized using heuristicParse
    expect(result.analysis['Owner/Repo1'].related).toEqual(['Owner/Repo2']);
  });

  describe('Batched analysis', () => {
    const makeRepos = (count) =>
      Array.from({ length: count }, (_, i) => ({
        full_name: `owner/repo-${i}`,
        description: `desc ${i}`,
        language: 'JS'
      }));

    const batchResponse = (repos, category) =>
      JSON.stringify(
        Object.fromEntries(
          repos.map(r => [r.full_name, { category, summary: 's', related: [] }])
        )
      );

    it('splits repos into batches and merges the results', async () => {
      const repos = makeRepos(4);
      aiRouter.sendMessage
        .mockResolvedValueOnce(batchResponse(repos.slice(0, 2), 'Cat A'))
        .mockResolvedValueOnce(batchResponse(repos.slice(2, 4), 'Cat B'));

      const result = await analyzeStars({
        repositories: repos,
        provider: 'gemini',
        apiKey: 'key',
        model: 'model',
        batchSize: 2,
        retryDelayMs: 0
      });

      expect(aiRouter.sendMessage).toHaveBeenCalledTimes(2);
      expect(result.analysis['owner/repo-0'].category).toBe('Cat A');
      expect(result.analysis['owner/repo-3'].category).toBe('Cat B');
      expect(result.meta).toEqual({ total: 4, analyzed: 4, batches: 2, failedBatches: 0 });
    });

    it('nudges later batches to reuse categories from earlier ones', async () => {
      const repos = makeRepos(4);
      aiRouter.sendMessage
        .mockResolvedValueOnce(batchResponse(repos.slice(0, 2), 'Frontend Tools'))
        .mockResolvedValueOnce(batchResponse(repos.slice(2, 4), 'Frontend Tools'));

      await analyzeStars({
        repositories: repos,
        provider: 'gemini',
        apiKey: 'key',
        model: 'model',
        batchSize: 2,
        retryDelayMs: 0
      });

      const firstPrompt = aiRouter.sendMessage.mock.calls[0][0].prompt;
      const secondPrompt = aiRouter.sendMessage.mock.calls[1][0].prompt;
      expect(firstPrompt).not.toContain('REUSE these existing category names');
      expect(secondPrompt).toContain('REUSE these existing category names');
      expect(secondPrompt).toContain('Frontend Tools');
    });

    it('retries a failed batch once before giving up', async () => {
      const repos = makeRepos(2);
      aiRouter.sendMessage
        .mockRejectedValueOnce(new Error('flaky network'))
        .mockResolvedValueOnce(batchResponse(repos, 'Cat A'));

      const result = await analyzeStars({
        repositories: repos,
        provider: 'gemini',
        apiKey: 'key',
        model: 'model',
        retryDelayMs: 0
      });

      expect(aiRouter.sendMessage).toHaveBeenCalledTimes(2);
      expect(result.meta.failedBatches).toBe(0);
      expect(result.analysis['owner/repo-0'].category).toBe('Cat A');
    });

    it('reports a partial result when one batch fails both attempts', async () => {
      const repos = makeRepos(4);
      aiRouter.sendMessage
        .mockResolvedValueOnce(batchResponse(repos.slice(0, 2), 'Cat A'))
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom again'));

      const onProgress = vi.fn();
      const result = await analyzeStars({
        repositories: repos,
        provider: 'gemini',
        apiKey: 'key',
        model: 'model',
        batchSize: 2,
        retryDelayMs: 0,
        onProgress
      });

      expect(result.meta).toEqual({ total: 4, analyzed: 2, batches: 2, failedBatches: 1 });
      // Failed batch falls back to language defaults — never silently missing
      expect(result.analysis['owner/repo-2']).toEqual({
        category: 'JS',
        summary: 'desc 2',
        related: []
      });
      const warnings = onProgress.mock.calls.filter(c => c[1] === 'warning').map(c => c[0]);
      expect(warnings.some(w => w.includes('Batch 2/2 failed after retry'))).toBe(true);
    });
  });
});

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

  it('should return empty object if no repositories are provided', async () => {
    const result = await analyzeStars({ repositories: [] });
    expect(result).toEqual({});
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

    expect(result).toHaveProperty('owner/repo');
    expect(result['owner/repo'].category).toBe('Web Dev');
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

    expect(result).toHaveProperty('owner/repo');
    expect(result['owner/repo'].category).toBe('Web Dev');
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

    expect(result).toHaveProperty('owner/repo');
    expect(result['owner/repo'].category).toBe('Web Dev');
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

  it('should throw an error if JSON is completely invalid', async () => {
    aiRouter.sendMessage.mockResolvedValueOnce('This is not JSON at all');

    await expect(
      analyzeStars({
        repositories: [{ full_name: 'owner/repo', description: 'desc', language: 'JS' }],
        provider: 'gemini',
        apiKey: 'key',
        model: 'model'
      })
    ).rejects.toThrow('AI did not return a valid JSON format.');
  });
});

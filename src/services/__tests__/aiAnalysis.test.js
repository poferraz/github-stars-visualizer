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

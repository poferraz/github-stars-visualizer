import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiRouter } from '../aiRouter';
import { rateLimiter } from '../rateLimiter';

// Mock rateLimiter
vi.mock('../rateLimiter', () => ({
  rateLimiter: {
    checkLimit: vi.fn(),
    increment: vi.fn()
  }
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Universal AI Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('should throw an error if no API key is provided', async () => {
    await expect(
      aiRouter.sendMessage({
        provider: 'gemini',
        apiKey: '',
        model: 'gemini-2.5-flash',
        prompt: 'test'
      })
    ).rejects.toThrow('API Key is required.');
  });

  it('should consult the rateLimiter before calling fetch', async () => {
    rateLimiter.checkLimit.mockImplementationOnce(() => {
      throw new Error('Local limit exceeded');
    });

    await expect(
      aiRouter.sendMessage({
        provider: 'gemini',
        apiKey: 'fake-key',
        model: 'gemini-2.5-flash',
        prompt: 'test'
      })
    ).rejects.toThrow('Local limit exceeded');

    expect(rateLimiter.checkLimit).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should successfully make a request to Gemini and increment the rateLimiter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: '{"categories": []}' }]
            }
          }
        ]
      })
    });

    const response = await aiRouter.sendMessage({
      provider: 'gemini',
      apiKey: 'gemini-fake-key',
      model: 'gemini-2.5-flash',
      prompt: 'Summarize these stars'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=gemini-fake-key'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' })
      })
    );
    expect(rateLimiter.increment).toHaveBeenCalledTimes(1);
    expect(response).toBe('{"categories": []}');
  });

  it('should successfully make a request to OpenRouter', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OpenRouter response' } }]
      })
    });

    const response = await aiRouter.sendMessage({
      provider: 'openrouter',
      apiKey: 'openrouter-fake-key',
      model: 'google/gemini-2.5-flash',
      prompt: 'Summarize these stars'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer openrouter-fake-key',
          'Content-Type': 'application/json'
        })
      })
    );
    expect(response).toBe('OpenRouter response');
  });

  it('should intercept HTTP 429 Rate Limit responses and throw a detailed error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests'
    });

    await expect(
      aiRouter.sendMessage({
        provider: 'gemini',
        apiKey: 'fake-key',
        model: 'gemini-2.5-flash',
        prompt: 'test'
      })
    ).rejects.toThrow('API rate limit reached (HTTP 429).');
  });
});

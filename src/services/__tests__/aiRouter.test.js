import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

describe('Universal AI Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => vi.unstubAllGlobals());

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
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-goog-api-key': 'gemini-fake-key'
        })
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
        redirect: 'error',
        credentials: 'omit',
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

  it('should successfully make a request to the custom provider via the proxy', async () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://stars.example.test',
        protocol: 'https:'
      }
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Custom proxy response' } }]
      })
    });

    const response = await aiRouter.sendMessage({
      provider: 'custom',
      apiKey: 'custom-fake-key',
      model: 'test-model',
      prompt: 'Summarize these stars',
      customUrl: 'https://api.openai.com/v1/chat/completions'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://stars.example.test/api/ai-proxy',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: JSON.stringify({
          targetUrl: 'https://api.openai.com/v1/chat/completions',
          apiKey: 'custom-fake-key',
          model: 'test-model',
          prompt: 'Summarize these stars'
        })
      })
    );
    expect(response).toBe('Custom proxy response');
  });

  it.each([
    ['openai', 'https://api.openai.com/v1/chat/completions'],
    ['groq', 'https://api.groq.com/openai/v1/chat/completions']
  ])('uses the built-in %s endpoint when an old custom setting exists', async (provider, endpoint) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hello' } }] })
    });
    await aiRouter.sendMessage({
      provider, apiKey: 'test-key', prompt: 'hello', customUrl: 'https://example.org/old-setting'
    });
    expect(mockFetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({ redirect: 'error' }));
  });

  it('rejects an unlisted custom endpoint before sending the key to the relay', async () => {
    await expect(aiRouter.sendMessage({
      provider: 'custom', apiKey: 'test-key', prompt: 'hello', customUrl: 'https://example.org/chat'
    })).rejects.toThrow('Choose a supported provider endpoint.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('requires HTTPS for the browser-to-relay request', async () => {
    vi.stubGlobal('window', { location: new URL('http://example.org') });
    await expect(aiRouter.sendMessage({
      provider: 'custom', apiKey: 'test-key', prompt: 'hello', customUrl: 'https://api.openai.com/v1/chat/completions'
    })).rejects.toThrow('Open this app over HTTPS');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('reports a provider error without reading its diagnostics', async () => {
    const json = vi.fn();
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json });
    await expect(aiRouter.sendMessage({
      provider: 'openai', apiKey: 'test-key', prompt: 'hello'
    })).rejects.toThrow('API request failed with status 401.');
    expect(json).not.toHaveBeenCalled();
    expect(rateLimiter.increment).not.toHaveBeenCalled();
  });
});

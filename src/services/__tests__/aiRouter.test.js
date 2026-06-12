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
globalThis.fetch = mockFetch;

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
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-goog-api-key': 'gemini-fake-key'
        })
      })
    );
    // Key must never appear in the URL (URLs get logged by proxies/CDNs)
    expect(mockFetch.mock.calls[0][0]).not.toContain('gemini-fake-key');
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

  it('should make a request to OpenAI with Bearer auth and json response format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OpenAI response' } }]
      })
    });

    const response = await aiRouter.sendMessage({
      provider: 'openai',
      apiKey: 'openai-fake-key',
      model: 'gpt-4o-mini',
      prompt: 'Summarize these stars'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Authorization': 'Bearer openai-fake-key' })
      })
    );
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(response).toBe('OpenAI response');
  });

  it('should make a request to Groq with Bearer auth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Groq response' } }]
      })
    });

    const response = await aiRouter.sendMessage({
      provider: 'groq',
      apiKey: 'groq-fake-key',
      model: 'llama3-8b-8192',
      prompt: 'Summarize these stars'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Authorization': 'Bearer groq-fake-key' })
      })
    );
    expect(response).toBe('Groq response');
  });

  it('should call the custom endpoint directly (no proxy)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Custom response' } }]
      })
    });

    const response = await aiRouter.sendMessage({
      provider: 'custom',
      apiKey: 'custom-fake-key',
      model: 'gpt-oss:20b',
      prompt: 'Summarize these stars',
      customUrl: 'http://localhost:11434/v1/chat/completions'
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Authorization': 'Bearer custom-fake-key' }),
        body: JSON.stringify({
          model: 'gpt-oss:20b',
          messages: [{ role: 'user', content: 'Summarize these stars' }]
        })
      })
    );
    expect(response).toBe('Custom response');
  });

  it('should allow a keyless custom endpoint (e.g. local Ollama) and omit auth', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Ollama response' } }]
      })
    });

    const response = await aiRouter.sendMessage({
      provider: 'custom',
      apiKey: '',
      model: 'llama3',
      prompt: 'test',
      customUrl: 'http://localhost:11434/v1/chat/completions'
    });

    expect(mockFetch.mock.calls[0][1].headers['Authorization']).toBeUndefined();
    expect(response).toBe('Ollama response');
  });

  it('should reject the custom provider without an API Base URL', async () => {
    await expect(
      aiRouter.sendMessage({
        provider: 'custom',
        apiKey: 'k',
        model: 'm',
        prompt: 'test',
        customUrl: ''
      })
    ).rejects.toThrow('Custom provider requires an API Base URL');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should wrap network failures with context', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(
      aiRouter.sendMessage({
        provider: 'gemini',
        apiKey: 'fake-key',
        model: 'gemini-2.5-flash',
        prompt: 'test'
      })
    ).rejects.toThrow('Network error calling AI service: Failed to fetch');
    expect(rateLimiter.increment).not.toHaveBeenCalled();
  });
});

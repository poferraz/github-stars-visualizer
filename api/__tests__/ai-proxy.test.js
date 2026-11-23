import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../ai-proxy.js';
import { CUSTOM_ENDPOINTS } from '../../src/services/providerEndpoints.js';

const approved = 'https://api.openai.com/v1/chat/completions';

describe('AI provider relay', () => {
  let req;
  let res;
  let mockFetch;

  beforeEach(() => {
    req = {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: { targetUrl: approved, apiKey: 'test-key', model: 'test-model', prompt: 'test' }
    };
    res = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      end: vi.fn()
    };
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(CUSTOM_ENDPOINTS)('sends chat requests to %s without following redirects', async targetUrl => {
    req.body.targetUrl = targetUrl;
    const reply = { choices: [{ message: { content: 'hello' } }] };
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => reply });

    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledWith(targetUrl, {
      method: 'POST',
      redirect: 'error',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-key' },
      body: JSON.stringify({ model: 'test-model', messages: [{ role: 'user', content: 'test' }] })
    });
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(reply);
  });

  it.each([
    'http://api.openai.com/v1/chat/completions',
    'https://example.org/v1/chat/completions',
    'https://api.openai.com:8443/v1/chat/completions',
    'https://api.openai.com/v1/models',
    approved + '?view=compact',
    'https://visitor@api.openai.com/v1/chat/completions'
  ])('rejects an unlisted endpoint before sending anything', async targetUrl => {
    req.body.targetUrl = targetUrl;
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each(['model', 'apiKey', 'prompt'])('requires a nonempty %s', async name => {
    req.body[name] = ' ';
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('requires JSON for browser requests', async () => {
    req.headers = { 'content-type': 'text/plain' };
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(415);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('preserves a provider error status and omits its diagnostics', async () => {
    const json = vi.fn();
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, json });
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'The provider rejected the request.' });
    expect(json).not.toHaveBeenCalled();
  });

  it('returns a generic error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('provider diagnostics'));
    await handler(req, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: 'Could not complete the provider request.' });
  });
});

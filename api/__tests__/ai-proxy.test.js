import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../ai-proxy';

describe('AI Proxy Security & Routing Gate', () => {
  let req;
  let res;
  let headers;
  let statusCode;
  let jsonBody;
  let ended;

  beforeEach(() => {
    headers = {};
    statusCode = 200;
    jsonBody = null;
    ended = false;

    res = {
      setHeader: vi.fn((k, v) => {
        headers[k] = v;
      }),
      status: vi.fn((code) => {
        statusCode = code;
        return res;
      }),
      json: vi.fn((body) => {
        jsonBody = body;
        return res;
      }),
      end: vi.fn(() => {
        ended = true;
        return res;
      })
    };
  });

  it('rejects SSRF attempts targeting cloud metadata endpoints (169.254.169.254)', async () => {
    req = {
      method: 'POST',
      body: {
        targetUrl: 'http://169.254.169.254/latest/meta-data/',
        prompt: 'test'
      }
    };

    await handler(req, res);

    expect(statusCode).toBe(403);
    expect(jsonBody).toEqual({ error: 'Upstream destination host not permitted' });
  });

  it('rejects SSRF attempts targeting localhost and internal networks', async () => {
    req = {
      method: 'POST',
      body: {
        targetUrl: 'http://localhost:8080/admin',
        prompt: 'test'
      }
    };

    await handler(req, res);

    expect(statusCode).toBe(403);
    expect(jsonBody).toEqual({ error: 'Upstream destination host not permitted' });
  });

  it('rejects arbitrary unauthorized internet domains', async () => {
    req = {
      method: 'POST',
      body: {
        targetUrl: 'https://attacker-controlled-server.com/api',
        prompt: 'test'
      }
    };

    await handler(req, res);

    expect(statusCode).toBe(403);
    expect(jsonBody).toEqual({ error: 'Upstream destination host not permitted' });
  });

  it('allows approved AI providers (e.g. OpenAI)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'hello' } }] })
    });
    global.fetch = mockFetch;

    req = {
      method: 'POST',
      body: {
        targetUrl: 'https://api.openai.com/v1/chat/completions',
        apiKey: 'sk-test-key',
        model: 'gpt-4o-mini',
        prompt: 'say hi'
      }
    };

    await handler(req, res);

    expect(statusCode).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test-key'
        })
      })
    );
  });
});

import { rateLimiter } from './rateLimiter';
import { CHAT_ENDPOINTS, CUSTOM_ENDPOINTS } from './providerEndpoints.js';

export const aiRouter = {
  async sendMessage({ provider, apiKey, model, prompt, customUrl = '' }) {
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      throw new Error('API Key is required.');
    }

    rateLimiter.checkLimit();

    let url;
    const headers = {
      'Content-Type': 'application/json'
    };
    let body;

    switch (provider) {
      case 'gemini': {
        const selectedModel = model || 'gemini-2.5-flash';
        url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent`;
        headers['x-goog-api-key'] = apiKey;
        body = {
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        };
        break;
      }
      case 'openrouter': {
        url = CHAT_ENDPOINTS.openrouter;
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['HTTP-Referer'] = typeof window !== 'undefined' ? (window.location?.origin || 'https://github-stars-visualizer.local') : 'https://github-stars-visualizer.local';
        headers['X-Title'] = 'GitStars Visualizer';
        body = {
          model: model || 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        };
        break;
      }
      case 'openai': {
        url = CHAT_ENDPOINTS.openai;
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = {
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        };
        break;
      }
      case 'groq': {
        url = CHAT_ENDPOINTS.groq;
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = {
          model: model || 'llama3-8b-8192',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        };
        break;
      }
      case 'custom': {
        if (!CUSTOM_ENDPOINTS.includes(customUrl)) {
          throw new Error('Choose a supported provider endpoint.');
        }
        if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
          throw new Error('Open this app over HTTPS to use the provider relay.');
        }
        url = `${window.location.origin}/api/ai-proxy`;
        body = {
          targetUrl: customUrl,
          apiKey,
          model,
          prompt
        };
        break;
      }
      default:
        throw new Error('Choose a supported AI provider.');
    }

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        credentials: 'omit',
        headers,
        body: JSON.stringify(body)
      });
    } catch {
      throw new Error('Could not reach the AI service.');
    }

    if (response.status === 429) {
      throw new Error('API rate limit reached (HTTP 429). Please wait a bit before trying again.');
    }

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}.`);
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('The AI provider returned an invalid response.');
    }
    const text = provider === 'gemini'
      ? data?.candidates?.[0]?.content?.parts?.[0]?.text
      : data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      throw new Error('The AI provider returned an invalid response.');
    }

    rateLimiter.increment();

    return text;
  }
};

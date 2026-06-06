import { rateLimiter } from './rateLimiter';

export const aiRouter = {
  async sendMessage({ provider, apiKey, model, prompt, customUrl = '' }) {
    if (!apiKey) {
      throw new Error('API Key is required.');
    }

    // 1. Guard check for local rate limiting
    rateLimiter.checkLimit();

    let url = '';
    let headers = {
      'Content-Type': 'application/json'
    };
    let body = {};

    switch (provider) {
      case 'gemini': {
        const selectedModel = model || 'gemini-2.5-flash';
        url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
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
        url = 'https://openrouter.ai/api/v1/chat/completions';
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
        url = customUrl || 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = {
          model: model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        };
        break;
      }
      case 'groq': {
        url = 'https://api.groq.com/openai/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = {
          model: model || 'llama3-8b-8192',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        };
        break;
      }
      case 'custom': {
        url = customUrl;
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = {
          model: model,
          messages: [{ role: 'user', content: prompt }]
        };
        break;
      }
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }

    // 2. Execute fetch
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
    } catch (err) {
      throw new Error(`Network error calling AI service: ${err.message}`);
    }

    // 3. Handle rate limits & HTTP errors
    if (response.status === 429) {
      throw new Error('API rate limit reached (HTTP 429). Please wait a bit before trying again.');
    }

    if (!response.ok) {
      let errorMsg = `API request failed with status ${response.status}`;
      try {
        const errJson = await response.json();
        errorMsg += `: ${errJson.error?.message || errJson.message || JSON.stringify(errJson)}`;
      } catch (e) {
        // Fallback to text status
        errorMsg += ` (${response.statusText})`;
      }
      throw new Error(errorMsg);
    }

    // 4. Parse response
    const data = await response.json();
    let text = '';

    if (provider === 'gemini') {
      try {
        text = data.candidates[0].content.parts[0].text;
      } catch (err) {
        throw new Error('Invalid response structure received from Gemini API.');
      }
    } else {
      // Chat completion style (OpenRouter, OpenAI, Groq, Custom)
      try {
        text = data.choices[0].message.content;
      } catch (err) {
        throw new Error('Invalid chat completions structure received from AI provider.');
      }
    }

    // 5. Increment rate limiter on success
    rateLimiter.increment();

    return text;
  }
};

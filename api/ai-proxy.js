import { CUSTOM_ENDPOINTS } from '../src/services/providerEndpoints.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const contentType = req.headers?.['content-type'];
  if (typeof contentType !== 'string' || contentType.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return res.status(415).json({ error: 'Send a JSON request.' });
  }

  const { targetUrl, apiKey, model, prompt } = req.body || {};
  if (!CUSTOM_ENDPOINTS.includes(targetUrl)) {
    return res.status(403).json({ error: 'Choose a supported provider endpoint.' });
  }
  if (![apiKey, model, prompt].every(value => typeof value === 'string' && value.trim())) {
    return res.status(400).json({ error: 'A provider key, model and prompt are required.' });
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      redirect: 'error',
      credentials: 'omit',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] })
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'The provider rejected the request.' });
    }
    const data = await upstream.json();
    if (typeof data?.choices?.[0]?.message?.content !== 'string') {
      return res.status(502).json({ error: 'The provider returned an invalid chat response.' });
    }
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: 'Could not complete the provider request.' });
  }
}

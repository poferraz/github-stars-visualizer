import { CUSTOM_ENDPOINTS } from './providerEndpoints.js';

const SETTINGS_KEY = 'gitstars_settings';

const defaultModels = {
  gemini: 'gemini-2.5-flash',
  openrouter: 'google/gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  groq: 'llama3-8b-8192',
  custom: ''
};

export const defaultSettings = {
  username: '',
  githubToken: '',
  maxStars: 50,
  provider: 'gemini',
  apiKey: '',
  model: defaultModels.gemini,
  customUrl: ''
};

function preferences(settings) {
  const provider = Object.hasOwn(defaultModels, settings?.provider) ? settings.provider : defaultSettings.provider;
  return {
    username: typeof settings?.username === 'string' ? settings.username : '',
    maxStars: [30, 50, 100, 150, 300].includes(settings?.maxStars) ? settings.maxStars : defaultSettings.maxStars,
    provider,
    model: typeof settings?.model === 'string' ? settings.model : defaultModels[provider],
    customUrl: CUSTOM_ENDPOINTS.includes(settings?.customUrl) ? settings.customUrl : ''
  };
}

export function forgetPreferences() {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // Browser storage can be disabled.
  }
}

export function savePreferences(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences(settings)));
  } catch {
    // If migration cannot replace a legacy record, remove it instead.
    forgetPreferences();
  }
}

export function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return { ...defaultSettings };
    const safe = preferences(JSON.parse(stored));
    if (stored !== JSON.stringify(safe)) savePreferences(safe);
    return { ...defaultSettings, ...safe };
  } catch {
    forgetPreferences();
    return { ...defaultSettings };
  }
}

export function changeDestination(settings, provider, customUrl) {
  if (settings.provider === provider && settings.customUrl === customUrl) return settings;
  return {
    ...settings,
    provider,
    customUrl,
    model: provider !== settings.provider && provider !== 'custom' ? defaultModels[provider] : settings.model,
    apiKey: ''
  };
}

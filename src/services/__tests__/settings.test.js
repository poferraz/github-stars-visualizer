import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ENDPOINTS } from '../providerEndpoints.js';
import { changeDestination, defaultSettings, loadSettings, savePreferences } from '../settings.js';

const storageKey = 'gitstars_settings';

describe('settings privacy', () => {
  let store;
  beforeEach(() => {
    store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: key => store.delete(key)
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('stores only preferences and forgets keys on reload', () => {
    const draft = { ...defaultSettings, username: 'octocat', githubToken: 'fixture-one', apiKey: 'fixture-two' };
    savePreferences(draft);
    expect(JSON.parse(store.get(storageKey))).toEqual({
      username: 'octocat', maxStars: 50, provider: 'gemini', model: 'gemini-2.5-flash', customUrl: ''
    });
    expect(draft.apiKey).toBe('fixture-two');
    expect(loadSettings()).toEqual({ ...defaultSettings, username: 'octocat' });
  });

  it('scrubs legacy keys and unknown fields before restoring preferences', () => {
    const safe = { username: 'octocat', provider: 'custom', model: 'custom-model', maxStars: 150, customUrl: CUSTOM_ENDPOINTS[0] };
    store.set(storageKey, JSON.stringify({ ...safe, githubToken: 'fixture-one', apiKey: 'fixture-two', extra: 'discard' }));
    expect(loadSettings()).toEqual({ ...defaultSettings, ...safe });
    expect(JSON.parse(store.get(storageKey))).toEqual(safe);
  });

  it('discards unrecognized legacy endpoints and malformed saved data', () => {
    store.set(storageKey, JSON.stringify({ provider: 'custom', customUrl: 'https://example.invalid/?key=fixture' }));
    expect(loadSettings().customUrl).toBe('');
    expect(store.get(storageKey)).not.toContain('fixture');
    store.set(storageKey, '{incomplete');
    expect(loadSettings()).toEqual(defaultSettings);
    expect(store.has(storageKey)).toBe(false);
  });

  it('removes the legacy record if storage cannot rewrite it', () => {
    store.set(storageKey, JSON.stringify({ username: 'octocat', apiKey: 'fixture' }));
    localStorage.setItem = () => { throw new Error('Quota exceeded'); };
    expect(loadSettings()).toEqual({ ...defaultSettings, username: 'octocat' });
    expect(store.has(storageKey)).toBe(false);
  });

  it('clears the key on provider and endpoint changes, including switching back', () => {
    const custom = { ...defaultSettings, provider: 'custom', customUrl: CUSTOM_ENDPOINTS[0], apiKey: 'fixture' };
    const moved = changeDestination(custom, 'custom', CUSTOM_ENDPOINTS[1]);
    expect(moved).toMatchObject({ customUrl: CUSTOM_ENDPOINTS[1], apiKey: '' });
    expect(changeDestination(moved, 'custom', CUSTOM_ENDPOINTS[0]).apiKey).toBe('');
    expect(changeDestination(custom, 'openai', custom.customUrl)).toMatchObject({ provider: 'openai', model: 'gpt-4o-mini', apiKey: '' });
  });
});

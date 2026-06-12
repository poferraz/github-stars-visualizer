import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../storage';

function makeLocalStorageMock() {
  let store = {};
  return {
    getItem: vi.fn((k) => (k in store ? store[k] : null)),
    setItem: vi.fn((k, v) => {
      store[k] = String(v);
    }),
    removeItem: vi.fn((k) => {
      delete store[k];
    }),
    key: vi.fn((i) => Object.keys(store)[i] ?? null),
    get length() {
      return Object.keys(store).length;
    },
    _store: () => store,
    _reset: () => {
      store = {};
    }
  };
}

const ls = makeLocalStorageMock();
vi.stubGlobal('localStorage', ls);

describe('Storage wrapper', () => {
  beforeEach(() => {
    ls._reset();
    vi.clearAllMocks();
  });

  it('writes and reads namespaced values', () => {
    expect(storage.write('settings', { a: 1 })).toBe(true);
    expect(ls._store()['gitstars.v2.settings']).toBe('{"a":1}');
    expect(storage.read('settings', null)).toEqual({ a: 1 });
  });

  it('returns the fallback for missing keys and corrupt JSON', () => {
    expect(storage.read('missing', 'fb')).toBe('fb');
    ls._store()['gitstars.v2.broken'] = '{not json';
    expect(storage.read('broken', 'fb')).toBe('fb');
  });

  it('returns the fallback when validation rejects the stored shape', () => {
    storage.write('repos', { not: 'an array' });
    expect(storage.read('repos', [], Array.isArray)).toEqual([]);
    storage.write('repos', [1, 2]);
    expect(storage.read('repos', [], Array.isArray)).toEqual([1, 2]);
  });

  it('migrates legacy pre-v2 keys forward without deleting them', () => {
    ls._store()['gitstars_settings'] = '{"username":"old"}';

    expect(storage.read('settings', null)).toEqual({ username: 'old' });
    expect(ls._store()['gitstars.v2.settings']).toBe('{"username":"old"}');
    expect(ls._store()['gitstars_settings']).toBe('{"username":"old"}'); // rollback safety
  });

  it('drops bulky caches and retries once when the quota is exceeded', () => {
    ls._store()['gitstars.v2.repos'] = '[…big…]';
    let failures = 1;
    ls.setItem.mockImplementation((k, v) => {
      if (failures > 0) {
        failures -= 1;
        throw new DOMException('quota', 'QuotaExceededError');
      }
      ls._store()[k] = String(v);
    });

    expect(storage.write('settings', { a: 1 })).toBe(true);
    expect(ls._store()['gitstars.v2.repos']).toBeUndefined();
    expect(ls._store()['gitstars.v2.settings']).toBe('{"a":1}');
  });

  it('resetApp clears every gitstars key (v2, legacy, rate limiter) and nothing else', () => {
    ls._store()['gitstars.v2.settings'] = '{}';
    ls._store()['gitstars_cached_repos'] = '[]';
    ls._store()['gitstars_rl_minute_count'] = '3';
    ls._store()['unrelated_app_key'] = 'keep me';

    storage.resetApp();

    expect(Object.keys(ls._store())).toEqual(['unrelated_app_key']);
  });
});

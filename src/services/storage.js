// Namespaced, validated localStorage wrapper. Every persistent key the app
// owns goes through here so resets stay scoped, reads are schema-checked,
// and quota failures degrade gracefully instead of throwing mid-flow.

const PREFIX = 'gitstars.v2.';

// Pre-v2 key names. Reads fall back to these once and migrate the value
// forward; the legacy keys are left in place for one release so a rollback
// to the previous version still finds its data.
const LEGACY_KEYS = {
  settings: 'gitstars_settings',
  repos: 'gitstars_cached_repos',
  ai: 'gitstars_cached_ai'
};

export const storage = {
  read(key, fallback, validate) {
    try {
      let raw = localStorage.getItem(PREFIX + key);
      if (raw === null && LEGACY_KEYS[key]) {
        raw = localStorage.getItem(LEGACY_KEYS[key]);
        if (raw !== null) {
          localStorage.setItem(PREFIX + key, raw);
        }
      }
      if (raw === null) return fallback;

      const value = JSON.parse(raw);
      if (validate && !validate(value)) return fallback;
      return value;
    } catch {
      return fallback;
    }
  },

  write(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      return true;
    } catch {
      // Quota exceeded (large star caches): drop the bulky caches and retry
      // once — settings are small and must win over cached data
      try {
        localStorage.removeItem(PREFIX + 'repos');
        localStorage.removeItem(PREFIX + 'ai');
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
      if (LEGACY_KEYS[key]) localStorage.removeItem(LEGACY_KEYS[key]);
    } catch {
      // storage unavailable: nothing to remove
    }
  },

  // Clears every key this app owns (v2, legacy, rate limiter — all share the
  // "gitstars" prefix) and nothing else. Replaces the old localStorage.clear()
  // which nuked unrelated data on the origin.
  resetApp() {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('gitstars')) doomed.push(k);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
    } catch {
      // storage unavailable: nothing to reset
    }
  }
};

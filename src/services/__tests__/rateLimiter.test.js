import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimiter } from '../rateLimiter';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
globalThis.localStorage = localStorageMock;

describe('Local Rate Limiter Security Guard', () => {
  beforeEach(() => {
    localStorage.clear();
    rateLimiter.reset();
    vi.useFakeTimers();
  });

  it('should allow requests when under the limit', () => {
    expect(() => rateLimiter.checkLimit()).not.toThrow();
  });

  it('should block requests when the minute limit (15 requests/min) is exceeded', () => {
    // Make 15 successful checks
    for (let i = 0; i < 15; i++) {
      rateLimiter.increment();
    }
    
    // The 16th check should throw a rate limit error
    expect(() => rateLimiter.checkLimit()).toThrow('Local limit exceeded: 15 requests per minute.');
  });

  it('should allow requests again after a minute passes', () => {
    for (let i = 0; i < 15; i++) {
      rateLimiter.increment();
    }
    
    expect(() => rateLimiter.checkLimit()).toThrow();
    
    // Forward time by 61 seconds
    vi.advanceTimersByTime(61000);
    
    expect(() => rateLimiter.checkLimit()).not.toThrow();
  });

  it('should block requests when the daily limit (1500 requests/day) is exceeded', () => {
    // Let's set up the state to simulate 1500 daily requests
    // We increment across multiple minutes to avoid the minute block
    for (let i = 0; i < 1500; i++) {
      // Bypass the minute counter check in our test helper or simulate directly
      rateLimiter.forceIncrementDailyOnly();
    }
    
    expect(() => rateLimiter.checkLimit()).toThrow('Local limit exceeded: 1500 requests per day.');
  });
});

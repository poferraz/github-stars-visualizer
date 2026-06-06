const LIMIT_MINUTES = 15;
const LIMIT_DAILY = 1500;
const ONE_MINUTE = 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;

export const rateLimiter = {
  checkLimit() {
    const now = Date.now();
    
    // Check minute limit
    const minStart = this._getLocalStorageNum('gitstars_rl_minute_timestamp', now);
    const minCount = this._getLocalStorageNum('gitstars_rl_minute_count', 0);
    
    if (now - minStart < ONE_MINUTE) {
      if (minCount >= LIMIT_MINUTES) {
        throw new Error(`Local limit exceeded: ${LIMIT_MINUTES} requests per minute.`);
      }
    }

    // Check daily limit
    const dayStart = this._getLocalStorageNum('gitstars_rl_daily_timestamp', now);
    const dayCount = this._getLocalStorageNum('gitstars_rl_daily_count', 0);
    
    if (now - dayStart < ONE_DAY) {
      if (dayCount >= LIMIT_DAILY) {
        throw new Error(`Local limit exceeded: ${LIMIT_DAILY} requests per day.`);
      }
    }
  },

  increment() {
    const now = Date.now();
    
    // Increment minute bucket
    let minStart = this._getLocalStorageNum('gitstars_rl_minute_timestamp', now);
    let minCount = this._getLocalStorageNum('gitstars_rl_minute_count', 0);
    
    if (now - minStart >= ONE_MINUTE) {
      minStart = now;
      minCount = 0;
    }
    
    minCount += 1;
    localStorage.setItem('gitstars_rl_minute_timestamp', String(minStart));
    localStorage.setItem('gitstars_rl_minute_count', String(minCount));

    // Increment daily bucket
    let dayStart = this._getLocalStorageNum('gitstars_rl_daily_timestamp', now);
    let dayCount = this._getLocalStorageNum('gitstars_rl_daily_count', 0);
    
    if (now - dayStart >= ONE_DAY) {
      dayStart = now;
      dayCount = 0;
    }
    
    dayCount += 1;
    localStorage.setItem('gitstars_rl_daily_timestamp', String(dayStart));
    localStorage.setItem('gitstars_rl_daily_count', String(dayCount));
  },

  forceIncrementDailyOnly() {
    const now = Date.now();
    let dayStart = this._getLocalStorageNum('gitstars_rl_daily_timestamp', now);
    let dayCount = this._getLocalStorageNum('gitstars_rl_daily_count', 0);
    
    if (now - dayStart >= ONE_DAY) {
      dayStart = now;
      dayCount = 0;
    }
    dayCount += 1;
    localStorage.setItem('gitstars_rl_daily_timestamp', String(dayStart));
    localStorage.setItem('gitstars_rl_daily_count', String(dayCount));
  },

  reset() {
    localStorage.removeItem('gitstars_rl_minute_timestamp');
    localStorage.removeItem('gitstars_rl_minute_count');
    localStorage.removeItem('gitstars_rl_daily_timestamp');
    localStorage.removeItem('gitstars_rl_daily_count');
  },

  getStats() {
    const now = Date.now();
    const minStart = this._getLocalStorageNum('gitstars_rl_minute_timestamp', now);
    const minCount = now - minStart < ONE_MINUTE ? this._getLocalStorageNum('gitstars_rl_minute_count', 0) : 0;
    
    const dayStart = this._getLocalStorageNum('gitstars_rl_daily_timestamp', now);
    const dayCount = now - dayStart < ONE_DAY ? this._getLocalStorageNum('gitstars_rl_daily_count', 0) : 0;
    
    return {
      minuteRemaining: Math.max(0, LIMIT_MINUTES - minCount),
      dailyRemaining: Math.max(0, LIMIT_DAILY - dayCount),
      minuteLimit: LIMIT_MINUTES,
      dailyLimit: LIMIT_DAILY
    };
  },

  _getLocalStorageNum(key, fallback) {
    const val = localStorage.getItem(key);
    return val ? Number(val) : fallback;
  }
};

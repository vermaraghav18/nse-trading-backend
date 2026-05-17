/**
 * Zerodha-specific configuration constants
 */

export const ZERODHA_CONFIG = {
  // API endpoints
  BASE_URL: 'https://api.kite.trade',
  LOGIN_URL: 'https://kite.zerodha.com/connect/login',
  
  // Rate limits (official limits from Zerodha)
  RATE_LIMITS: {
    requestsPerSecond: 10,
    requestsPerMinute: 600,
    requestsPerDay: 234000,  // During market hours
  },
  
  // Timeouts
  TIMEOUT_MS: 30000,
  
  // Retry logic
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  
  // WebSocket
  WEBSOCKET: {
    maxInstruments: 3000,
    reconnectDelay: 5000,
  },
  
  // Historical data
  HISTORICAL: {
    maxLookbackDays: 365,
    defaultInterval: 'day',
  },
};

export const ZERODHA_INSTRUMENT_KEYS = {
  // Exchange codes
  NSE_EQ: 'NSE',
  NSE_INDEX: 'NSE',
  
  // Instrument formats
  formatStockKey: (symbol: string) => `NSE:${symbol}`,
  formatIndexKey: (symbol: string) => `NSE:${symbol}`,
};
/**
 * Smart Provider Selector - 33/33/33 Distribution
 * Distributes API calls intelligently across Dhan, Upstox, and Zerodha
 */

import { env } from '../config/env';

export type BrokerType = 'dhan' | 'upstox' | 'zerodha';

interface ProviderConfig {
  historicalData: BrokerType;
  liveQuotes: BrokerType;
  orders: BrokerType;
  holdings: BrokerType;
  positions: BrokerType;
  funds: BrokerType;
}

// Stock distribution based on alphabetical order
const CUSTOM_STOCK_RANGES = {
  dhan: { start: 0, end: 100 },      // First 100 custom stocks
  upstox: { start: 100, end: 200 },  // Middle 100 custom stocks  
  zerodha: { start: 200, end: 292 }  // Last 92 custom stocks
};

// Nifty 50 stocks always use Upstox (free, unlimited)
const NIFTY_50_SYMBOLS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 
  'SBIN', 'BHARTIARTL', 'KOTAKBANK', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI',
  'HCLTECH', 'BAJFINANCE', 'WIPRO', 'ULTRACEMCO', 'TITAN', 'NESTLEIND', 'SUNPHARMA',
  'TECHM', 'ONGC', 'NTPC', 'POWERGRID', 'M&M', 'TATAMOTORS', 'BAJAJFINSV', 'TATASTEEL',
  'ADANIPORTS', 'COALINDIA', 'JSWSTEEL', 'GRASIM', 'HINDALCO', 'INDUSINDBK',
  'CIPLA', 'EICHERMOT', 'HEROMOTOCO', 'DRREDDY', 'APOLLOHOSP', 'DIVISLAB',
  'BRITANNIA', 'BPCL', 'SHREECEM', 'SBILIFE', 'BAJAJ-AUTO', 'TATACONSUM',
  'ADANIENT', 'HDFCLIFE', 'TRENT'
];

/**
 * Determine which broker should handle this stock
 */
export function selectProviderForStock(symbol: string, allCustomStocks: string[]): BrokerType {
  // Nifty 50 always goes to Upstox (free, unlimited)
  if (NIFTY_50_SYMBOLS.includes(symbol)) {
    return 'upstox';
  }

  // Find index in custom stocks list
  const index = allCustomStocks.indexOf(symbol);
  
  if (index === -1) {
    // Symbol not found, default to upstox
    return 'upstox';
  }

  // Distribute based on alphabetical position
  if (index >= CUSTOM_STOCK_RANGES.dhan.start && index < CUSTOM_STOCK_RANGES.dhan.end) {
    return 'dhan';
  } else if (index >= CUSTOM_STOCK_RANGES.upstox.start && index < CUSTOM_STOCK_RANGES.upstox.end) {
    return 'upstox';
  } else {
    return 'zerodha';
  }
}

/**
 * Get provider configuration for specific operations
 */
export function getProviderConfig(): ProviderConfig {
  return {
    // All orders go to Dhan (real-time trading)
    orders: 'dhan',
    
    // Account info goes to Dhan
    holdings: 'dhan',
    positions: 'dhan',
    funds: 'dhan',
    
    // Live quotes distributed by stock
    liveQuotes: 'upstox', // Default, will be overridden per stock
    
    // Historical data distributed by stock
    historicalData: 'zerodha' // Default, will be overridden per stock
  };
}

/**
 * Get provider for historical data based on stock
 */
export function getHistoricalDataProvider(symbol: string, allCustomStocks: string[]): BrokerType {
  // Nifty 50: Upstox (free)
  if (NIFTY_50_SYMBOLS.includes(symbol)) {
    return 'upstox';
  }

  const index = allCustomStocks.indexOf(symbol);
  
  if (index === -1) {
    return 'upstox';
  }

  // Custom stocks 1-100: Dhan
  if (index < 100) {
    return 'dhan';
  }
  // Custom stocks 101-200: Upstox
  else if (index < 200) {
    return 'upstox';
  }
  // Custom stocks 201-292: Zerodha
  else {
    return 'zerodha';
  }
}

/**
 * Get provider for live quotes based on stock
 */
export function getLiveQuoteProvider(symbol: string, allCustomStocks: string[]): BrokerType {
  // Nifty 50: Always Upstox (free, unlimited)
  if (NIFTY_50_SYMBOLS.includes(symbol)) {
    return 'upstox';
  }

  const index = allCustomStocks.indexOf(symbol);
  
  if (index === -1) {
    return 'upstox';
  }

  // Custom stocks 1-100: Dhan WebSocket
  if (index < 100) {
    return 'dhan';
  }
  // Custom stocks 101-200: Upstox
  else if (index < 200) {
    return 'upstox';
  }
  // Custom stocks 201-292: Upstox (live quotes are free)
  else {
    return 'upstox';
  }
}

/**
 * Get provider for intraday data
 */
export function getIntradayDataProvider(symbol: string, allCustomStocks: string[]): BrokerType {
  // All intraday goes to Upstox (free, fast)
  return 'upstox';
}

/**
 * Get provider statistics
 */
export function getProviderDistribution(allCustomStocks: string[]): any {
  const distribution = {
    dhan: { stocks: 0, tasks: [] as string[] },
    upstox: { stocks: 0, tasks: [] as string[] },
    zerodha: { stocks: 0, tasks: [] as string[] }
  };

  // Count Nifty 50
  distribution.upstox.stocks += NIFTY_50_SYMBOLS.length;
  distribution.upstox.tasks.push('Nifty 50 live quotes');

  // Count custom stocks distribution
  allCustomStocks.forEach((symbol, index) => {
    if (index < 100) {
      distribution.dhan.stocks++;
    } else if (index < 200) {
      distribution.upstox.stocks++;
    } else {
      distribution.zerodha.stocks++;
    }
  });

  // Add task assignments
  distribution.dhan.tasks.push(
    'Orders (all)',
    'Holdings/Positions/Funds',
    'Custom stocks 1-100 (live WebSocket)',
    'Custom stocks 1-100 (historical)'
  );

  distribution.upstox.tasks.push(
    'Nifty 50 (all operations)',
    'Custom stocks 101-200 (all operations)',
    'All intraday data',
    'Market scanning'
  );

  distribution.zerodha.tasks.push(
    'Custom stocks 201-292 (historical)',
    'Backtesting data',
    'Strategy calculations'
  );

  return distribution;
}

/**
 * Check if broker is enabled
 */
export function isBrokerEnabled(broker: BrokerType): boolean {
  switch (broker) {
    case 'dhan':
      return env.dhan.enabled;
    case 'upstox':
      return true; // Always available
    case 'zerodha':
      return env.zerodha.enabled;
    default:
      return false;
  }
}

/**
 * Log provider selection (for debugging)
 */
export function logProviderSelection(symbol: string, provider: BrokerType, operation: string): void {
  console.log(`[provider-selector] ${operation}: ${symbol} → ${provider.toUpperCase()}`);
}
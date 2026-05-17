/**
 * API Provider Configuration
 * Defines which data provider (Upstox or Zerodha) to use for each feature
 */

export enum DataProvider {
  UPSTOX = 'upstox',
  ZERODHA = 'zerodha',
  AUTO = 'auto',  // Smart routing based on stock type
}

export interface ProviderConfig {
  // Free features (Upstox)
  nifty50LiveData: DataProvider;
  dashboardQuickView: DataProvider;
  liveMarketPolling: DataProvider;
  instrumentSearch: DataProvider;
  quickQuotes: DataProvider;
  
  // Paid features (Zerodha)
  customStocksHistorical: DataProvider;
  bulkHistoricalFetch: DataProvider;
  paperTradingData: DataProvider;
  
  // Smart routing
  stockDetails: DataProvider;
  ohlcData: DataProvider;
  historicalCandles: DataProvider;
}

export const API_PROVIDER_CONFIG: ProviderConfig = {
  // FREE UPSTOX - Keep for these
  nifty50LiveData: DataProvider.UPSTOX,
  dashboardQuickView: DataProvider.UPSTOX,
  liveMarketPolling: DataProvider.UPSTOX,
  instrumentSearch: DataProvider.UPSTOX,
  quickQuotes: DataProvider.UPSTOX,
  
  // PAID ZERODHA - Use for these
  customStocksHistorical: DataProvider.ZERODHA,
  bulkHistoricalFetch: DataProvider.ZERODHA,
  paperTradingData: DataProvider.ZERODHA,
  
  // AUTO - Smart routing
  stockDetails: DataProvider.AUTO,
  ohlcData: DataProvider.AUTO,
  historicalCandles: DataProvider.AUTO,
};

export const STOCK_DISTRIBUTION = {
  // Nifty 50 stays on Upstox (free)
  nifty50UseUpstox: true,
  
  // Custom stocks use Zerodha (paid)
  customStocksUseZerodha: true,
};

export const ZERODHA_RATE_LIMITS = {
  maxCallsPerDay: 5000,          // Conservative limit (actual: 234k)
  maxCallsPerHour: 200,           // ~8 calls/minute
  maxCallsPerMinute: 10,          // Official limit
  enableTracking: true,
  alertThreshold: 0.8,            // Alert at 80% usage
  enableThrottling: true,
};
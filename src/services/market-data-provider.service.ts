/**
 * Market Data Provider Service - SMART 33/33/33 DISTRIBUTION
 * Routes requests to Dhan, Upstox, or Zerodha based on intelligent distribution
 */

import { env } from "../config/env";
import { 
  getHistoricalDataProvider, 
  logProviderSelection 
} from "./provider-selector.service";
import { getRateLimiter } from "./unified-rate-limiter.service";

// Upstox imports
import { fetchUpstoxDailyCandles } from "../integrations/upstox/candles.client";
import { fetchUpstox1HCandles } from "../integrations/upstox/intraday-1h.client";
import { fetchUpstoxCurrentDayOhlc } from "../integrations/upstox/ohlc.client";

// Zerodha imports
import { 
  fetchDailyCandles as fetchZerodhaDailyCandles,
  fetchHourlyCandles as fetchZerodhaHourlyCandles 
} from "../integrations/zerodha/historical.client";
import { isZerodhaAuthenticated } from "../integrations/zerodha/zerodha.client";

// Dhan imports
import axios from 'axios';

const rateLimiter = getRateLimiter();

// Get all custom stocks for provider selection
let allCustomStocks: string[] = [];
let dhanAccessToken: string | null = null;

export function setCustomStocksList(stocks: string[]): void {
  allCustomStocks = stocks.sort();
  console.log(`[market-data-provider] Loaded ${stocks.length} custom stocks for distribution`);
}

export function setDhanAccessToken(token: string): void {
  dhanAccessToken = token;
}

/**
 * Extract symbol from instrument key
 */
function extractSymbolFromInstrumentKey(instrumentKey: string): string {
  const parts = instrumentKey.split("|");
  if (parts.length === 2) {
    return parts[1];
  }
  return instrumentKey;
}

/**
 * Fetch daily historical candles - SMART DISTRIBUTION
 */
export async function fetchDailyCandles(
  instrumentKey: string,
  toDate: string,
  fromDate: string,
  provider?: string,
  symbol?: string
): Promise<any> {
  const tradingSymbol = symbol || extractSymbolFromInstrumentKey(instrumentKey);
  
  const selectedProvider = getHistoricalDataProvider(tradingSymbol, allCustomStocks);
  logProviderSelection(tradingSymbol, selectedProvider, 'Historical Daily');

  switch (selectedProvider) {
    case 'dhan':
      return fetchDailyFromDhan(instrumentKey, tradingSymbol, fromDate, toDate);
    
    case 'zerodha':
      return fetchDailyFromZerodha(instrumentKey, tradingSymbol, fromDate, toDate);
    
    case 'upstox':
    default:
      return fetchDailyFromUpstox(instrumentKey, toDate, fromDate);
  }
}

/**
 * Fetch hourly candles - SMART DISTRIBUTION
 */
export async function fetchHourlyCandles(
  instrumentKey: string,
  toDate: string,
  fromDate: string,
  provider?: string,
  symbol?: string
): Promise<any> {
  const tradingSymbol = symbol || extractSymbolFromInstrumentKey(instrumentKey);
  
  const selectedProvider = getHistoricalDataProvider(tradingSymbol, allCustomStocks);
  logProviderSelection(tradingSymbol, selectedProvider, 'Historical Hourly');

  switch (selectedProvider) {
    case 'dhan':
      return fetchHourlyFromDhan(instrumentKey, tradingSymbol, fromDate, toDate);
    
    case 'zerodha':
      return fetchHourlyFromZerodha(instrumentKey, tradingSymbol, fromDate, toDate);
    
    case 'upstox':
    default:
      return fetchHourlyFromUpstox(instrumentKey, toDate, fromDate);
  }
}

/**
 * Fetch current day OHLC - Uses Upstox (free, unlimited)
 */
export async function fetchCurrentDayOHLC(
  instrumentKeys: string[],
  provider?: string,
  symbols?: string[]
): Promise<any> {
  return fetchUpstoxCurrentDayOhlc(instrumentKeys);
}

// ========== DHAN FETCHERS ==========

async function fetchDailyFromDhan(
  instrumentKey: string,
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<any> {
  if (!env.dhan.enabled || !dhanAccessToken) {
    console.warn(`[market-data-provider] Dhan unavailable for ${symbol}, using Upstox`);
    return fetchUpstoxDailyCandles(instrumentKey, toDate, fromDate);
  }

  return rateLimiter.addToQueue(
    'dhan',
    async () => {
      try {
        const params = new URLSearchParams({
          exchange: 'NSE',
          securityId: symbol,
          interval: 'D',
          fromDate,
          toDate
        });
        
        const response = await axios.get(`https://api.dhan.co/v1/charts/historical?${params.toString()}`, {
          headers: { 
            Authorization: `Bearer ${dhanAccessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`[market-data-provider] ✅ Dhan daily: ${symbol}`);
        return response.data;
      } catch (error) {
        console.error(`[market-data-provider] Dhan failed for ${symbol}`);
        return fetchUpstoxDailyCandles(instrumentKey, toDate, fromDate);
      }
    },
    'low'
  );
}

async function fetchHourlyFromDhan(
  instrumentKey: string,
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<any> {
  if (!env.dhan.enabled || !dhanAccessToken) {
    console.warn(`[market-data-provider] Dhan unavailable for ${symbol}, using Upstox`);
    return fetchUpstox1HCandles(instrumentKey, toDate, fromDate);
  }

  return rateLimiter.addToQueue(
    'dhan',
    async () => {
      try {
        const params = new URLSearchParams({
          exchange: 'NSE',
          securityId: symbol,
          interval: '60',
          fromDate,
          toDate
        });
        
        const response = await axios.get(`https://api.dhan.co/v1/charts/historical?${params.toString()}`, {
          headers: { 
            Authorization: `Bearer ${dhanAccessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`[market-data-provider] ✅ Dhan hourly: ${symbol}`);
        return response.data;
      } catch (error) {
        console.error(`[market-data-provider] Dhan failed for ${symbol}`);
        return fetchUpstox1HCandles(instrumentKey, toDate, fromDate);
      }
    },
    'low'
  );
}

// ========== ZERODHA FETCHERS ==========

async function fetchDailyFromZerodha(
  instrumentKey: string,
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<any> {
  if (!env.zerodha.enabled || !isZerodhaAuthenticated()) {
    console.warn(`[market-data-provider] Zerodha unavailable for ${symbol}, using Upstox`);
    return fetchUpstoxDailyCandles(instrumentKey, toDate, fromDate);
  }

  return rateLimiter.addToQueue(
    'zerodha',
    async () => {
      try {
        const result = await fetchZerodhaDailyCandles(instrumentKey, symbol, fromDate, toDate);
        console.log(`[market-data-provider] ✅ Zerodha daily: ${symbol}`);
        return result;
      } catch (error) {
        console.error(`[market-data-provider] Zerodha failed for ${symbol}`);
        return fetchUpstoxDailyCandles(instrumentKey, toDate, fromDate);
      }
    },
    'low'
  );
}

async function fetchHourlyFromZerodha(
  instrumentKey: string,
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<any> {
  if (!env.zerodha.enabled || !isZerodhaAuthenticated()) {
    console.warn(`[market-data-provider] Zerodha unavailable for ${symbol}, using Upstox`);
    return fetchUpstox1HCandles(instrumentKey, toDate, fromDate);
  }

  return rateLimiter.addToQueue(
    'zerodha',
    async () => {
      try {
        const result = await fetchZerodhaHourlyCandles(instrumentKey, symbol, fromDate, toDate);
        console.log(`[market-data-provider] ✅ Zerodha hourly: ${symbol}`);
        return result;
      } catch (error) {
        console.error(`[market-data-provider] Zerodha failed for ${symbol}`);
        return fetchUpstox1HCandles(instrumentKey, toDate, fromDate);
      }
    },
    'low'
  );
}

// ========== UPSTOX FETCHERS ==========

async function fetchDailyFromUpstox(
  instrumentKey: string,
  toDate: string,
  fromDate: string
): Promise<any> {
  return fetchUpstoxDailyCandles(instrumentKey, toDate, fromDate);
}

async function fetchHourlyFromUpstox(
  instrumentKey: string,
  toDate: string,
  fromDate: string
): Promise<any> {
  return fetchUpstox1HCandles(instrumentKey, toDate, fromDate);
}
/**
 * Unified Live Data Service
 * Single source of truth for live market data
 * Priority: WebSocket > Live Cache > On-demand fetch
 */

import { 
  getLatestLtpcByInstrument, 
  getLatestMinuteCandlesByInstrument,
  getUpstoxMarketWsStatus 
} from "./upstox-market-ws.service";
import { getCachedLiveCandles } from "./live-market-cache.service";
import { Candle } from "../types/candle.types";

/**
 * Get live price for a stock
 * Checks WebSocket first, then cache
 */
export function getLivePrice(instrumentKey: string): number | null {
  // Try WebSocket first
  const wsData = getLatestLtpcByInstrument(instrumentKey);
  if (wsData?.ltp) {
    return wsData.ltp;
  }
  
  // Fall back to cache
  const cached = getCachedLiveCandles().find(c => c.instrumentKey === instrumentKey);
  return cached?.close || null;
}

/**
 * Get today's OHLC for a stock
 * Builds from WebSocket minute candles if available, otherwise uses cache
 */
export function getLiveOHLC(instrumentKey: string): {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
} | null {
  // Try to build from WebSocket minute candles
  const minuteCandles = getLatestMinuteCandlesByInstrument(instrumentKey);
  
  if (minuteCandles.length > 0) {
    // Build today's OHLC from minute candles
    const open = minuteCandles[0].open;
    const high = Math.max(...minuteCandles.map(c => c.high));
    const low = Math.min(...minuteCandles.map(c => c.low));
    const close = minuteCandles[minuteCandles.length - 1].close;
    const volume = minuteCandles.reduce((sum, c) => sum + c.volume, 0);
    const date = minuteCandles[0].minuteStart.split('T')[0];
    
    return { open, high, low, close, volume, date };
  }
  
  // Fall back to cache
  const cached = getCachedLiveCandles().find(c => c.instrumentKey === instrumentKey);
  if (cached) {
    return {
      open: cached.open,
      high: cached.high,
      low: cached.low,
      close: cached.close,
      volume: cached.volume,
      date: cached.date
    };
  }
  
  return null;
}

/**
 * Get live candle for a stock (full Candle object)
 * Uses WebSocket if available, otherwise cache
 */
export function getLiveCandle(instrumentKey: string): Candle | null {
  const ohlc = getLiveOHLC(instrumentKey);
  if (!ohlc) return null;
  
  // Get symbol from cache (we need it for the Candle object)
  const cached = getCachedLiveCandles().find(c => c.instrumentKey === instrumentKey);
  if (!cached) return null;
  
  return {
    id: cached.id,
    instrumentKey,
    symbol: cached.symbol,
    timeframe: "1D" as const,
    date: ohlc.date,
    open: ohlc.open,
    high: ohlc.high,
    low: ohlc.low,
    close: ohlc.close,
    volume: ohlc.volume
  };
}

/**
 * Get all live candles
 * Merges WebSocket data with cache data
 */
export function getAllLiveCandles(): Candle[] {
  const cachedCandles = getCachedLiveCandles();
  const wsStatus = getUpstoxMarketWsStatus();
  const wsInstruments = new Set(wsStatus.subscribedInstrumentKeys);
  
  // Build result array
  const result: Candle[] = [];
  
  for (const cached of cachedCandles) {
    // If stock is in WebSocket, try to use WebSocket data
    if (wsInstruments.has(cached.instrumentKey)) {
      const wsCandle = getLiveCandle(cached.instrumentKey);
      if (wsCandle) {
        result.push(wsCandle);
        continue;
      }
    }
    
    // Otherwise use cached data
    result.push(cached);
  }
  
  return result;
}

/**
 * Check if a stock is covered by WebSocket
 */
export function isInWebSocket(instrumentKey: string): boolean {
  const wsStatus = getUpstoxMarketWsStatus();
  return wsStatus.subscribedInstrumentKeys.includes(instrumentKey);
}

/**
 * Get list of instruments covered by WebSocket
 */
export function getWebSocketInstruments(): string[] {
  const wsStatus = getUpstoxMarketWsStatus();
  return [...wsStatus.subscribedInstrumentKeys];
}
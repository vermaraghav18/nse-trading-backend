import { Candle } from "../types/candle.types";
import { env } from "../config/env";
import { fetchUpstoxCurrentDayOhlc } from "../integrations/upstox/ohlc.client";
import { refreshLiveBollingerCache } from "./live-bollinger-cache.service";
import { getAllStocks } from "./stock.service";
import { recordAPICall as recordMonitorCall } from "./api-usage-monitor.service";
import { 
  getUpstoxMarketWsStatus, 
  getLatestMinuteCandlesByInstrument 
} from "./upstox-market-ws.service";

const LIVE_OHLC_BATCH_SIZE = 10;

let cachedCandles: Candle[] = [];
let lastCandleRefreshAt: string | null = null;
let isRefreshingCandles = false;

/**
 * Splits items into smaller chunks.
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

/**
 * Finds Upstox quote row for a stock by matching instrument_token.
 */
function findQuoteForStock(
  data: Record<string, any>,
  instrumentKey: string
): any | null {
  for (const quote of Object.values(data || {})) {
    if (quote?.instrument_token === instrumentKey) {
      return quote;
    }
  }

  return null;
}

/**
 * Formats a timestamp into India market date (YYYY-MM-DD).
 */
function formatIndiaMarketDate(timestampMs?: number): string {
  const date = timestampMs ? new Date(timestampMs) : new Date();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
}

/**
 * Builds a candle from WebSocket minute candles
 */
function buildCandleFromWebSocketMinuteCandles(
  stock: any,
  index: number
): Candle | null {
  const minuteCandles = getLatestMinuteCandlesByInstrument(stock.instrumentKey);
  
  if (minuteCandles.length === 0) {
    return null;
  }
  
  // Build today's OHLC from minute candles
  const open = minuteCandles[0].open;
  const high = Math.max(...minuteCandles.map(c => c.high));
  const low = Math.min(...minuteCandles.map(c => c.low));
  const close = minuteCandles[minuteCandles.length - 1].close;
  const volume = minuteCandles.reduce((sum, c) => sum + c.volume, 0);
  const date = minuteCandles[0].minuteStart.split('T')[0];
  
  return {
    id: String(index + 1),
    instrumentKey: stock.instrumentKey,
    symbol: stock.symbol,
    timeframe: "1D" as const,
    date,
    open,
    high,
    low,
    close,
    volume
  };
}

/**
 * Pulls fresh live candles from Upstox for all stocks.
 * OPTIMIZED: Skips stocks already covered by WebSocket and uses their real-time data instead.
 */
export async function refreshLiveCandlesCache(): Promise<void> {
  if (isRefreshingCandles) {
    return;
  }

  isRefreshingCandles = true;

  try {
    const stocks = await getAllStocks();
    
    // Get WebSocket subscribed instruments
    const wsStatus = getUpstoxMarketWsStatus();
    const wsInstruments = new Set(wsStatus.subscribedInstrumentKeys);
    
    // Separate stocks into WebSocket and non-WebSocket
    const wsStocks = stocks.filter(s => wsInstruments.has(s.instrumentKey));
    const nonWsStocks = stocks.filter(s => !wsInstruments.has(s.instrumentKey));
    
    console.log(`[live-cache] WebSocket covers ${wsStocks.length} stocks, fetching ${nonWsStocks.length} via REST API`);
    
    // Only fetch non-WebSocket stocks via REST API
    const stockChunks = chunkArray(nonWsStocks, LIVE_OHLC_BATCH_SIZE);
    const mergedQuotes: Record<string, any> = {};

    for (const chunk of stockChunks) {
      const instrumentKeys = chunk.map((stock) => stock.instrumentKey);
      const startTime = Date.now();
      
      try {
        const response = await fetchUpstoxCurrentDayOhlc(instrumentKeys);
        Object.assign(mergedQuotes, response.data || {});
        
        // Record successful API call
        recordMonitorCall("upstox", "fetchCurrentDayOhlc", true, Date.now() - startTime);
      } catch (error) {
        // Record failed API call
        recordMonitorCall("upstox", "fetchCurrentDayOhlc", false);
        throw error;
      }
    }

    // Build candles for non-WebSocket stocks from REST API data
    const restCandles = nonWsStocks
      .map((stock, index) => {
        const quote = findQuoteForStock(mergedQuotes, stock.instrumentKey);
        const liveOhlc = quote?.live_ohlc;

        if (
          !liveOhlc ||
          typeof liveOhlc.open !== "number" ||
          typeof liveOhlc.high !== "number" ||
          typeof liveOhlc.low !== "number" ||
          typeof liveOhlc.close !== "number"
        ) {
          return null;
        }

        return {
          id: String(index + 1),
          instrumentKey: stock.instrumentKey,
          symbol: stock.symbol,
          timeframe: "1D" as const,
          date: formatIndiaMarketDate(liveOhlc.ts),
          open: liveOhlc.open,
          high: liveOhlc.high,
          low: liveOhlc.low,
          close: liveOhlc.close,
          volume: typeof liveOhlc.volume === "number" ? liveOhlc.volume : 0,
        };
      })
      .filter((item): item is Candle => Boolean(item));
    
    // Build candles for WebSocket stocks from minute candles
    const wsCandles = wsStocks
      .map((stock, index) => buildCandleFromWebSocketMinuteCandles(stock, index + restCandles.length))
      .filter((item): item is Candle => Boolean(item));
    
    // Merge both sets of candles
    const nextCandles = [...restCandles, ...wsCandles];

    if (nextCandles.length > 0) {
      cachedCandles = nextCandles;
      lastCandleRefreshAt = new Date().toISOString();
      
      // Suppress repetitive refresh logs - only log errors
      await refreshLiveBollingerCache();
    } else {
      // Only log warnings, not normal refresh messages
      console.warn("[live-cache] Candle refresh returned 0 rows. Keeping old cache.");
    }
  } catch (error) {
    console.error("[live-cache] Error refreshing candles:", error);
  } finally {
    isRefreshingCandles = false;
  }
}

/**
 * Starts background candle refresh loop.
 */
export async function startLiveMarketCache(): Promise<void> {
  await refreshLiveCandlesCache();

  setInterval(() => {
    refreshLiveCandlesCache().catch((error) => {
      console.error("[live-cache] Interval candle refresh failed:", error);
    });
  }, env.upstoxOhlcPollIntervalMs);
}

/**
 * Returns current cached candles.
 */
export function getCachedLiveCandles(): Candle[] {
  return cachedCandles;
}

/**
 * Returns last candle cache refresh timestamp.
 */
export function getLastCandleRefreshAt(): string | null {
  return lastCandleRefreshAt;
}
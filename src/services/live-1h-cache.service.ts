import { env } from "../config/env";
import { Intraday1HCandle } from "../types/intraday-1h.types";
import { fetchUpstoxIntraday1HCandles } from "../integrations/upstox/intraday-1h.client";
import { refreshHistorical1HSeriesCache, getCachedHistorical1HSeries } from "./market-history-1h-cache.service";
import { runWithConcurrency } from "../utils/promise-pool";
import { getAllStocks } from "./stock.service";

// Single latest candle per stock (for EMA/Bollinger compatibility)
let cached1HCandles: Intraday1HCandle[] = [];

// ALL of today's intraday candles per stock (for chart merging)
let cachedIntraday1HAll: Map<string, [string, number, number, number, number, number, number][]> = new Map();

let last1HRefreshAt: string | null = null;
let isRefreshing1H = false;

const HISTORY_1H_REFRESH_INTERVAL_MS = 1000 * 60 * 60;
const LIVE_1H_REFRESH_INTERVAL_MS = 1000 * 60;
const INTRADAY_FETCH_CONCURRENCY = 2;

async function fetchLiveIntraday1HCandles(): Promise<{
  latestCandles: Intraday1HCandle[];
    allCandlesMap: Map<string, [string, number, number, number, number, number, number][]>;
}> {
  const stocks = await getAllStocks();
  const latestCandles: Intraday1HCandle[] = [];
   const allCandlesMap = new Map<string, [string, number, number, number, number, number, number][]>();


  await runWithConcurrency(
    stocks,
    INTRADAY_FETCH_CONCURRENCY,
    async (stock, index) => {
      try {
        const response = await fetchUpstoxIntraday1HCandles(stock.instrumentKey);
        const candles = response.data?.candles;

        if (!candles || candles.length === 0) {
          return;
        }

        // Store ALL of today's candles for chart merging
        allCandlesMap.set(stock.instrumentKey, candles);

        // Store latest candle for EMA/Bollinger
        const [dateTime, open, high, low, close, volume] = candles[0];
        latestCandles.push({
          id: String(index + 1),
          instrumentKey: stock.instrumentKey,
          symbol: stock.symbol,
          timeframe: "1H" as const,
          dateTime,
          open,
          high,
          low,
          close,
          volume,
        });
      } catch (error) {
        // Silently skip
      }
    }
  );

  return { latestCandles, allCandlesMap };
}

function buildLatest1HCandlesFromHistory(): Intraday1HCandle[] {
  const historicalSeries = getCachedHistorical1HSeries();

  return historicalSeries
    .map((series) => {
      const latestCandle = series.candles[0];
      if (!latestCandle) return null;

      const [dateTime, open, high, low, close, volume] = latestCandle;
      return {
        id: series.id,
        instrumentKey: series.instrumentKey,
        symbol: series.symbol,
        timeframe: "1H" as const,
        dateTime,
        open,
        high,
        low,
        close,
        volume,
      };
    })
    .filter((item): item is Intraday1HCandle => Boolean(item));
}

export async function refreshLive1HCache(): Promise<void> {
  if (isRefreshing1H) return;
  isRefreshing1H = true;

  try {
    const { latestCandles, allCandlesMap } = await fetchLiveIntraday1HCandles();

    if (latestCandles.length > 0) {
      cached1HCandles = latestCandles;
      cachedIntraday1HAll = allCandlesMap;
      last1HRefreshAt = new Date().toISOString();
      console.log(`[live-1h-cache] Live 1H refresh: ${cached1HCandles.length} stocks at ${last1HRefreshAt}`);
    } else {
      const fallbackCandles = buildLatest1HCandlesFromHistory();
      if (fallbackCandles.length > 0) {
        cached1HCandles = fallbackCandles;
        last1HRefreshAt = new Date().toISOString();
        console.log(`[live-1h-cache] Fallback 1H refresh: ${cached1HCandles.length} stocks at ${last1HRefreshAt}`);
      }
    }
  } catch (error) {
    console.error("[live-1h-cache] Failed to refresh 1H candles:", error);
  } finally {
    isRefreshing1H = false;
  }
}

export async function startLive1HCache(): Promise<void> {
  await refreshHistorical1HSeriesCache();
  await refreshLive1HCache();

  setInterval(() => {
    refreshLive1HCache().catch((error) => {
      console.error("[live-1h-cache] Interval 1H refresh failed:", error);
    });
  }, LIVE_1H_REFRESH_INTERVAL_MS);

  setInterval(() => {
    refreshHistorical1HSeriesCache().catch((error) => {
      console.error("[history-1h-cache] Interval 1H history refresh failed:", error);
    });
  }, HISTORY_1H_REFRESH_INTERVAL_MS);
}

export function getCachedLive1HCandles(): Intraday1HCandle[] {
  return cached1HCandles;
}

export function getCachedIntraday1HAll(): Map<string, [string, number, number, number, number, number, number][]> {
  return cachedIntraday1HAll;
}

export function getLast1HRefreshAt(): string | null {
  return last1HRefreshAt;
}
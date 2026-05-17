/**
 * @deprecated This service is REDUNDANT and should not be used.
 * Use getCachedLiveCandles() from live-market-cache.service.ts instead.
 * This file is kept for backward compatibility but will be removed.
 * 
 * REASON: This service fetches the same OHLC data that's already cached
 * by live-market-cache, causing unnecessary duplicate API calls.
 */

import { fetchUpstoxCurrentDayOhlc } from "../integrations/upstox/ohlc.client";
import { Candle, HistoricalCandleSeries } from "../types/candle.types";
import { getAllStocks } from "./stock.service";

const LIVE_OHLC_BATCH_SIZE = 10;

/**
 * Splits array into smaller chunks.
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

/**
 * Converts timestamp millis to YYYY-MM-DD.
 */
function toDateString(ts?: number): string {
  if (!ts) {
    return new Date().toISOString().split("T")[0];
  }

  return new Date(ts).toISOString().split("T")[0];
}

/**
 * Builds fallback candle from historical series.
 */
function buildFallbackCandle(
  series: HistoricalCandleSeries
): Candle | null {
  const latestCandle = series.candles[0];

  if (!latestCandle) {
    return null;
  }

  const [timestamp, open, high, low, close, volume] = latestCandle;

  return {
    id: series.id,
    instrumentKey: series.instrumentKey,
    symbol: series.symbol,
    timeframe: "1D" as const,
    date: timestamp.split("T")[0],
    open,
    high,
    low,
    close,
    volume,
  };
}

/**
 * Returns live current-day 1D OHLC candle rows for stocks.
 * If live data is missing for a symbol, falls back to historical latest candle.
 * 
 * @deprecated Use getCachedLiveCandles() from live-market-cache.service.ts instead.
 * This function makes redundant API calls for data that's already cached.
 */
export async function getLiveCurrentDayCandlesWithFallback(
  historicalSeries: HistoricalCandleSeries[]
): Promise<Candle[]> {
  console.warn('[DEPRECATED] live-ohlc.service.getLiveCurrentDayCandlesWithFallback() is deprecated. Use getCachedLiveCandles() instead.');
  
  const stocks = await getAllStocks();

  if (stocks.length === 0) {
    return historicalSeries
      .map(buildFallbackCandle)
      .filter((item): item is Candle => Boolean(item));
  }

  const stockChunks = chunkArray(stocks, LIVE_OHLC_BATCH_SIZE);
  const mergedLiveData: Record<string, any> = {};

  for (const stockChunk of stockChunks) {
    const instrumentKeys = stockChunk.map((stock) => stock.instrumentKey);

    try {
      const response = await fetchUpstoxCurrentDayOhlc(instrumentKeys);
      Object.assign(mergedLiveData, response.data || {});
    } catch (error) {
      console.error("Failed live OHLC batch fetch:", error);
    }
  }

  return historicalSeries
    .map((series) => {
      const liveQuote = mergedLiveData[series.instrumentKey];
      const liveOhlc = liveQuote?.live_ohlc;

      if (
        liveOhlc &&
        typeof liveOhlc.open === "number" &&
        typeof liveOhlc.high === "number" &&
        typeof liveOhlc.low === "number" &&
        typeof liveOhlc.close === "number"
      ) {
        return {
          id: series.id,
          instrumentKey: series.instrumentKey,
          symbol: series.symbol,
          timeframe: "1D" as const,
          date: toDateString(liveOhlc.ts),
          open: liveOhlc.open,
          high: liveOhlc.high,
          low: liveOhlc.low,
          close: liveOhlc.close,
          volume: typeof liveOhlc.volume === "number" ? liveOhlc.volume : 0,
        };
      }

      return buildFallbackCandle(series);
    })
    .filter((item): item is Candle => Boolean(item));
}
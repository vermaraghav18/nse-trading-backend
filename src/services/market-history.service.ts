import { fetchUpstoxDailyCandles } from "../integrations/upstox/candles.client";
import { HistoricalCandleSeries } from "../types/candle.types";
import { readJsonCacheFile, writeJsonCacheFile } from "../utils/file-cache";
import { getOrSetCache } from "../utils/simple-cache";
import { runWithConcurrency } from "../utils/promise-pool";
import { getAllStocks } from "./stock.service";

const MARKET_HISTORY_CACHE_KEY = "market-history:1d:all";
const MARKET_HISTORY_CACHE_TTL_MS = 1000 * 60 * 5;
const MARKET_HISTORY_LOOKBACK_DAYS = 430;
const MARKET_HISTORY_FETCH_CONCURRENCY = 2;
const MARKET_HISTORY_FILE_NAME = "market-history-1d-all.json";

type HistoricalSeriesCacheFile = {
  refreshedAt: string;
  lookbackDays: number;
  items: HistoricalCandleSeries[];
};

/**
 * Returns YYYY-MM-DD in local calendar form.
 */
function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function fetchHistoricalDailySeriesFromUpstox(): Promise<HistoricalCandleSeries[]> {
  const stocks = await getAllStocks();

  const today = new Date();
  const from = new Date();
  from.setDate(today.getDate() - MARKET_HISTORY_LOOKBACK_DAYS);

  const toDate = toDateString(today);
  const fromDate = toDateString(from);

  const historyResults = await runWithConcurrency(
    stocks,
    MARKET_HISTORY_FETCH_CONCURRENCY,
    async (stock, index) => {
      try {
        const response = await fetchUpstoxDailyCandles(
          stock.instrumentKey,
          toDate,
          fromDate
        );

        const candles = response.data?.candles || [];

        if (candles.length === 0) {
          return null;
        }

        return {
          id: String(index + 1),
          instrumentKey: stock.instrumentKey,
          symbol: stock.symbol,
          timeframe: "1D" as const,
          candles,
        };
      } catch (error) {
        console.error(`Failed history fetch for ${stock.symbol}:`, error);
        return null;
      }
    }
  );

  return historyResults.filter(
    (item): item is HistoricalCandleSeries => Boolean(item)
  );
}

async function loadHistoricalDailySeriesFromFile(): Promise<HistoricalCandleSeries[] | null> {
  const cachedFile = await readJsonCacheFile<HistoricalSeriesCacheFile>(
    MARKET_HISTORY_FILE_NAME
  );

  if (!cachedFile?.items?.length) {
    return null;
  }

  console.log(
    `[history-service] Loaded 1D history from file cache: ${cachedFile.items.length} stocks, refreshed at ${cachedFile.refreshedAt}`
  );

  return cachedFile.items;
}

async function persistHistoricalDailySeriesToFile(
  series: HistoricalCandleSeries[]
): Promise<void> {
  const payload: HistoricalSeriesCacheFile = {
    refreshedAt: new Date().toISOString(),
    lookbackDays: MARKET_HISTORY_LOOKBACK_DAYS,
    items: series,
  };

  await writeJsonCacheFile(MARKET_HISTORY_FILE_NAME, payload);
}

/**
 * Fetches full recent daily candle history for the stock universe.
 * This is the shared data source for both OHLC, Bollinger, EMA, and charting.
 *
 * Strategy:
 * 1. Use in-memory cache first.
 * 2. If missing, try backend file cache.
 * 3. If missing, fetch from Upstox and persist it.
 */
export async function getHistoricalDailySeries(): Promise<HistoricalCandleSeries[]> {
  return getOrSetCache(
    MARKET_HISTORY_CACHE_KEY,
    MARKET_HISTORY_CACHE_TTL_MS,
    async () => {
      const fileSeries = await loadHistoricalDailySeriesFromFile();

      if (fileSeries && fileSeries.length > 0) {
        return fileSeries;
      }

      const fetchedSeries = await fetchHistoricalDailySeriesFromUpstox();

      if (fetchedSeries.length > 0) {
        await persistHistoricalDailySeriesToFile(fetchedSeries);
      }

      return fetchedSeries;
    }
  );
}

/**
 * Forces a fresh full-history download from Upstox and overwrites backend file cache.
 * This is useful when you explicitly want to rebuild the 1D historical base.
 */
export async function rebuildHistoricalDailySeries(): Promise<HistoricalCandleSeries[]> {
  const fetchedSeries = await fetchHistoricalDailySeriesFromUpstox();

  if (fetchedSeries.length > 0) {
    await persistHistoricalDailySeriesToFile(fetchedSeries);
  }

  return fetchedSeries;
}
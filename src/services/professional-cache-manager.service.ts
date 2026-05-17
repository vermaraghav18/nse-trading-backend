import { HistoricalCandleSeries } from "../types/candle.types";
import { fetchUpstoxDailyCandles } from "../integrations/upstox/candles.client";
import { fetchUpstox1HCandles } from "../integrations/upstox/intraday-1h.client";
import { getAllStocks } from "./stock.service";
import { readJsonCacheFile, writeJsonCacheFile } from "../utils/file-cache";
import { fetchDailyCandles, fetchHourlyCandles } from "./market-data-provider.service";
import { getHistoricalDataProvider } from "./provider-selector.service";
import { DataProvider } from "../config/api-providers";
import { SimpleLogger } from "../utils/simple-logger";
import { getAllCustomStockSymbols } from "./custom-stocks.service";

const CACHE_FILE_1D = "professional-cache-1d.json";
const CACHE_FILE_1H = "professional-cache-1h.json";
const CACHE_MAX_AGE_HOURS = 24;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;

type CacheMetadata = {
  lastUpdated: string;
  totalStocks: number;
  lookbackDays: number;
};

type ProfessionalCache = {
  metadata: CacheMetadata;
  data: HistoricalCandleSeries[];
};

let cache1D: HistoricalCandleSeries[] = [];
let cache1H: HistoricalCandleSeries[] = [];
let cacheLoadedAt: Date | null = null;

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isCacheFresh(filename: string): Promise<boolean> {
  try {
    const cached = await readJsonCacheFile<ProfessionalCache>(filename);
    if (!cached || !cached.metadata) return false;

    const lastUpdated = new Date(cached.metadata.lastUpdated);
    const ageHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);

    return ageHours < CACHE_MAX_AGE_HOURS;
  } catch {
    return false;
  }
}

async function loadCacheFromDisk(filename: string): Promise<HistoricalCandleSeries[]> {
  try {
    const cached = await readJsonCacheFile<ProfessionalCache>(filename);
    if (!cached || !cached.data) return [];
    return cached.data;
  } catch {
    return [];
  }
}

async function saveCacheToDisk(filename: string, data: HistoricalCandleSeries[], lookbackDays: number): Promise<void> {
  try {
    const cache: ProfessionalCache = {
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalStocks: data.length,
        lookbackDays,
      },
      data,
    };
    
    await writeJsonCacheFile(filename, cache);
  } catch (error) {
    SimpleLogger.error(`Failed to save ${filename}`);
  }
}

async function fetchFullHistoricalData(
  timeframe: "1D" | "1H",
  lookbackDays: number
): Promise<HistoricalCandleSeries[]> {
  const stocks = await getAllStocks();
  const allCustomStocks = getAllCustomStockSymbols();
  const today = new Date();
  const from = new Date();
  from.setDate(today.getDate() - lookbackDays);

  const toDate = toDateString(today);
  const fromDate = toDateString(from);

  const results: HistoricalCandleSeries[] = [];
  let processedCount = 0;
  const totalStocks = stocks.length;

  for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
    const batch = stocks.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (stock, idx) => {
      try {
        // Determine which provider to use for this stock (SMART DISTRIBUTION)
        const provider = getHistoricalDataProvider(stock.symbol, allCustomStocks);
        
        // Use provider abstraction layer
        const response = timeframe === "1D" 
          ? await fetchDailyCandles(stock.instrumentKey, toDate, fromDate, undefined, stock.symbol)
          : await fetchHourlyCandles(stock.instrumentKey, toDate, fromDate, undefined, stock.symbol);
        
        const candles = response.data?.candles || [];

        if (candles.length === 0) return null;

        return {
          id: String(i + idx + 1),
          instrumentKey: stock.instrumentKey,
          symbol: stock.symbol,
          timeframe,
          candles,
        };
      } catch (error) {
        // Silently handle errors - fallback already handled by provider
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    
    // Filter out nulls and push valid results
    const validResults = batchResults.filter((item): item is HistoricalCandleSeries => item !== null);
    
    validResults.forEach((item) => {
      results.push(item);
    });
    
    processedCount += batch.length;

    // Show progress every 10 stocks or at completion
    if (processedCount % 10 === 0 || processedCount === totalStocks) {
      SimpleLogger.progress(
        processedCount, 
        totalStocks, 
        timeframe === "1D" ? "Daily Cache" : "Hourly Cache"
      );
    }

    if (i + BATCH_SIZE < stocks.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return results;
}

export async function initializeProfessionalCache(): Promise<void> {
  const startTime = Date.now();

  // Check 1D cache
  const is1DFresh = await isCacheFresh(CACHE_FILE_1D);
  
  if (is1DFresh) {
    SimpleLogger.info('Loading daily cache from disk...');
    cache1D = await loadCacheFromDisk(CACHE_FILE_1D);
    SimpleLogger.success(`Loaded ${cache1D.length} stocks from daily cache`);
  } else {
    SimpleLogger.info('Building daily cache (430 days of data)...');
    cache1D = await fetchFullHistoricalData("1D", 430);
    await saveCacheToDisk(CACHE_FILE_1D, cache1D, 430);
    SimpleLogger.success(`Daily cache complete: ${cache1D.length} stocks`);
  }

  // Check 1H cache
  const is1HFresh = await isCacheFresh(CACHE_FILE_1H);
  
  if (is1HFresh) {
    SimpleLogger.info('Loading hourly cache from disk...');
    cache1H = await loadCacheFromDisk(CACHE_FILE_1H);
    SimpleLogger.success(`Loaded ${cache1H.length} stocks from hourly cache`);
  } else {
    SimpleLogger.info('Building hourly cache (90 days of data)...');
    cache1H = await fetchFullHistoricalData("1H", 90);
    await saveCacheToDisk(CACHE_FILE_1H, cache1H, 90);
    SimpleLogger.success(`Hourly cache complete: ${cache1H.length} stocks`);
  }

  cacheLoadedAt = new Date();
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  SimpleLogger.info(`Cache built in ${duration} seconds`);
}

export async function buildMissingCachesInBackground(): Promise<void> {
  if (cache1H.length === 0) {
    SimpleLogger.info('Building hourly cache in background...');
    cache1H = await fetchFullHistoricalData("1H", 90);
    await saveCacheToDisk(CACHE_FILE_1H, cache1H, 90);
    SimpleLogger.success('Background hourly cache complete');
  }
}

export function get1DCache(): HistoricalCandleSeries[] {
  return cache1D;
}

export function get1HCache(): HistoricalCandleSeries[] {
  return cache1H;
}

export function getCacheStats() {
  return {
    loadedAt: cacheLoadedAt,
    cache1D: cache1D.length,
    cache1H: cache1H.length,
  };
}

export async function rebuildAllCaches(): Promise<void> {
  SimpleLogger.info('Rebuilding all caches...');
  cache1D = await fetchFullHistoricalData("1D", 430);
  await saveCacheToDisk(CACHE_FILE_1D, cache1D, 430);
  cache1H = await fetchFullHistoricalData("1H", 90);
  await saveCacheToDisk(CACHE_FILE_1H, cache1H, 90);
  SimpleLogger.success('All caches rebuilt');
}
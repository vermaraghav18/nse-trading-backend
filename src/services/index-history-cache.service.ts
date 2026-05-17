// INDEX HISTORICAL CACHE SERVICE
// Fetches and caches historical data for market indices (NIFTY50, NIFTYBANK, etc.)

import { fetchUpstoxDailyCandles } from "../integrations/upstox/candles.client";

type HistoricalSeries = {
  instrumentKey: string;
  symbol: string;
  candles: [string, number, number, number, number, number, number][];
};

// In-memory cache
let cachedIndexHistoricalSeries: HistoricalSeries[] = [];
let lastIndexRefreshAt: string | null = null;
let isRefreshingIndex = false;

// Market indices to track
const MARKET_INDICES = [
  { symbol: "NIFTY50", name: "Nifty 50", instrumentKey: "NSE_INDEX|Nifty 50" },
  { symbol: "NIFTYBANK", name: "Nifty Bank", instrumentKey: "NSE_INDEX|Nifty Bank" },
  { symbol: "NIFTYIT", name: "Nifty IT", instrumentKey: "NSE_INDEX|Nifty IT" },
  { symbol: "NIFTYPHARMA", name: "Nifty Pharma", instrumentKey: "NSE_INDEX|Nifty Pharma" },
  { symbol: "NIFTYFMCG", name: "Nifty FMCG", instrumentKey: "NSE_INDEX|Nifty FMCG" },
  { symbol: "NIFTYAUTO", name: "Nifty Auto", instrumentKey: "NSE_INDEX|Nifty Auto" },
  { symbol: "NIFTYMETAL", name: "Nifty Metal", instrumentKey: "NSE_INDEX|Nifty Metal" },
  { symbol: "NIFTYREALTY", name: "Nifty Realty", instrumentKey: "NSE_INDEX|Nifty Realty" },
  { symbol: "NIFTYENERGY", name: "Nifty Energy", instrumentKey: "NSE_INDEX|Nifty Energy" },
  { symbol: "NIFTYPSUBANK", name: "Nifty PSU Bank", instrumentKey: "NSE_INDEX|Nifty PSU Bank" },
];

const INDEX_LOOKBACK_DAYS = 90; // 3 months of data

/**
 * Fetch historical data for all market indices
 */
export async function refreshIndexHistoricalCache(): Promise<void> {
  if (isRefreshingIndex) {
    console.log("[index-cache] Already refreshing, skipping...");
    return;
  }

  isRefreshingIndex = true;

  try {
    console.log(`[index-cache] Starting refresh for ${MARKET_INDICES.length} indices...`);

    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - INDEX_LOOKBACK_DAYS);

    const toDate = formatDate(today);
    const fromDate = formatDate(from);

    const results: HistoricalSeries[] = [];

    // Fetch each index sequentially to avoid rate limits
    for (const index of MARKET_INDICES) {
      try {
        console.log(`[index-cache] Fetching ${index.symbol}...`);
        
        const response = await fetchUpstoxDailyCandles(
          index.instrumentKey,
          toDate,
          fromDate
        );

        const candles = response?.data?.candles;

        if (candles && candles.length > 0) {
          results.push({
            instrumentKey: index.instrumentKey,
            symbol: index.symbol,
            candles: candles
          });
          console.log(`[index-cache] ✅ ${index.symbol}: ${candles.length} candles`);
        } else {
          console.warn(`[index-cache] ⚠️ ${index.symbol}: No data returned`);
        }

        // Small delay to avoid rate limits
        await sleep(200);

      } catch (error: any) {
        console.error(`[index-cache] ❌ Failed to fetch ${index.symbol}:`, error.message);
      }
    }

    if (results.length > 0) {
      cachedIndexHistoricalSeries = results;
      lastIndexRefreshAt = new Date().toISOString();
      console.log(
        `[index-cache] ✅ Refreshed ${results.length}/${MARKET_INDICES.length} indices at ${lastIndexRefreshAt}`
      );
    } else {
      console.warn("[index-cache] ⚠️ No index data fetched, keeping old cache");
    }

  } catch (error) {
    console.error("[index-cache] ❌ Failed to refresh index historical cache:", error);
  } finally {
    isRefreshingIndex = false;
  }
}

/**
 * Get cached index historical series
 */
export function getCachedIndexHistoricalSeries(): HistoricalSeries[] {
  return cachedIndexHistoricalSeries;
}

/**
 * Get last refresh timestamp
 */
export function getLastIndexRefreshAt(): string | null {
  return lastIndexRefreshAt;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
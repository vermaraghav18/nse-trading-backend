import { HistoricalCandleSeries } from "../types/candle.types";
import { getCurrentHistoricalData } from "./phased-history-loader.service";

let cachedHistoricalSeries: HistoricalCandleSeries[] = [];
let lastHistoryRefreshAt: string | null = null;

/**
 * Get cached historical series from phased loader
 */
export function getCachedHistoricalSeries(): HistoricalCandleSeries[] {
  const current = getCurrentHistoricalData();
  
  if (current.length > cachedHistoricalSeries.length) {
    // Data was upgraded (NIFTY → FULL), update cache
    cachedHistoricalSeries = current;
    lastHistoryRefreshAt = new Date().toISOString();
    
    console.log(`[phased-cache] Historical data upgraded: ${cachedHistoricalSeries.length} stocks at ${lastHistoryRefreshAt}`);
  }
  
  return current;
}

/**
 * Returns last history refresh time
 */
export function getLastHistoryRefreshAt(): string | null {
  return lastHistoryRefreshAt;
}

/**
 * Dummy functions for compatibility
 */
export async function refreshHistoricalSeriesCache(): Promise<void> {
  // Data is loaded by phased-history-loader, this is a no-op
  cachedHistoricalSeries = getCurrentHistoricalData();
}

export async function rebuildHistoricalSeriesCache(): Promise<void> {
  // Data is loaded by phased-history-loader, this is a no-op
  cachedHistoricalSeries = getCurrentHistoricalData();
}
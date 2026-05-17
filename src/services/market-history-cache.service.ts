import { HistoricalCandleSeries } from "../types/candle.types";
import { get1DCache } from "./professional-cache-manager.service";

let lastHistoryRefreshAt: string | null = null;

/**
 * Get cached historical series (from professional cache)
 */
export function getCachedHistoricalSeries(): HistoricalCandleSeries[] {
  const cache = get1DCache();
  
  if (cache.length > 0 && !lastHistoryRefreshAt) {
    lastHistoryRefreshAt = new Date().toISOString();
  }
  
  return cache;
}

/**
 * Returns last history refresh time
 */
export function getLastHistoryRefreshAt(): string | null {
  return lastHistoryRefreshAt;
}

/**
 * Compatibility functions (no-op, cache managed by professional-cache-manager)
 */
export async function refreshHistoricalSeriesCache(): Promise<void> {
  // No-op: Cache is managed by professional-cache-manager
}

export async function rebuildHistoricalSeriesCache(): Promise<void> {
  // No-op: Cache is managed by professional-cache-manager
}
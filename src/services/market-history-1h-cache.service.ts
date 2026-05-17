import { HistoricalCandleSeries } from "../types/candle.types";
import { get1HCache } from "./professional-cache-manager.service";

let lastHistoryRefreshAt: string | null = null;

/**
 * Get cached 1H historical series (from professional cache)
 */
export function getCachedHistorical1HSeries(): HistoricalCandleSeries[] {
  const cache = get1HCache();
  
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
 * Compatibility function (no-op, cache managed by professional-cache-manager)
 */
export async function refreshHistorical1HSeriesCache(): Promise<void> {
  // No-op: Cache is managed by professional-cache-manager
}
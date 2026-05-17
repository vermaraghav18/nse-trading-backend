import { HistoricalCandleSeries } from "../types/candle.types";
import { get1DCache } from "./professional-cache-manager.service";

/**
 * Compatibility layer for hot-list.service
 * Returns data from professional cache
 */
export function getCurrentHistoricalData(): HistoricalCandleSeries[] {
  return get1DCache();
}

export function getCurrentPhase(): string {
  return get1DCache().length > 0 ? "FULL" : "NIFTY_ONLY";
}

export function getLoadStats() {
  const cache = get1DCache();
  return {
    phase: cache.length > 0 ? "FULL" : "NIFTY_ONLY",
    loaded: cache.length,
  };
}
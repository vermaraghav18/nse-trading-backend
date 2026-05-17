import {
  getCachedHotScannerSnapshot1D,
  getCachedHotScannerSnapshot1H,
  getCachedHotScannerSnapshot2H,
} from "./hot-list-scanner-cache.service";
import {
  ChartTimeframe,
  StockScannerResponse,
} from "../types/chart.types";

/**
 * Scanner Snapshot Cache - now delegates to Hot Scanner Cache
 * This provides the Market Scanner with pre-computed data from the hot list
 */

export function getCachedScannerSnapshot(
  timeframe: ChartTimeframe
): StockScannerResponse {
  if (timeframe === "1D") {
    return getCachedHotScannerSnapshot1D();
  } else if (timeframe === "1H") {
    return getCachedHotScannerSnapshot1H();
  } else {
    return getCachedHotScannerSnapshot2H();
  }
}

export function getCachedScannerSnapshot1D(): StockScannerResponse {
  return getCachedHotScannerSnapshot1D();
}

export function getCachedScannerSnapshot1H(): StockScannerResponse {
  return getCachedHotScannerSnapshot1H();
}

export function getCachedScannerSnapshot2H(): StockScannerResponse {
  return getCachedHotScannerSnapshot2H();
}

// No longer needed - hot scanner cache is already running
export async function startScannerSnapshotCache(): Promise<void> {
  console.log("[scanner-snapshot-cache] Now using hot scanner cache (100 stocks)");
}

export async function refreshScannerSnapshotCache(): Promise<void> {
  // No-op - hot scanner handles refreshes
}
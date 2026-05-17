import { getHotList } from "./hot-list.service";
import { getCachedScannerSnapshot1D } from "./scanner-snapshot-cache.service";

const MAX_LIVE_STOCKS = 60;

let currentLiveSymbols: string[] = [];

export function getLiveSymbols(): string[] {
  return [...currentLiveSymbols];
}

export function rebuildLiveUniverse(): string[] {
  const hotList = getHotList();

  if (hotList.length > 0) {
    currentLiveSymbols = hotList.slice(0, MAX_LIVE_STOCKS).map((s) => s.trim().toUpperCase());
  } else {
    const scanner = getCachedScannerSnapshot1D();
    const sorted = [...scanner.rows].sort((a, b) => {
      if (b.scannerScore !== a.scannerScore) {
        return b.scannerScore - a.scannerScore;
      }
      return a.symbol.localeCompare(b.symbol);
    });
    currentLiveSymbols = sorted.slice(0, MAX_LIVE_STOCKS).map((row) => row.symbol.trim().toUpperCase());
  }

  console.log(
    `[live-universe] Selected ${currentLiveSymbols.length} live stocks`
  );

  return [...currentLiveSymbols];
}
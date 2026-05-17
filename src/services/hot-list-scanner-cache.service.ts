import { getHotList } from "./hot-list.service";
import { buildStockScannerRow, buildStockScannerRow1D } from "./chart.service";
import {
  ChartTimeframe,
  StockScannerResponse,
  StockScannerRow,
} from "../types/chart.types";

const HOT_SCANNER_REFRESH_INTERVAL_MS = 30_000; // 30 seconds
const SCANNER_BATCH_SIZE = 10;
const SCANNER_BATCH_DELAY_MS = 2000; // CHANGED: Increased from 500ms to 2000ms (2 seconds)
const TIMEFRAME_STAGGER_DELAY_MS = 15000; // ADDED: 15 second delay between timeframes

const TIMEFRAMES: ChartTimeframe[] = ["1D", "1H", "2H"];

type ScannerRowMap = Map<string, StockScannerRow>;

const hotScannerCache = new Map<ChartTimeframe, ScannerRowMap>([
  ["1D", new Map()],
  ["1H", new Map()],
  ["2H", new Map()],
]);

let scannerRefreshInFlight: Promise<void> | null = null;
let lastRefreshTime: Date | null = null;
let refreshCount = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sortRows(rows: StockScannerRow[]): StockScannerRow[] {
  return [...rows].sort((a, b) => {
    if (b.scannerScore !== a.scannerScore) {
      return b.scannerScore - a.scannerScore;
    }
    return a.symbol.localeCompare(b.symbol);
  });
}

async function refreshSingleSymbolForTimeframe(
  symbol: string,
  timeframe: ChartTimeframe
): Promise<void> {
  try {
    const row =
      timeframe === "1D"
        ? await buildStockScannerRow1D(symbol)
        : await buildStockScannerRow(symbol, timeframe);
    const rowMap = hotScannerCache.get(timeframe);

    if (!rowMap) {
      return;
    }

    if (row) {
      rowMap.set(symbol, row);
    } else {
      rowMap.delete(symbol);
    }
  } catch (error) {
    console.error(
      `[hot-scanner] ❌ Failed to refresh ${timeframe} for ${symbol}:`,
      error instanceof Error ? error.message : error
    );
  }
}

async function refreshBatchForTimeframe(
  symbols: string[],
  timeframe: ChartTimeframe
): Promise<void> {
  for (let index = 0; index < symbols.length; index += SCANNER_BATCH_SIZE) {
    const batch = symbols.slice(index, index + SCANNER_BATCH_SIZE);

    // Process batch in parallel
    await Promise.all(
      batch.map((symbol) => refreshSingleSymbolForTimeframe(symbol, timeframe))
    );

    if (index + SCANNER_BATCH_SIZE < symbols.length) {
      await sleep(SCANNER_BATCH_DELAY_MS);
    }
  }
}

export async function refreshHotScannerCache(): Promise<void> {
  if (scannerRefreshInFlight) {
    return scannerRefreshInFlight;
  }

  const refreshStartTime = Date.now();
  refreshCount++;

  scannerRefreshInFlight = (async () => {
    const hotList = getHotList();

    if (hotList.length === 0) {
      console.log("\n⚠️  [hot-scanner] No hot list available - skipping refresh");
      return;
    }

    console.log("\n╔════════════════════════════════════════════════════════════════╗");
    console.log(`║  🔄 HOT SCANNER REFRESH #${refreshCount.toString().padStart(3, "0")} - ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST          ║`);
    console.log("╚════════════════════════════════════════════════════════════════╝");

    console.log(`\n📊 Tracking ${hotList.length} hot stocks across 3 timeframes...\n`);

    // CHANGED: Refresh each timeframe with stagger delay between them
    for (let i = 0; i < TIMEFRAMES.length; i++) {
      const timeframe = TIMEFRAMES[i];
      const tfStartTime = Date.now();
      
      console.log(`┌─────────────────────────────────────────────────────────────┐`);
      console.log(`│ Refreshing ${timeframe} data for ${hotList.length} stocks...                     │`);

      await refreshBatchForTimeframe(hotList, timeframe);

      const rowMap = hotScannerCache.get(timeframe);
      const successCount = rowMap?.size ?? 0;
      const duration = ((Date.now() - tfStartTime) / 1000).toFixed(1);
      
      console.log(`│ ✓ ${timeframe} complete: ${successCount}/${hotList.length} stocks in ${duration}s                   │`);
      console.log(`└─────────────────────────────────────────────────────────────┘\n`);
      
      // ADDED: Stagger delay between timeframes (except after last one)
      if (i < TIMEFRAMES.length - 1) {
        console.log(`⏳ Waiting ${TIMEFRAME_STAGGER_DELAY_MS / 1000}s before next timeframe...\n`);
        await sleep(TIMEFRAME_STAGGER_DELAY_MS);
      }
    }

    const totalDuration = ((Date.now() - refreshStartTime) / 1000).toFixed(1);
    lastRefreshTime = new Date();

    console.log("╔════════════════════════════════════════════════════════════════╗");
    console.log(`║  ✅ Refresh Complete in ${totalDuration}s                                  ║`);
    console.log(`║  ⏰ Next refresh in 30 seconds...                              ║`);
    console.log("╚════════════════════════════════════════════════════════════════╝\n");
  })();

  try {
    await scannerRefreshInFlight;
  } finally {
    scannerRefreshInFlight = null;
  }
}

export function getCachedHotScannerSnapshot(
  timeframe: ChartTimeframe
): StockScannerResponse {
  const rowMap = hotScannerCache.get(timeframe);

  return {
    rows: sortRows(rowMap ? Array.from(rowMap.values()) : []),
  };
}

export function getCachedHotScannerSnapshot1D(): StockScannerResponse {
  return getCachedHotScannerSnapshot("1D");
}

export function getCachedHotScannerSnapshot1H(): StockScannerResponse {
  return getCachedHotScannerSnapshot("1H");
}

export function getCachedHotScannerSnapshot2H(): StockScannerResponse {
  return getCachedHotScannerSnapshot("2H");
}

export async function startHotScannerCache(): Promise<void> {
  console.log("\n🚀 [hot-scanner] Starting hot list scanner cache...");
  
  // ADDED: Initial delay of 10 seconds to let live cache start first
  console.log("⏳ Waiting 10 seconds to offset from live cache startup...\n");
  await sleep(10000);
  
  await refreshHotScannerCache();

  setInterval(() => {
    refreshHotScannerCache().catch((error) => {
      console.error(
        "[hot-scanner] ❌ Interval refresh failed:",
        error
      );
    });
  }, HOT_SCANNER_REFRESH_INTERVAL_MS);
}

export function getHotScannerStatus(): {
  lastRefresh: Date | null;
  refreshCount: number;
  cachedStocks: {
    "1D": number;
    "1H": number;
    "2H": number;
  };
} {
  return {
    lastRefresh: lastRefreshTime,
    refreshCount,
    cachedStocks: {
      "1D": hotScannerCache.get("1D")?.size ?? 0,
      "1H": hotScannerCache.get("1H")?.size ?? 0,
      "2H": hotScannerCache.get("2H")?.size ?? 0,
    },
  };
}
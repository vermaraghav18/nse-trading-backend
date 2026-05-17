import { getAllStocks } from "./stock.service";
import { buildStockScannerRow1D } from "./chart.service";
import { getIndexRrg1D } from "./rrg.service";
import { getLatestBollinger1H } from "./bollinger-1h.service";
import { getLatestEma1H } from "./ema-1h.service";
import { calculateStockScore, StockScore } from "./stock-scorer.service";

const HOT_LIST_SIZE = 100;
const SCAN_BATCH_SIZE = 5;
const SCAN_BATCH_DELAY_MS = 1000; // 1s between batches — prevents Upstox 429 rate limit

let currentHotList: string[] = [];
let lastFullScanTime: Date | null = null;
let nextScheduledScan: Date | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function performFullScan(): Promise<{
  hotList: string[];
  scores: StockScore[];
  totalScanned: number;
  scanDuration: number;
}> {
  const scanStartTime = Date.now();

  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║           🔥 HOT LIST FULL SCAN INITIATED 🔥                   ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  // Step 1: Get all stocks
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│ [1/5] 📊 Fetching Stock Universe...                        │");

  const { getCurrentHistoricalData, getCurrentPhase } = await import("./phased-history-loader.service");
  const historicalData = getCurrentHistoricalData();
  const phase = getCurrentPhase();

  const availableSymbols = new Set(historicalData.map(h => h.symbol));
  const allStocks = await getAllStocks();
  const stocksToScan = allStocks.filter(s => availableSymbols.has(s.symbol));

  const phaseLabel = phase === "NIFTY_ONLY" ? "NIFTY 50" : "NIFTY 50 + Custom";
  console.log(`│ ✓ Loaded ${stocksToScan.length} stocks (${phaseLabel})                      │`);
  console.log("└─────────────────────────────────────────────────────────────┘\n");

  // Step 2: Fetch RRG data
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│ [2/5] 📈 Fetching RRG Sector Data...                       │");
  let rrgData: any[] = [];
  try {
    const rrgResult = await getIndexRrg1D();
    rrgData = rrgResult.rows || [];
    console.log(`│ ✓ RRG data loaded: ${rrgData.length} sectors                              │`);

    const sectorStatus = rrgData.map(r => {
      const quadrantEmoji =
        r.quadrant === "LEADING" ? "🟢" :
        r.quadrant === "IMPROVING" ? "🔵" :
        r.quadrant === "WEAKENING" ? "🟡" :
        "🔴";
      return `${quadrantEmoji} ${r.symbol.replace("NIFTY", "").padEnd(8)} ${r.quadrant.padEnd(10)}`;
    });

    console.log("│                                                             │");
    sectorStatus.forEach(status => console.log(`│   ${status}  │`));
  } catch (err) {
    console.log("│ ⚠ RRG data unavailable - using defaults                    │");
  }
  console.log("└─────────────────────────────────────────────────────────────┘\n");

  // Step 3: Fetch 1H Bollinger & EMA data
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│ [3/5] 📉 Fetching 1H Technical Data...                     │");
  const boll1HData = getLatestBollinger1H();
  const ema1HData = await getLatestEma1H();
  console.log(`│ ✓ 1H Bollinger: ${boll1HData.length} stocks                                 │`);
  console.log(`│ ✓ 1H EMA: ${ema1HData.length} stocks                                        │`);
  console.log("└─────────────────────────────────────────────────────────────┘\n");

  // Step 4: Fetch scanner data — batched to avoid Upstox 429 rate limit
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│ [4/5] 🔍 Scanning All Stocks (1D Data)...                  │");
  console.log("│                                                             │");

  const scannerData = new Map<string, any>();
  let scannedCount = 0;
  const total = stocksToScan.length;

  for (let batchStart = 0; batchStart < stocksToScan.length; batchStart += SCAN_BATCH_SIZE) {
    const batch = stocksToScan.slice(batchStart, batchStart + SCAN_BATCH_SIZE);

    await Promise.all(
      batch.map(async (stock) => {
        try {
          const row = await buildStockScannerRow1D(stock.symbol);
          if (row) {
            scannerData.set(stock.symbol, row);
          }
        } catch (err) {
          // Skip stocks that fail
        }
        scannedCount++;
      })
    );

    // Progress indicator every 50 stocks
    if (scannedCount % 50 === 0 || scannedCount >= total) {
      const progress = ((scannedCount / total) * 100).toFixed(0);
      const bar = "█".repeat(Math.floor((scannedCount / total) * 40));
      const empty = "░".repeat(40 - Math.floor((scannedCount / total) * 40));
      console.log(`│ Progress: [${bar}${empty}] ${progress}% (${scannedCount}/${total})    │`);
    }

    if (batchStart + SCAN_BATCH_SIZE < stocksToScan.length) {
      await sleep(SCAN_BATCH_DELAY_MS);
    }
  }

  console.log("│                                                             │");
  console.log(`│ ✓ Successfully scanned: ${scannerData.size}/${total} stocks                       │`);
  console.log("└─────────────────────────────────────────────────────────────┘\n");

  // Step 5: Score all stocks
  console.log("┌─────────────────────────────────────────────────────────────┐");
  console.log("│ [5/5] 🎯 Calculating Quality Scores...                     │");

  const boll1HMap = new Map(boll1HData.map((b) => [b.symbol, b]));
  const ema1HMap = new Map(ema1HData.map((e) => [e.symbol, e]));

  const scores: StockScore[] = [];

  for (const stock of stocksToScan) {
    const scanner1D = scannerData.get(stock.symbol) || null;
    const boll1H = boll1HMap.get(stock.symbol) || null;
    const ema1H = ema1HMap.get(stock.symbol) || null;

    const score = calculateStockScore(
      stock.symbol,
      scanner1D,
      boll1H,
      ema1H,
      rrgData
    );

    scores.push(score);
  }

  scores.sort((a, b) => b.totalScore - a.totalScore);

  console.log(`│ ✓ Scored ${scores.length} stocks                                         │`);
  console.log("└─────────────────────────────────────────────────────────────┘\n");

  // Select Top 100
  const top100Scores = scores.slice(0, HOT_LIST_SIZE);
  const hotList = top100Scores.map((s) => s.symbol);

  const scanDuration = Date.now() - scanStartTime;
  lastFullScanTime = new Date();

  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log("║                 🏆 TOP 100 HOT LIST SELECTED 🏆                ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log("┌──────┬────────────┬────────┬─────────────────────────────────┐");
  console.log("│ Rank │   Symbol   │ Score  │ Key Factors                      │");
  console.log("├──────┼────────────┼────────┼─────────────────────────────────┤");

  for (let i = 0; i < Math.min(10, top100Scores.length); i++) {
    const s = top100Scores[i];
    const rank = `#${(i + 1).toString().padStart(3, " ")}`;
    const symbol = s.symbol.padEnd(10);
    const score = s.totalScore.toString().padStart(3);
    const factors = s.reason.substring(0, 32).padEnd(32);
    console.log(`│ ${rank} │ ${symbol} │  ${score}   │ ${factors} │`);
  }

  console.log("│  ...   ...          ...       ...                              │");

  if (top100Scores.length >= 50) {
    const s = top100Scores[49];
    const rank = ` #50`;
    const symbol = s.symbol.padEnd(10);
    const score = s.totalScore.toString().padStart(3);
    const factors = s.reason.substring(0, 32).padEnd(32);
    console.log(`│ ${rank} │ ${symbol} │  ${score}   │ ${factors} │`);
  }

  console.log("│  ...   ...          ...       ...                              │");

  if (top100Scores.length >= 100) {
    const s = top100Scores[99];
    const rank = `#100`;
    const symbol = s.symbol.padEnd(10);
    const score = s.totalScore.toString().padStart(3);
    const factors = s.reason.substring(0, 32).padEnd(32);
    console.log(`│ ${rank} │ ${symbol} │  ${score}   │ ${factors} │`);
  }

  console.log("└──────┴────────────┴────────┴─────────────────────────────────┘\n");

  console.log("╔════════════════════════════════════════════════════════════════╗");
  console.log(`║  🔥 Hot List Locked: ${HOT_LIST_SIZE} stocks selected                      ║`);
  console.log(`║  ⏱  Scan Duration: ${(scanDuration / 1000).toFixed(1)}s                                   ║`);
  console.log(`║  📊 Total Scanned: ${stocksToScan.length} stocks                              ║`);
  console.log(`║  ✅ Ready for Trading                                          ║`);
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  return {
    hotList,
    scores: top100Scores,
    totalScanned: stocksToScan.length,
    scanDuration,
  };
}

export function setHotList(symbols: string[]): void {
  currentHotList = [...symbols];
}

export function getHotList(): string[] {
  return [...currentHotList];
}

export function getLastScanTime(): Date | null {
  return lastFullScanTime;
}

export function setNextScanTime(time: Date): void {
  nextScheduledScan = time;
}

export function getNextScanTime(): Date | null {
  return nextScheduledScan;
}
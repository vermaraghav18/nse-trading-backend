import { env } from "../config/env";
import { getCachedHotScannerSnapshot1D } from "./hot-list-scanner-cache.service";
import { runAutoTradeEngine } from "./auto-trade-engine.service";
import { getNseMarketSessionStatus } from "./nse-market-calendar.service";
import { getLatestBollinger1H } from "./bollinger-1h.service";
import { getLatestEma1H } from "./ema-1h.service";
import { getHotList } from "./hot-list.service";

let isAutoTradeCycleRunning = false;

const AUTO_TRADE_INTERVAL_MS = Math.max(env.upstoxOhlcPollIntervalMs, 15000);

/**
 * 2H proxy: reuses 1H Bollinger/EMA data as 2H trend confirmation.
 * The engine's 2H checks are trend-level (above/below bands, EMA slant)
 * so 1H data is a valid approximation.
 * TODO: Build dedicated 2H cache if Upstox adds 2H interval support.
 */
async function get2HDataFromProxy() {
  const boll2H = getLatestBollinger1H();
  const ema2H = await getLatestEma1H();
  return { boll2H, ema2H };
}

/**
 * Runs one autonomous paper-trading cycle using hot list scanner + 1H/2H data.
 */
export async function runAutoTradeCycleOnce(): Promise<void> {
  if (isAutoTradeCycleRunning) {
    return;
  }

  const session = getNseMarketSessionStatus();

  if (!session.isMarketOpenNow) {
    const holidayLabel = session.holidayName ? ` (${session.holidayName})` : "";
    console.log(
      `[auto-trade-runner] Skipped cycle: ${session.reason}${holidayLabel} | ${session.localDate} ${session.localTime} IST`
    );
    return;
  }

  // Check if hot list is available
  const hotList = getHotList();
  if (hotList.length === 0) {
    console.log("[auto-trade-runner] ⚠️  Hot list not ready - waiting for scheduled scan...");
    return;
  }

  isAutoTradeCycleRunning = true;

  try {
    // Fetch all 3 timeframes (from hot list scanner cache)
    const scanner = getCachedHotScannerSnapshot1D();
    const boll1H = getLatestBollinger1H();
    const ema1H = await getLatestEma1H();
    const { boll2H, ema2H } = await get2HDataFromProxy();

    // Run with multi-timeframe data
    await runAutoTradeEngine(scanner.rows, boll1H, ema1H, boll2H, ema2H);
  } catch (error) {
    console.error("[auto-trade-runner] Cycle failed:", error);
  } finally {
    isAutoTradeCycleRunning = false;
  }
}

/**
 * Starts the autonomous paper-trade background loop.
 */
export async function startAutoTradeRunner(): Promise<void> {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║         🤖 AUTO-TRADE RUNNER INITIALIZED 🤖                    ║");
  console.log("╚════════════════════════════════════════════════════════════════╝");
  console.log(`\n⏱  Cycle interval: ${AUTO_TRADE_INTERVAL_MS / 1000}s`);
  console.log("📊 Data source: Hot List Scanner Cache (Top 100 stocks)\n");

  await runAutoTradeCycleOnce();

  setInterval(() => {
    runAutoTradeCycleOnce().catch((error) => {
      console.error("[auto-trade-runner] Interval cycle failed:", error);
    });
  }, AUTO_TRADE_INTERVAL_MS);
}
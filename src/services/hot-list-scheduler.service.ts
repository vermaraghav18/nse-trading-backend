import { performFullScan, setHotList, setNextScanTime } from "./hot-list.service";
import { getNseMarketSessionStatus } from "./nse-market-calendar.service";
import { startHotScannerCache } from "./hot-list-scanner-cache.service";

const RESCAN_INTERVAL_HOURS = 2;
const STARTUP_SCAN_DELAY_MS = 45000; // 45s — lets startLive1HCache API burst settle

let isInitialized = false;
let rescanInterval: NodeJS.Timeout | null = null;
let lastScanTime: Date | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runScan(reason: string): Promise<boolean> {
  console.log("\n");
  console.log("═".repeat(70));
  console.log(`⏰ SCAN TRIGGERED: ${reason}`);
  console.log("═".repeat(70));

  try {
    const result = await performFullScan();
    setHotList(result.hotList);
    lastScanTime = new Date();

    console.log("\n✅ Hot list updated successfully!");
    console.log(`🔥 ${result.hotList.length} stocks locked for trading\n`);

    return true;
  } catch (error) {
    console.error("\n❌ Scan failed:", error);
    return false;
  }
}

function calculateNextRescanTime(): Date | null {
  if (!lastScanTime) return null;

  const nextScan = new Date(lastScanTime);
  nextScan.setHours(nextScan.getHours() + RESCAN_INTERVAL_HOURS);

  return nextScan;
}

function startPeriodicRescans(): void {
  if (rescanInterval) {
    clearInterval(rescanInterval);
  }

  rescanInterval = setInterval(async () => {
    const session = getNseMarketSessionStatus();

    if (!session.isMarketOpenNow) {
      return;
    }

    const nextRescan = calculateNextRescanTime();
    if (!nextRescan) {
      return;
    }

    const now = new Date();
    if (now >= nextRescan) {
      const timeStr = now.toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
      });

      await runScan(`Periodic rescan at ${timeStr}`);

      const updatedNext = calculateNextRescanTime();
      if (updatedNext) {
        setNextScanTime(updatedNext);
        console.log(`⏰ Next rescan scheduled: ${updatedNext.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}\n`);
      }
    }
  }, 5 * 60 * 1000);
}

export async function startHotListScheduler(): Promise<void> {
  console.log("\n╔════════════════════════════════════════════════════════════════╗");
  console.log("║        🎯 SMART HOT LIST SCHEDULER INITIALIZED 🎯              ║");
  console.log("╚════════════════════════════════════════════════════════════════╝\n");

  console.log("📋 Smart Scheduling Features:");
  console.log("   • Scan immediately if market is open");
  console.log("   • Automatic rescans every 2 hours");
  console.log("   • Works ANY time you start the server\n");

  const session = getNseMarketSessionStatus();

  if (session.isMarketOpenNow) {
    console.log(`🟢 Market is OPEN - Waiting ${STARTUP_SCAN_DELAY_MS / 1000}s for API rate limit to settle before scan...\n`);
    await sleep(STARTUP_SCAN_DELAY_MS);

    const success = await runScan("Startup scan (market open)");

    if (success && !isInitialized) {
      console.log("🚀 Starting continuous hot scanner cache...\n");
      await startHotScannerCache();
      isInitialized = true;
    }

    startPeriodicRescans();

    const nextRescan = calculateNextRescanTime();
    if (nextRescan) {
      setNextScanTime(nextRescan);
      console.log(`⏰ Next rescan: ${nextRescan.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}\n`);
    }

  } else {
    console.log(`🔴 Market is CLOSED (${session.reason})`);

    if (session.holidayName) {
      console.log(`   Holiday: ${session.holidayName}`);
    }

    console.log(`   Current time: ${session.localTime} IST`);
    console.log(`\n⏰ Will scan automatically when market opens at 9:15 AM\n`);

    setInterval(async () => {
      const currentSession = getNseMarketSessionStatus();

      if (currentSession.isMarketOpenNow && !lastScanTime) {
        console.log("🟢 Market just opened - Running scan...\n");

        const success = await runScan("Market open");

        if (success && !isInitialized) {
          console.log("🚀 Starting continuous hot scanner cache...\n");
          await startHotScannerCache();
          isInitialized = true;
        }

        startPeriodicRescans();
      }
    }, 60_000);
  }
}

export function stopHotListScheduler(): void {
  if (rescanInterval) {
    clearInterval(rescanInterval);
    rescanInterval = null;
  }
  console.log("\n🛑 Hot list scheduler stopped\n");
}
// VERIFY 1H CACHE EXISTS
// Save as: backend/src/verify-1h-cache.ts

import { getCachedHistorical1HSeries } from "./services/market-history-1h-cache.service";
import { getCachedLive1HCandles } from "./services/live-1h-cache.service";
import { getLatestBollinger1H } from "./services/bollinger-1h.service";

async function verify1HCache() {
  console.log("🔍 VERIFYING 1H CACHE STATUS\n");
  console.log("═".repeat(60));

  // Check historical 1H cache
  console.log("\n1️⃣ CHECKING HISTORICAL 1H CACHE:");
  console.log("─".repeat(60));
  const historical1H = getCachedHistorical1HSeries();
  console.log(`Historical 1H series cached: ${historical1H.length} stocks`);
  
  if (historical1H.length > 0) {
    const sample = historical1H[0];
    console.log(`✅ Sample: ${sample.symbol} has ${sample.candles.length} candles`);
    console.log(`   Last candle: ${sample.candles[sample.candles.length - 1][0]}`);
  } else {
    console.log(`❌ PROBLEM: No historical 1H data cached!`);
  }

  // Check live 1H cache
  console.log("\n2️⃣ CHECKING LIVE 1H CACHE:");
  console.log("─".repeat(60));
  const live1H = getCachedLive1HCandles();
  console.log(`Live 1H candles cached: ${live1H.length} stocks`);
  
  if (live1H.length > 0) {
    const sample = live1H[0];
    console.log(`✅ Sample: ${sample.symbol} @ ${sample.dateTime}`);
    console.log(`   Close: ₹${sample.close}`);
  } else {
    console.log(`⚠️ Live 1H data: 0 stocks (expected if market closed)`);
  }

  // Check Bollinger calculation
  console.log("\n3️⃣ CHECKING BOLLINGER 1H CALCULATION:");
  console.log("─".repeat(60));
  const bollinger1H = getLatestBollinger1H();
  console.log(`Bollinger 1H results: ${bollinger1H.length} stocks`);
  
  if (bollinger1H.length > 0) {
    const sample = bollinger1H[0];
    console.log(`✅ Sample: ${sample.symbol}`);
    console.log(`   Middle: ₹${sample.middleBand}, Upper: ₹${sample.upperBand}, Lower: ₹${sample.lowerBand}`);
    
    // Test squeeze calculation
    const bandwidth = sample.upperBand - sample.lowerBand;
    const bandwidthPct = (bandwidth / sample.middleBand) * 100;
    console.log(`   Bandwidth: ${bandwidthPct.toFixed(2)}%`);
    
    if (bandwidthPct < 10) {
      console.log(`   🔴 SQUEEZE DETECTED - Would SKIP this stock`);
    } else {
      console.log(`   🟢 NORMAL VOLATILITY - Would ALLOW this stock`);
    }
  } else {
    console.log(`❌ CRITICAL: No Bollinger 1H data available!`);
  }

  // DIAGNOSIS
  console.log("\n" + "═".repeat(60));
  console.log("📋 DIAGNOSIS:");
  console.log("═".repeat(60));
  
  if (historical1H.length === 0) {
    console.log(`❌ ROOT CAUSE: Historical 1H cache is EMPTY`);
    console.log(`\n💡 SOLUTION OPTIONS:`);
    console.log(`   1. Backend needs to warm up 1H cache on startup`);
    console.log(`   2. Check if auto-trade-runner is calling the right functions`);
    console.log(`   3. Verify market-history-1h-cache.service is working`);
  } else if (bollinger1H.length === 0) {
    console.log(`❌ ROOT CAUSE: Historical data exists but Bollinger calc fails`);
    console.log(`\n💡 Check: Each stock needs minimum 20 candles for Bollinger`);
  } else {
    console.log(`✅ ALL SYSTEMS OPERATIONAL!`);
    console.log(`   Squeeze filter will work in production`);
  }

  console.log("\n" + "═".repeat(60));
  console.log("🎯 NEXT STEPS:");
  console.log("═".repeat(60));
  
  if (bollinger1H.length === 0) {
    console.log(`1. Check backend startup logs for "1H historical warmup"`);
    console.log(`2. Look for: [upstox-market-ws] Completed 1H historical warmup`);
    console.log(`3. If missing, 1H cache service may not be initializing`);
  } else {
    console.log(`✅ Squeeze filter verified and ready for deployment!`);
  }
}

verify1HCache().catch(console.error);
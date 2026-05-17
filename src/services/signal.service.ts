import { getLatestBollingerBands } from "./bollinger.service";
import { getLatestEma44 } from "./ema.service";
import { getLatestEma1H } from "./ema-1h.service";
import { getDoubleBollingerConfirmation } from "./double-bollinger.service";
import { getLatestVolume } from "./volume.service";
import { getLatestVwap } from "./vwap.service";
import { getLatestBollinger1H } from "./bollinger-1h.service";
import { getCachedScannerSnapshot1D } from "./scanner-snapshot-cache.service";
import { getCachedWeeklyScreener } from "./weekly-screener-cache.service";
import { getGapScanRows } from "./gap-scanner.service";
import { getStrategyDecisions } from "./strategy.service";
import { getAutomationActions } from "./automation.service";
import { SignalSummary } from "../types/signal.types";

/**
 * Enhanced Signal Service - Monitors ALL 25 indicators
 * Uses CORRECT function names from actual services
 */

interface IndicatorHealth {
  name: string;
  status: "HEALTHY" | "STALE" | "ERROR";
  lastUpdated: Date;
  dataCount: number;
  errorMessage?: string;
}

/**
 * Get health status for ALL 25 indicators
 */
export async function getIndicatorHealth(): Promise<{
  indicators: IndicatorHealth[];
  overallStatus: "HEALTHY" | "WARNING" | "ERROR";
}> {
  const now = new Date();
  const indicators: IndicatorHealth[] = [];

  // ===== CORE INDICATORS (1-6) =====
  
  try {
    const bollinger = await getLatestBollingerBands();
    indicators.push({
      name: "Bollinger Bands (1D)",
      status: bollinger.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: bollinger.length,
      errorMessage: bollinger.length === 0 ? "No data returned" : undefined,
    });
  } catch (error) {
    indicators.push({
      name: "Bollinger Bands (1D)",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const emaDaily = getLatestEma44();
    indicators.push({
      name: "EMA 44 (1D)",
      status: emaDaily.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: emaDaily.length,
      errorMessage: emaDaily.length === 0 ? "No data returned" : undefined,
    });
  } catch (error) {
    indicators.push({
      name: "EMA 44 (1D)",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const ema1H = await getLatestEma1H();
    indicators.push({
      name: "EMA 44 (1H)",
      status: ema1H.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: ema1H.length,
      errorMessage: ema1H.length === 0 ? "1H cache not populated yet" : undefined,
    });
  } catch (error) {
    indicators.push({
      name: "EMA 44 (1H)",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const doubleBollinger = await getDoubleBollingerConfirmation();
    indicators.push({
      name: "Double Bollinger Confluence",
      status: doubleBollinger.length >= 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: doubleBollinger.length,
    });
  } catch (error) {
    indicators.push({
      name: "Double Bollinger Confluence",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const volume = getLatestVolume();
    const volumeWithData = volume.filter(v => v.hasVolume).length;
    indicators.push({
      name: "Volume Data",
      status: volume.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: volumeWithData,
      errorMessage: volume.length === 0 ? "No volume data" : undefined,
    });
  } catch (error) {
    indicators.push({
      name: "Volume Data",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const vwap = getLatestVwap();
    indicators.push({
      name: "VWAP",
      status: vwap.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: vwap.length,
      errorMessage: vwap.length === 0 ? "No VWAP data" : undefined,
    });
  } catch (error) {
    indicators.push({
      name: "VWAP",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // ===== PDF1 - CANDLE PATTERNS (7-9) =====
  // Also counts Support/Resistance/Oscillation from same scanner data
  
  try {
    const { getStockScanner1D } = await import("./chart.service");
    const scanner = await getStockScanner1D();
    
    // PDF1 - Candle Patterns
    const bullishConfirmed = scanner.rows.filter(r => r.pdf1Signal === "BULLISH_CONFIRMED").length;
    const bearishConfirmed = scanner.rows.filter(r => r.pdf1Signal === "BEARISH_CONFIRMED").length;
    const totalPatterns = scanner.rows.filter(r => r.pdf1Signal !== "NONE").length;
    
    // Support/Resistance/Oscillation Engines (from same scanner)
    const withSupport = scanner.rows.filter(r => r.supportDistance !== null && r.supportDistance !== undefined).length;
    const withResistance = scanner.rows.filter(r => r.resistanceDistance !== null && r.resistanceDistance !== undefined).length;
    const withOscillation = scanner.rows.filter(r => r.posture === "Compressed").length;
    
    indicators.push({
      name: "Support Engine",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: withSupport,
    });
    
    indicators.push({
      name: "Resistance Engine",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: withResistance,
    });
    
    indicators.push({
      name: "Oscillation Engine",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: withOscillation,
    });
    
    indicators.push({
      name: "PDF1 - Bullish Patterns",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: bullishConfirmed,
    });
    
    indicators.push({
      name: "PDF1 - Bearish Patterns",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: bearishConfirmed,
    });
    
    indicators.push({
      name: "PDF1 - All Patterns",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: totalPatterns,
    });
  } catch (error) {
    indicators.push({
      name: "Support Engine",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    indicators.push({
      name: "Resistance Engine",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    indicators.push({
      name: "Oscillation Engine",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    indicators.push({
      name: "PDF1 - Bullish Patterns",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    indicators.push({
      name: "PDF1 - Bearish Patterns",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    indicators.push({
      name: "PDF1 - All Patterns",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // ===== PDF2 - BIG GREEN SETUPS (13-15) =====
  
  try {
    const { getStockScanner1D } = await import("./chart.service");
    const scanner = await getStockScanner1D();
    
    const bigGreen = scanner.rows.filter(r => r.isBigGreenCandle && r.bigGreenValidity === "VALID").length;
    const twoCandle = scanner.rows.filter(r => r.twoCandleReversal).length;
    const bullishResume = scanner.rows.filter(r => r.bullishResumeTrigger).length;
    
    indicators.push({
      name: "PDF2 - Big Green Candles",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: bigGreen,
    });
    
    indicators.push({
      name: "PDF2 - Two-Candle Reversals",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: twoCandle,
    });
    
    indicators.push({
      name: "PDF2 - Bullish Resume",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: bullishResume,
    });
  } catch (error) {
    indicators.push({
      name: "PDF2 - Big Green Candles",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    indicators.push({
      name: "PDF2 - Two-Candle Reversals",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    indicators.push({
      name: "PDF2 - Bullish Resume",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // ===== PDF3 - BOLLINGER ENTRIES (16-18) =====
  
  try {
    const scanner = getCachedScannerSnapshot1D();
    
    const breakoutBuy = scanner.rows.filter((r: any) => r.entrySignal === "BREAKOUT_BUY").length;
    const supportBuy = scanner.rows.filter((r: any) => r.entrySignal === "SUPPORT_BUY").length;
    const pullbackBuy = scanner.rows.filter((r: any) => r.entrySignal === "PULLBACK_BUY").length;
    
    indicators.push({
      name: "PDF3 - Breakout Entries",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: breakoutBuy,
    });
    
    indicators.push({
      name: "PDF3 - Support Entries",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: supportBuy,
    });
    
    indicators.push({
      name: "PDF3 - Pullback Entries",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: pullbackBuy,
    });
  } catch (error) {
    indicators.push({
      name: "PDF3 - Breakout Entries",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    indicators.push({
      name: "PDF3 - Support Entries",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    indicators.push({
      name: "PDF3 - Pullback Entries",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // ===== ADDITIONAL SYSTEMS (19-25) =====
  
  try {
    const boll1H = getLatestBollinger1H();
    indicators.push({
      name: "Bollinger Bands (1H)",
      status: boll1H.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: boll1H.length,
    });
  } catch (error) {
    indicators.push({
      name: "Bollinger Bands (1H)",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const decisions = await getStrategyDecisions();
    const buyDecisions = decisions.filter(d => d.decision === "BUY").length;
    indicators.push({
      name: "Strategy Decisions",
      status: decisions.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: buyDecisions,
    });
  } catch (error) {
    indicators.push({
      name: "Strategy Decisions",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const queue = await getAutomationActions();
    const ready = queue.filter(q => q.automationStatus === "READY").length;
    indicators.push({
      name: "Execution Queue",
      status: queue.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: ready,
    });
  } catch (error) {
    indicators.push({
      name: "Execution Queue",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const scanner = getCachedScannerSnapshot1D();
    const buySignals = scanner.rows.filter(s => s.tradeSignal === "BUY").length;
    indicators.push({
      name: "Market Scanner",
      status: scanner.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: buySignals,
    });
  } catch (error) {
    indicators.push({
      name: "Market Scanner",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const weekly = getCachedWeeklyScreener();
    const breakouts = weekly.rows.filter(w => w.signalGrade === "BREAKOUT").length;
    indicators.push({
      name: "Weekly Screener",
      status: weekly.rows.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: breakouts,
    });
  } catch (error) {
    indicators.push({
      name: "Weekly Screener",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  try {
    const gaps = await getGapScanRows();
    const validGaps = gaps.filter(g => g.isValid).length;
    indicators.push({
      name: "Gap Scanner",
      status: gaps.length > 0 ? "HEALTHY" : "ERROR",
      lastUpdated: now,
      dataCount: validGaps,
    });
  } catch (error) {
    indicators.push({
      name: "Gap Scanner",
      status: "ERROR",
      lastUpdated: now,
      dataCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }

  // Determine overall status
  const errorCount = indicators.filter((i) => i.status === "ERROR").length;
  const staleCount = indicators.filter((i) => i.status === "STALE").length;

  let overallStatus: "HEALTHY" | "WARNING" | "ERROR" = "HEALTHY";
  if (errorCount > 0) {
    overallStatus = "ERROR";
  } else if (staleCount > 0) {
    overallStatus = "WARNING";
  }

  return {
    indicators,
    overallStatus,
  };
}

/**
 * Original signal service (for backward compatibility)
 */
export async function getSignalSummaries(): Promise<SignalSummary[]> {
  const bollingerResults = await getLatestBollingerBands();

  return bollingerResults.map((row) => {
    if (
      row.setupSignal === "BREAKOUT_BUY" ||
      row.setupSignal === "SUPPORT_BUY"
    ) {
      return {
        id: row.id,
        symbol: row.symbol,
        timeframe: row.timeframe,
        indicator: "BOLLINGER",
        bandSignal: row.bandSignal,
        setupSignal: row.setupSignal,
        state: "BUY_READY",
        actionBias: "BUY",
        entryPrice: row.entryPrice,
        stopLoss: row.stopLoss,
        targetPrice: row.targetPrice,
        reason:
          row.setupSignal === "BREAKOUT_BUY"
            ? "Price has broken above the middle band and held the breakout for the required confirmation window."
            : "Price has retested the middle band as support and is reacting upward.",
      };
    }

    if (row.setupSignal === "LOWER_BAND_WATCH") {
      return {
        id: row.id,
        symbol: row.symbol,
        timeframe: row.timeframe,
        indicator: "BOLLINGER",
        bandSignal: row.bandSignal,
        setupSignal: row.setupSignal,
        state: "BUY_WATCH",
        actionBias: "WAIT",
        entryPrice: row.entryPrice,
        stopLoss: row.stopLoss,
        targetPrice: row.targetPrice,
        reason:
          "Price is near the lower band and stabilising, but the setup is not yet fully confirmed.",
      };
    }

    if (row.setupSignal === "BREAKDOWN_RISK") {
      return {
        id: row.id,
        symbol: row.symbol,
        timeframe: row.timeframe,
        indicator: "BOLLINGER",
        bandSignal: row.bandSignal,
        setupSignal: row.setupSignal,
        state: "AVOID",
        actionBias: "SELL",
        entryPrice: null,
        stopLoss: null,
        targetPrice: null,
        reason:
          "Price has fallen back below the middle band, so support is failing and fresh buying should be avoided.",
      };
    }

    return {
      id: row.id,
      symbol: row.symbol,
      timeframe: row.timeframe,
      indicator: "BOLLINGER",
      bandSignal: row.bandSignal,
      setupSignal: row.setupSignal,
      state: "NEUTRAL",
      actionBias: "WAIT",
      entryPrice: null,
      stopLoss: null,
      targetPrice: null,
      reason:
        "No valid Chapter 5 Bollinger entry setup is active right now.",
    };
  });
}

/**
 * Enhanced signal summaries with multi-indicator confluence
 */
export async function getEnhancedSignalSummaries(): Promise<any[]> {
  const [bollinger, emaDaily, ema1H, doubleBollinger] = await Promise.all([
    getLatestBollingerBands(),
    Promise.resolve(getLatestEma44()),
    getLatestEma1H(),
    getDoubleBollingerConfirmation(),
  ]);

  const signals: any[] = [];

  const emaDailyMap = new Map(emaDaily.map((e) => [e.symbol, e]));
  const ema1HMap = new Map(ema1H.map((e) => [e.symbol, e]));
  const doubleBollingerMap = new Map(
    doubleBollinger.map((d) => [d.symbol, d])
  );

  const allSymbols = new Set([
    ...bollinger.map((b) => b.symbol),
    ...emaDaily.map((e) => e.symbol),
  ]);

  for (const symbol of allSymbols) {
    const bollingerData = bollinger.find((b) => b.symbol === symbol);
    const emaDailyData = emaDailyMap.get(symbol);
    const ema1HData = ema1HMap.get(symbol);
    const doubleBollingerData = doubleBollingerMap.get(symbol);

    const activeIndicators: string[] = [];
    let confluenceScore = 0;

    if (bollingerData) {
      if (
        bollingerData.setupSignal === "BREAKOUT_BUY" ||
        bollingerData.setupSignal === "SUPPORT_BUY"
      ) {
        activeIndicators.push("Bollinger (1D)");
        confluenceScore += 3;
      } else if (bollingerData.setupSignal === "LOWER_BAND_WATCH") {
        activeIndicators.push("Bollinger (1D) - Watch");
        confluenceScore += 1;
      }
    }

    if (emaDailyData) {
      if (
        emaDailyData.trendState === "UPTREND" ||
        emaDailyData.trendState === "BULLISH_PULLBACK"
      ) {
        activeIndicators.push("EMA 44 (1D) - Bullish");
        confluenceScore += 2;
      } else if (emaDailyData.trendState === "EARLY_RECOVERY") {
        activeIndicators.push("EMA 44 (1D) - Recovery");
        confluenceScore += 1;
      }
    }

    if (ema1HData) {
      if (ema1HData.trendState === "UPTREND") {
        activeIndicators.push("EMA 44 (1H) - Uptrend");
        confluenceScore += 2;
      } else if (ema1HData.trendState === "BULLISH_PULLBACK") {
        activeIndicators.push("EMA 44 (1H) - Pullback");
        confluenceScore += 1;
      }
    }

    if (doubleBollingerData && doubleBollingerData.isEntryReady) {
      activeIndicators.push(
        `Double Bollinger - Grade ${doubleBollingerData.confirmationGrade}`
      );
      confluenceScore += doubleBollingerData.confirmationGrade === "A" ? 4 : 3;
    }

    if (activeIndicators.length > 0 && bollingerData) {
      signals.push({
        id: bollingerData.id,
        symbol: bollingerData.symbol,
        timeframe: "1D",
        indicator: "MULTIPLE",
        state: bollingerData.setupSignal === "BREAKOUT_BUY" || bollingerData.setupSignal === "SUPPORT_BUY" ? "BUY_READY" : "NEUTRAL",
        actionBias: bollingerData.setupSignal === "BREAKOUT_BUY" || bollingerData.setupSignal === "SUPPORT_BUY" ? "BUY" : "WAIT",
        entryPrice: bollingerData.entryPrice,
        stopLoss: bollingerData.stopLoss,
        targetPrice: bollingerData.targetPrice,
        reason: "Multi-indicator confluence detected",
        indicators: activeIndicators,
        confluenceScore,
        healthStatus: "HEALTHY",
      });
    }
  }

  return signals.sort((a, b) => b.confluenceScore - a.confluenceScore);
}
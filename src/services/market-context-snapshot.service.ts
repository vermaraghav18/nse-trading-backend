import { Bollinger1HResult } from "../types/bollinger-1h.types";
import { Ema1HResult } from "../types/ema-1h.types";
import { StockScannerRow } from "../types/chart.types";

/**
 * Complete market context snapshot for a symbol at a specific moment
 */
export type MarketContextSnapshot = {
  timestamp: string;
  symbol: string;
  
  // Daily timeframe data (from scanner row)
  daily: {
    close: number;
    bollingerPosition: string;
    posture: string;
    distanceToResistance: number | null;
    distanceToSupport: number | null;
    ema7Slant: string | null;
    ema14Slant: string | null;
    trendScore: number;
    stopLossLevel: number | null;
  };
  
  // 2H timeframe data
  twoHour: {
    close: number;
    upperBand?: number;
    middleBand?: number;
    lowerBand?: number;
    ema44?: number;
    ema7Slant?: string;
    ema14Slant?: string;
    priceVsEma44?: string;
    trendState?: string;
  } | null;
  
  // 1H timeframe data
  oneHour: {
    close: number;
    upperBand?: number;
    middleBand?: number;
    lowerBand?: number;
    ema44?: number;
    ema7Slant?: string;
    priceVsEma44?: string;
  } | null;
};

/**
 * Entry snapshot with decision context
 */
export type EntrySnapshot = {
  timestamp: string;
  price: number;
  quantity: number;
  signalSource: string;
  setupQuality: "HIGH" | "MED" | "LOW";
  reason: string;
  shortReason: string;
  
  // Risk parameters
  stopLoss: number | null;
  target: number | null;
  riskRewardRatio: number | null;
  riskPercent: number;
  rewardPercent: number;
  
  // Complete market state
  marketContext: MarketContextSnapshot;
};

/**
 * Exit snapshot with decision context
 */
export type ExitSnapshot = {
  timestamp: string;
  price: number;
  exitReason: string;
  reason: string;
  shortReason: string;
  
  // Exit trigger details
  triggerDetails: {
    triggerType: string;
    triggerCondition: string;
    profitAtTrigger: number;
    peakProfitBeforeExit: number;
  };
  
  // P&L breakdown
  realizedPnL: number;
  realizedPnLPercent: number;
  peakUnrealizedPnL: number;
  peakUnrealizedPnLPercent: number;
  gaveBackPnL: number;
  gaveBackPercent: number;
  
  // Complete market state at exit
  marketContext: MarketContextSnapshot;
};

/**
 * Enhanced trade structure with complete forensic data
 */
export type EnhancedTradeJournal = {
  id: string;
  symbol: string;
  status: "OPEN" | "CLOSED";
  
  // Entry snapshot
  entry: EntrySnapshot;
  
  // Tracking during trade
  tracking: {
    peakPrice: number;
    peakPriceTime: string | null;
    lowestPrice: number;
    lowestPriceTime: string | null;
    consecutive1HBelowMiddle: number;
    holdingDays: number;
  };
  
  // Exit snapshot (null if still open)
  exit: ExitSnapshot | null;
  
  // Performance metrics
  metrics: {
    entryAccuracy: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    exitAccuracy: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    holdEfficiency: number;  // % of peak profit captured
    riskManagement: "PROTECTED" | "STOP_HIT" | "RUNAWAY_LOSS";
    setupFollowThrough: boolean;
  } | null;
  
  // Tags for analysis
  tags: string[];
};

/**
 * Capture complete market context snapshot
 */
export function captureMarketContext(
  symbol: string,
  scannerRow: StockScannerRow | null,
  boll1H: Bollinger1HResult | null,
  ema1H: Ema1HResult | null,
  boll2H: Bollinger1HResult | null,
  ema2H: Ema1HResult | null
): MarketContextSnapshot {
  const timestamp = new Date().toISOString();
  
  // Daily data from scanner row (using ONLY fields that exist)
  const daily = scannerRow ? {
    close: scannerRow.latestClose ?? 0,
    bollingerPosition: scannerRow.bollingerPosition,
    posture: scannerRow.posture,
    distanceToResistance: scannerRow.resistanceDistance,
    distanceToSupport: scannerRow.supportDistance,
    ema7Slant: scannerRow.ema7dSlant,
    ema14Slant: scannerRow.ema14dSlant,
    trendScore: scannerRow.trendScore,
    stopLossLevel: scannerRow.stopLossLevel,
  } : {
    close: 0,
    bollingerPosition: "UNKNOWN",
    posture: "Open Range",
    distanceToResistance: null,
    distanceToSupport: null,
    ema7Slant: null,
    ema14Slant: null,
    trendScore: 0,
    stopLossLevel: null,
  };
  
  // 2H data
  const twoHour = (boll2H || ema2H) ? {
    close: boll2H?.currentClose ?? ema2H?.currentClose ?? 0,
    upperBand: boll2H?.upperBand,
    middleBand: boll2H?.middleBand,
    lowerBand: boll2H?.lowerBand,
    ema44: ema2H?.ema44,
    ema7Slant: ema2H?.ema7dSlant,
    ema14Slant: ema2H?.ema14dSlant,
    priceVsEma44: ema2H?.priceVsEma44,
    trendState: ema2H?.trendState,
  } : null;
  
  // 1H data
  const oneHour = (boll1H || ema1H) ? {
    close: boll1H?.currentClose ?? ema1H?.currentClose ?? 0,
    upperBand: boll1H?.upperBand,
    middleBand: boll1H?.middleBand,
    lowerBand: boll1H?.lowerBand,
    ema44: ema1H?.ema44,
    ema7Slant: ema1H?.ema7dSlant,
    priceVsEma44: ema1H?.priceVsEma44,
  } : null;
  
  return {
    timestamp,
    symbol,
    daily,
    twoHour,
    oneHour,
  };
}

/**
 * Build entry snapshot with full context
 */
export function buildEntrySnapshot(
  entryPrice: number,
  quantity: number,
  signalSource: string,
  setupQuality: "HIGH" | "MED" | "LOW",
  entryReason: string,
  shortReason: string,
  stopLoss: number | null,
  target: number | null,
  marketContext: MarketContextSnapshot
): EntrySnapshot {
  const riskAmount = stopLoss ? entryPrice - stopLoss : 0;
  const rewardAmount = target ? target - entryPrice : 0;
  const riskPercent = (riskAmount / entryPrice) * 100;
  const rewardPercent = (rewardAmount / entryPrice) * 100;
  const riskRewardRatio = riskAmount > 0 ? rewardAmount / riskAmount : null;
  
  return {
    timestamp: new Date().toISOString(),
    price: entryPrice,
    quantity,
    signalSource,
    setupQuality,
    reason: entryReason,
    shortReason,
    stopLoss,
    target,
    riskRewardRatio,
    riskPercent: Math.round(riskPercent * 100) / 100,
    rewardPercent: Math.round(rewardPercent * 100) / 100,
    marketContext,
  };
}

/**
 * Build exit snapshot with full context
 */
export function buildExitSnapshot(
  exitPrice: number,
  exitReason: string,
  exitReasonDetailed: string,
  shortReason: string,
  entryPrice: number,
  peakPrice: number,
  marketContext: MarketContextSnapshot
): ExitSnapshot {
  const realizedPnL = exitPrice - entryPrice;
  const realizedPnLPercent = (realizedPnL / entryPrice) * 100;
  const peakUnrealizedPnL = peakPrice - entryPrice;
  const peakUnrealizedPnLPercent = (peakUnrealizedPnL / entryPrice) * 100;
  const gaveBackPnL = peakPrice - exitPrice;
  const gaveBackPercent = ((gaveBackPnL / entryPrice) * 100);
  
  return {
    timestamp: new Date().toISOString(),
    price: exitPrice,
    exitReason,
    reason: exitReasonDetailed,
    shortReason,
    triggerDetails: {
      triggerType: exitReason,
      triggerCondition: extractTriggerCondition(exitReason),
      profitAtTrigger: Math.round(realizedPnLPercent * 100) / 100,
      peakProfitBeforeExit: Math.round(peakUnrealizedPnLPercent * 100) / 100,
    },
    realizedPnL: Math.round(realizedPnL * 100) / 100,
    realizedPnLPercent: Math.round(realizedPnLPercent * 100) / 100,
    peakUnrealizedPnL: Math.round(peakUnrealizedPnL * 100) / 100,
    peakUnrealizedPnLPercent: Math.round(peakUnrealizedPnLPercent * 100) / 100,
    gaveBackPnL: Math.round(gaveBackPnL * 100) / 100,
    gaveBackPercent: Math.round(gaveBackPercent * 100) / 100,
    marketContext,
  };
}

/**
 * Extract trigger condition description from exit reason
 */
function extractTriggerCondition(exitReason: string): string {
  switch (exitReason) {
    case "TRAILING_STOP_2H": return "2H close below 2H EMA44";
    case "STOP_LOSS_1H_MIDDLE_BAND": return "2 consecutive 1H closes below 1H middle band";
    case "STOP_LOSS_DAILY_LOWER_BAND": return "Close below daily lower Bollinger band";
    case "HIT_RESISTANCE": return "Price near resistance with 1H rejection";
    case "PROFIT_TARGET_5PCT": return "Profit reached 5%";
    case "EXHAUSTION_DETECTED": return "Exhaustion with 2H trend fade";
    case "BROKEN_BELOW_MIDDLE": return "Price broke below daily middle band";
    case "MAX_HOLD_EXCEEDED": return "Holding period exceeded 10 days";
    default: return "Manual exit";
  }
}
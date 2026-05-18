import { StockScannerRow } from "../types/chart.types";
import { PaperTradeSignalSource, PaperTradeExitReason } from "../types/paper-trade.types";
import { Bollinger1HResult } from "../types/bollinger-1h.types";
import { Ema1HResult } from "../types/ema-1h.types";
import {
  hasOpenTrade,
  getOpenTrade,
  createPaperTrade,
  closePaperTrade,
  wasRecentlyClosed,
  update1HConsecutiveCount,
} from "./paper-trade.service";
import { getNseMarketSessionStatus } from "./nse-market-calendar.service";
import {
  captureMarketContext,
  buildEntrySnapshot,
  buildExitSnapshot,
} from "./market-context-snapshot.service";
import {
  createEnhancedTradeEntry,
  updateEnhancedTradeTracking,
  closeEnhancedTrade,
} from "./enhanced-trade-journal.service";
// ── PHASE 1: OI service import ──
import { fetchOiForSymbol, isFoEligible } from "./futures-oi.service";
// ── PHASE 3: RRG filter ──
import { getIndexRrg1D } from "./rrg.service";

// ─── Filter Statistics (for monitoring) ────────────────
interface FilterStats {
  totalScanned: number;
  passedOI: number;
  passedVolume: number;
  passedSqueeze: number;
  passedEMA: number;
  passedRR: number;
  passedRRG: number;
  skippedOI: number;
  skippedVolume: number;
  skippedSqueeze: number;
  skippedEMA: number;
  skippedRR: number;
  skippedRRG: number;
  entered: number;
  resetAt: Date;
}

let filterStats: FilterStats = {
  totalScanned: 0,
  passedOI: 0,
  passedVolume: 0,
  passedSqueeze: 0,
  passedEMA: 0,
  passedRR: 0,
  passedRRG: 0,
  skippedOI: 0,
  skippedVolume: 0,
  skippedSqueeze: 0,
  skippedEMA: 0,
  skippedRR: 0,
  skippedRRG: 0,
  entered: 0,
  resetAt: new Date()
};

export function getFilterStats(): FilterStats {
  return { ...filterStats };
}

export function resetFilterStats(): void {
  filterStats = {
    totalScanned: 0,
    passedOI: 0,
    passedVolume: 0,
    passedSqueeze: 0,
    passedEMA: 0,
    passedRR: 0,
    passedRRG: 0,
    skippedOI: 0,
    skippedVolume: 0,
    skippedSqueeze: 0,
    skippedEMA: 0,
    skippedRR: 0,
    skippedRRG: 0,
    entered: 0,
    resetAt: new Date()
  };
}

// ─── Multi-timeframe data for a single symbol ──────────

type SymbolMTFData = {
  boll1H: Bollinger1HResult | null;
  ema1H: Ema1HResult | null;
  boll2H: Bollinger1HResult | null;
  ema2H: Ema1HResult | null;
};

// ─── 1H/2H confirmation helpers ────────────────────────

function is1HEntryConfirmed(
  mtf: SymbolMTFData,
  _entryType: PaperTradeSignalSource
): boolean {
  const { boll1H, ema1H } = mtf;

  // If 1H data is unavailable, allow entry (graceful degradation)
  if (!boll1H || !ema1H) return true;

  // 1H candle must be above 1H middle Bollinger Band
  if (boll1H.currentClose < boll1H.middleBand) return false;

  // 1H EMA7 slant must not be DOWNWARD (UPWARD or FLAT ok)
  if (ema1H.ema7dSlant === "DOWNWARD") return false;

  return true;
}

function is2HTrendConfirmed(
  mtf: SymbolMTFData,
  entryType: PaperTradeSignalSource
): boolean {
  const { boll2H, ema2H } = mtf;

  // If 2H data is unavailable, allow entry (graceful degradation)
  if (!boll2H || !ema2H) return true;

  // For lower band holds, the bar is lower — just need to be above lower band
  if (entryType === "PDF3_LOWER_HOLD_BUY") {
    if (boll2H.currentClose < boll2H.lowerBand) return false;
    if (ema2H.ema7dSlant === "DOWNWARD") return false;
    return true;
  }

  // For reversals at structural lows, 2H EMA7 not downward is enough
  if (entryType === "PDF2_REVERSAL" || entryType === "PDF2_TWO_CANDLE_REVERSAL") {
    if (ema2H.ema7dSlant === "DOWNWARD" && ema2H.ema14dSlant === "DOWNWARD") return false;
    return true;
  }

  // For breakouts, pullbacks, retests — need 2H above middle band + EMA7 upward
  if (boll2H.currentClose < boll2H.middleBand) return false;
  if (ema2H.ema7dSlant === "DOWNWARD") return false;

  return true;
}

// ─── MTF reason builder ────────────────────────────────

function buildMtfEntryReason(mtf: SymbolMTFData): string {
  const parts: string[] = [];

  if (mtf.boll1H) {
    const diff1H = ((mtf.boll1H.currentClose - mtf.boll1H.middleBand) / mtf.boll1H.middleBand * 100).toFixed(2);
    parts.push(`1H: close ₹${mtf.boll1H.currentClose} is ${Number(diff1H) >= 0 ? "+" : ""}${diff1H}% from middle band ₹${mtf.boll1H.middleBand}`);
  }

  if (mtf.ema1H) {
    parts.push(`1H EMA7 slant: ${mtf.ema1H.ema7dSlant}, price vs EMA44: ${mtf.ema1H.priceVsEma44}`);
  }

  if (mtf.boll2H) {
    const diff2H = ((mtf.boll2H.currentClose - mtf.boll2H.middleBand) / mtf.boll2H.middleBand * 100).toFixed(2);
    parts.push(`2H: close ₹${mtf.boll2H.currentClose} is ${Number(diff2H) >= 0 ? "+" : ""}${diff2H}% from middle band ₹${mtf.boll2H.middleBand}`);
  }

  if (mtf.ema2H) {
    parts.push(`2H EMA7 slant: ${mtf.ema2H.ema7dSlant}, trend: ${mtf.ema2H.trendState}`);
  }

  if (parts.length === 0) return "[MTF data unavailable — 1D only]";
  return `[MTF: ${parts.join(" | ")}]`;
}

function buildMtfExitReason(mtf: SymbolMTFData, exitType: PaperTradeExitReason): string {
  const parts: string[] = [];

  if (exitType === "STOP_LOSS_1H_MIDDLE_BAND" && mtf.boll1H) {
    parts.push(`1H close ₹${mtf.boll1H.currentClose} dropped below 1H middle band ₹${mtf.boll1H.middleBand} for 2 consecutive candles`);
  }

  if (exitType === "STOP_LOSS_DAILY_LOWER_BAND") {
    parts.push(`Price broke below daily lower Bollinger Band floor`);
  }

  if (exitType === "TRAILING_STOP_2H" && mtf.ema2H) {
    parts.push(`2H close ₹${mtf.ema2H.currentClose} fell below 2H EMA44 ₹${mtf.ema2H.ema44} while P&L was above +2%`);
  }

  if (exitType === "HIT_RESISTANCE" && mtf.ema1H) {
    parts.push(`1H confirmed rejection: close ₹${mtf.ema1H.currentClose} below 1H EMA44 ₹${mtf.ema1H.ema44}`);
  }

  if (exitType === "EXHAUSTION_DETECTED" && mtf.ema2H) {
    parts.push(`2H trend fading: EMA7 slant ${mtf.ema2H.ema7dSlant}, trend ${mtf.ema2H.trendState}`);
  }

  if (parts.length === 0) return "";
  return ` [${parts.join(" | ")}]`;
}

// ─── PHASE 2: Bollinger Squeeze Filter ─────────────────
/**
 * Detects Bollinger Bands squeeze using bandwidth.
 * Squeeze = Low volatility, likely false breakouts
 * 
 * SQUEEZE DETECTION:
 * - Calculate bandwidth: (upper - lower) / middle
 * - Squeeze if bandwidth < 10% (tight bands)
 * - Normal if bandwidth >= 10%
 */
function checkSqueezeFilter(
  row: StockScannerRow,
  mtf: SymbolMTFData
): { shouldSkip: boolean; reason: string } {
  
  // Use 1H Bollinger data (more responsive than daily)
  if (!mtf.boll1H) {
    filterStats.passedSqueeze++;
    return {
      shouldSkip: false,
      reason: "1H Bollinger data unavailable"
    };
  }

  // Calculate bandwidth as percentage of middle band
  const bandwidth = mtf.boll1H.upperBand - mtf.boll1H.lowerBand;
  const bandwidthPct = (bandwidth / mtf.boll1H.middleBand) * 100;

  // Squeeze threshold: 10%
  // If bands are within 10% of price, it's a squeeze (low volatility)
  const SQUEEZE_THRESHOLD = 10;

  if (bandwidthPct < SQUEEZE_THRESHOLD) {
    filterStats.skippedSqueeze++;
    return {
      shouldSkip: true,
      reason: `Bollinger squeeze detected - bandwidth ${bandwidthPct.toFixed(1)}% (too tight, wait for expansion)`
    };
  }

  // Normal volatility = good for trading
  filterStats.passedSqueeze++;
  return {
    shouldSkip: false,
    reason: `Normal volatility - bandwidth ${bandwidthPct.toFixed(1)}%`
  };
}

// ─── PHASE 2: EMA Trend Filter ──────────────────────────
/**
 * Checks EMA trend strength.
 * SKIP: Both EMAs not rising OR price below EMA
 * ALLOW: Strong uptrend
 */
function checkEmaTrendFilter(
  row: StockScannerRow,
  mtf: SymbolMTFData
): { shouldSkip: boolean; reason: string } {
  
  // If no 1H/2H data, allow (graceful degradation)
  if (!mtf.ema1H || !mtf.ema2H) {
    filterStats.passedEMA++;
    return {
      shouldSkip: false,
      reason: "EMA data unavailable"
    };
  }

  // Both 1H EMAs must be rising
  if (mtf.ema1H.ema7dSlant !== "UPWARD" || mtf.ema1H.ema14dSlant !== "UPWARD") {
    filterStats.skippedEMA++;
    return {
      shouldSkip: true,
      reason: "1H EMAs not rising - weak trend"
    };
  }

  // Price must be above 1H EMA44
  if (mtf.ema1H.priceVsEma44 === "BELOW_EMA") {
    filterStats.skippedEMA++;
    return {
      shouldSkip: true,
      reason: "Price below 1H EMA44 - not in uptrend"
    };
  }

  filterStats.passedEMA++;
  return {
    shouldSkip: false,
    reason: "Strong EMA trend confirmed"
  };
}

// ─── PHASE 3: Minimum R:R Filter ────────────────────────
/**
 * Ensures minimum 1:2 risk-reward ratio.
 */
function checkMinimumRR(
  entryPrice: number,
  stopLoss: number | null,
  targetResistance: number | null
): { shouldSkip: boolean; reason: string } {
  
  if (!stopLoss || !targetResistance) {
    filterStats.passedRR++;
    return {
      shouldSkip: false,
      reason: "R:R data unavailable"
    };
  }

  const risk = entryPrice - stopLoss;
  const reward = targetResistance - entryPrice;
  
  if (risk <= 0 || reward <= 0) {
    filterStats.passedRR++;
    return {
      shouldSkip: false,
      reason: "Invalid R:R calculation"
    };
  }

  const rr = reward / risk;

  if (rr < 2.0) {
    filterStats.skippedRR++;
    return {
      shouldSkip: true,
      reason: `Low R:R ratio: 1:${rr.toFixed(1)} (minimum 1:2.0 required)`
    };
  }

  filterStats.passedRR++;
  return {
    shouldSkip: false,
    reason: `Good R:R: 1:${rr.toFixed(1)}`
  };
}

// ─── PHASE 3: RRG Sector Filter ─────────────────────────
/**
 * Checks sector strength via RRG.
 * SKIP: LAGGING or WEAKENING sectors
 * ALLOW: LEADING or IMPROVING sectors
 */
function checkRrgSectorFilter(
  symbol: string,
  rrgData: any[]
): { shouldSkip: boolean; reason: string } {
  
  const sectorData = rrgData.find(r => r.symbol === symbol);
  
  if (!sectorData) {
    filterStats.passedRRG++;
    return {
      shouldSkip: false,
      reason: "RRG data unavailable"
    };
  }

  // Skip weak sectors
  if (sectorData.quadrant === "LAGGING" || sectorData.quadrant === "WEAKENING") {
    filterStats.skippedRRG++;
    return {
      shouldSkip: true,
      reason: `Sector in ${sectorData.quadrant} quadrant - avoid weak sectors`
    };
  }

  // LEADING or IMPROVING = good
  filterStats.passedRRG++;
  return {
    shouldSkip: false,
    reason: `Sector: ${sectorData.quadrant}`
  };
}

// ─── PHASE 1: Volume Confirmation Filter ───────────────
/**
 * Checks volume confirmation for breakout entries.
 * For PDF3_BREAKOUT_BUY, require at least NORMAL volume.
 */
function checkVolumeConfirmation(
  row: StockScannerRow,
  entryType: PaperTradeSignalSource
): { shouldSkip: boolean; reason: string } {
  
  // Volume filter only applies to breakouts
  if (entryType !== "PDF3_BREAKOUT_BUY") {
    return {
      shouldSkip: false,
      reason: "N/A (not a breakout)"
    };
  }

  // Check if volume data is available
  if (!row.volumeConfirmation || row.volumeConfirmation === "UNKNOWN") {
    console.log(`[auto-trade] ⚠️ ${row.symbol} - Volume data unavailable, allowing entry anyway`);
    return {
      shouldSkip: false,
      reason: "Volume data unavailable"
    };
  }

  // For breakouts, require at least "NORMAL" volume
  // (LOW volume breakouts are filtered out)
  if (row.volumeConfirmation === "LOW") {
    filterStats.skippedVolume++;
    return {
      shouldSkip: true,
      reason: "Breakout has LOW volume - likely false breakout"
    };
  }

  // NORMAL or HIGH volume = good
  console.log(`[auto-trade] ✅ ${row.symbol} - Breakout volume: ${row.volumeConfirmation}`);
  filterStats.passedVolume++;
  return {
    shouldSkip: false,
    reason: `Volume confirmed: ${row.volumeConfirmation}`
  };
}

// ─── PHASE 1: OI Buildup Filter ────────────────────────
/**
 * Checks F&O Open Interest buildup type.
 * SKIP: SHORT_BUILDUP, LONG_UNWINDING (bearish sentiment)
 * ALLOW: LONG_BUILDUP, SHORT_COVERING (bullish sentiment)
 * ALLOW: NO_DATA (non-F&O stocks)
 */
async function checkOiBuildupFilter(symbol: string): Promise<{
  shouldSkip: boolean;
  reason: string;
  oiData: any | null;
}> {
  // Non-F&O stocks pass automatically
  if (!isFoEligible(symbol)) {
    return {
      shouldSkip: false,
      reason: "Not F&O eligible",
      oiData: null
    };
  }

  // Fetch OI data
  let oiData;
  try {
    oiData = await fetchOiForSymbol(symbol);
  } catch (err) {
    console.log(`[auto-trade] ⚠️ ${symbol} - OI fetch failed, allowing entry anyway:`, err);
    return {
      shouldSkip: false,
      reason: "OI data unavailable",
      oiData: null
    };
  }

  // Skip bearish OI buildups
  if (oiData.buildupType === "SHORT_BUILDUP") {
    filterStats.skippedOI++;
    return {
      shouldSkip: true,
      reason: `F&O shows SHORT BUILDUP (OI: ${oiData.oiChangePct?.toFixed(2)}%) - Bearish institutional sentiment`,
      oiData
    };
  }

  if (oiData.buildupType === "LONG_UNWINDING") {
    filterStats.skippedOI++;
    return {
      shouldSkip: true,
      reason: `F&O shows LONG UNWINDING (OI: ${oiData.oiChangePct?.toFixed(2)}%) - Bearish institutional exit`,
      oiData
    };
  }

  // Log bullish sentiment
  if (oiData.buildupType === "LONG_BUILDUP") {
    console.log(`[auto-trade] ✅ ${symbol} - LONG BUILDUP detected (OI: +${oiData.oiChangePct?.toFixed(2)}%)`);
  }

  if (oiData.buildupType === "SHORT_COVERING") {
    console.log(`[auto-trade] ✅ ${symbol} - SHORT COVERING detected (OI: ${oiData.oiChangePct?.toFixed(2)}%)`);
  }

  filterStats.passedOI++;
  return {
    shouldSkip: false,
    reason: `F&O sentiment: ${oiData.buildupType}`,
    oiData
  };
}

// ─── Entry evaluation ───────────────────────────────────

type EntryDecision = {
  shouldEnter: boolean;
  signalSource: PaperTradeSignalSource;
  reason: string;
};

async function evaluateEntry(
  row: StockScannerRow,
  mtf: SymbolMTFData,
  rrgData: any[]
): Promise<EntryDecision> {
  const noEntry: EntryDecision = {
    shouldEnter: false,
    signalSource: "MANUAL",
    reason: "",
  };

  filterStats.totalScanned++;

  // ── Gate 0: Universal blockers (1D only) ──
  if (hasOpenTrade(row.symbol)) return noEntry;
  if (wasRecentlyClosed(row.symbol)) return noEntry;
  if (row.isExhaustionRisk) return noEntry;
  if (row.nearHighCaution) return noEntry;
  if (row.posture === "Near Resistance") return noEntry;
  if (row.scannerGrade === "D") return noEntry;

  // ── PHASE 1: Gate 0.5: F&O OI Buildup Filter ──
  const oiCheck = await checkOiBuildupFilter(row.symbol);
  if (oiCheck.shouldSkip) {
    console.log(`[auto-trade] ❌ ${row.symbol} - SKIPPED: ${oiCheck.reason}`);
    return noEntry;
  }

  // ── PHASE 2: Gate 0.6: Bollinger Squeeze Filter ──
  const squeezeCheck = checkSqueezeFilter(row, mtf);
  if (squeezeCheck.shouldSkip) {
    console.log(`[auto-trade] ❌ ${row.symbol} - SKIPPED: ${squeezeCheck.reason}`);
    return noEntry;
  }

  // ── PHASE 2: Gate 0.7: EMA Trend Filter ──
  const emaCheck = checkEmaTrendFilter(row, mtf);
  if (emaCheck.shouldSkip) {
    console.log(`[auto-trade] ❌ ${row.symbol} - SKIPPED: ${emaCheck.reason}`);
    return noEntry;
  }

  // ── PHASE 3: Gate 0.8: RRG Sector Filter ──
  const rrgCheck = checkRrgSectorFilter(row.symbol, rrgData);
  if (rrgCheck.shouldSkip) {
    console.log(`[auto-trade] ❌ ${row.symbol} - SKIPPED: ${rrgCheck.reason}`);
    return noEntry;
  }

  // ── PHASE 3: Gate 0.9: Minimum R:R Filter (checked later per setup) ──

  // ── Priority 1: PDF2 Two-Candle Reversal ──
  if (row.setupType === "TWO_CANDLE_REVERSAL" && row.pdf2Signal === "BUY") {
    const source: PaperTradeSignalSource = "PDF2_TWO_CANDLE_REVERSAL";
    
    // PHASE 3: Check R:R before other checks
    const targetResistance = row.resistanceDistance !== null && row.latestClose
      ? row.latestClose * (1 + row.resistanceDistance / 100)
      : null;
    const rrCheck = checkMinimumRR(row.latestClose || 0, row.stopLossLevel, targetResistance);
    if (rrCheck.shouldSkip) {
      console.log(`[auto-trade] ❌ ${row.symbol} - SKIPPED: ${rrCheck.reason}`);
      return noEntry;
    }
    
    if (!is2HTrendConfirmed(mtf, source)) return noEntry;
    if (!is1HEntryConfirmed(mtf, source)) return noEntry;

    filterStats.entered++;
    return {
      shouldEnter: true,
      signalSource: source,
      reason: `Two-candle reversal at structural low (range position ${(row.rangePosition * 100).toFixed(0)}%). Big green validity: ${row.bigGreenValidity}. Body dominance: ${(row.bodyDominanceRatio * 100).toFixed(1)}%. ${buildMtfEntryReason(mtf)}`,
    };
  }

  // ── Priority 2: PDF2 Reversal ──
  if (row.setupType === "REVERSAL" && row.pdf2Signal === "BUY") {
    const source: PaperTradeSignalSource = "PDF2_REVERSAL";
    if (!is2HTrendConfirmed(mtf, source)) return noEntry;
    if (!is1HEntryConfirmed(mtf, source)) return noEntry;

    filterStats.entered++;
    return {
      shouldEnter: true,
      signalSource: source,
      reason: `Big green candle reversal at structural low. Price move: ${row.priceMovePercent}%. Range position: ${(row.rangePosition * 100).toFixed(0)}%. Body dominance: ${(row.bodyDominanceRatio * 100).toFixed(1)}%. ${buildMtfEntryReason(mtf)}`,
    };
  }

  // ── Priority 3: PDF3 Breakout Buy ──
  if (row.entrySignal === "BREAKOUT_BUY" && row.middleBandHoldConfirmed) {
    const source: PaperTradeSignalSource = "PDF3_BREAKOUT_BUY";
    
    // PHASE 1: Volume confirmation required for breakouts
    const volumeCheck = checkVolumeConfirmation(row, source);
    if (volumeCheck.shouldSkip) {
      console.log(`[auto-trade] ❌ ${row.symbol} - BREAKOUT SKIPPED: ${volumeCheck.reason}`);
      return noEntry;
    }
    
    if (!is2HTrendConfirmed(mtf, source)) return noEntry;
    if (!is1HEntryConfirmed(mtf, source)) return noEntry;

    filterStats.entered++;
    return {
      shouldEnter: true,
      signalSource: source,
      reason: `Price broke above middle Bollinger Band and held for ${row.daysAboveMiddleBand}/5 days. Crossover confirmed. Appreciation since crossover: ${row.appreciationSinceCrossover}%. Volume: ${row.volumeConfirmation}. ${buildMtfEntryReason(mtf)}`,
    };
  }

  // ── Priority 4: PDF3 Retest Buy ──
  if (row.entrySignal === "RETEST_BUY" && row.middleBandSupportHolding) {
    const source: PaperTradeSignalSource = "PDF3_RETEST_BUY";
    if (!is2HTrendConfirmed(mtf, source)) return noEntry;
    if (!is1HEntryConfirmed(mtf, source)) return noEntry;

    filterStats.entered++;
    return {
      shouldEnter: true,
      signalSource: source,
      reason: `Price pulled back from upper band to middle band and is holding. Middle band acting as support. Next day bounce: ${row.nextDayBounceConfirmed ? "YES" : "NO"}. ${buildMtfEntryReason(mtf)}`,
    };
  }

  // ── Priority 5: PDF3 Lower Band Hold ──
  if (row.entrySignal === "LOWER_HOLD_BUY" && row.lowerBandHoldConfirmed) {
    const source: PaperTradeSignalSource = "PDF3_LOWER_HOLD_BUY";
    if (!is2HTrendConfirmed(mtf, source)) return noEntry;
    if (!is1HEntryConfirmed(mtf, source)) return noEntry;

    filterStats.entered++;
    return {
      shouldEnter: true,
      signalSource: source,
      reason: `Price held above lower Bollinger Band for ${row.daysAboveLowerBand}/5 days. Lower band providing support. ${buildMtfEntryReason(mtf)}`,
    };
  }

  // ── Priority 6: PDF2 Pullback ──
  if (row.setupType === "PULLBACK" && row.pdf2Signal === "BUY" && row.bullishResumeTrigger) {
    const source: PaperTradeSignalSource = "PDF2_PULLBACK";
    if (!is2HTrendConfirmed(mtf, source)) return noEntry;
    if (!is1HEntryConfirmed(mtf, source)) return noEntry;

    filterStats.entered++;
    return {
      shouldEnter: true,
      signalSource: source,
      reason: `Pullback to middle band with bullish resume trigger. Range position: ${(row.rangePosition * 100).toFixed(0)}%. ${buildMtfEntryReason(mtf)}`,
    };
  }

  // ── Priority 7: PDF1 Bullish Confirmed ──
  if (
    row.pdf1Signal === "BULLISH_CONFIRMED" &&
    row.recentPriceLocation === "RECENT_LOW" &&
    row.buyZone
  ) {
    const source: PaperTradeSignalSource = "PDF1_BULLISH_CONFIRMED";
    if (!is2HTrendConfirmed(mtf, source)) return noEntry;
    if (!is1HEntryConfirmed(mtf, source)) return noEntry;

    filterStats.entered++;
    return {
      shouldEnter: true,
      signalSource: source,
      reason: `PDF1 bullish confirmed at recent low. In buy zone with structural support. ${buildMtfEntryReason(mtf)}`,
    };
  }

  return noEntry;
}

// ─── Exit evaluation ────────────────────────────────────

type ExitDecision = {
  shouldExit: boolean;
  exitReason: PaperTradeExitReason;
};

function evaluateExit(
  row: StockScannerRow,
  mtf: SymbolMTFData
): ExitDecision {
  const noExit: ExitDecision = {
    shouldExit: false,
    exitReason: "MANUAL",
  };

  const trade = getOpenTrade(row.symbol);
  if (!trade || !row.latestClose) return noExit;

  const pnlPct = ((row.latestClose - trade.entryPrice) / trade.entryPrice) * 100;

  // ── Exit 1: Hit resistance ──
  if (trade.targetResistance && row.latestClose >= trade.targetResistance) {
    return { shouldExit: true, exitReason: "HIT_RESISTANCE" };
  }

  // ── Exit 2: Stop loss — daily middle band ──
  if (row.entrySignal === "BROKEN_BELOW" && row.middleBandBroken) {
    return { shouldExit: true, exitReason: "STOP_LOSS_MIDDLE_BAND" };
  }

  // ── Exit 3: Stop loss — 1H middle band (2 consecutive candles) ──
  if (mtf.boll1H && row.latestClose < mtf.boll1H.middleBand) {
    update1HConsecutiveCount(row.symbol, true);
    const consecutiveCount = trade.consecutive1HBelowMiddle ?? 0;
    if (consecutiveCount >= 2) {
      return { shouldExit: true, exitReason: "STOP_LOSS_1H_MIDDLE_BAND" };
    }
  } else {
    update1HConsecutiveCount(row.symbol, false);
  }

  // ── Exit 4: Stop loss — daily lower band ──
  if (trade.stopLossLevel && row.latestClose < trade.stopLossLevel) {
    return { shouldExit: true, exitReason: "STOP_LOSS_DAILY_LOWER_BAND" };
  }

  // ── Exit 5: Profit target 5% ──
  if (pnlPct >= 5.0) {
    return { shouldExit: true, exitReason: "PROFIT_TARGET_5PCT" };
  }

  // ── Exit 6: Trailing stop (2H EMA44) if P&L > +2% ──
  if (pnlPct >= 2.0 && mtf.ema2H) {
    if (row.latestClose < mtf.ema2H.ema44) {
      return { shouldExit: true, exitReason: "TRAILING_STOP_2H" };
    }
  }

  // ── Exit 7: Exhaustion detected ──
  if (pnlPct >= 3.0) {
    const confirmed2HFade =
      !mtf.ema2H ||
      mtf.ema2H.ema7dSlant === "DOWNWARD" ||
      mtf.ema2H.ema7dSlant === "FLAT";
    if (confirmed2HFade) {
      return { shouldExit: true, exitReason: "EXHAUSTION_DETECTED" };
    }
  }

  // ── Exit 8: PDF3 broken below daily middle band ──
  if (row.entrySignal === "BROKEN_BELOW" && row.middleBandBroken) {
    return { shouldExit: true, exitReason: "BROKEN_BELOW_MIDDLE" };
  }

  // ── Exit 9: Max holding period (10 trading days) ──
  if (trade.holdingDays >= 10) {
    return { shouldExit: true, exitReason: "MAX_HOLD_EXCEEDED" };
  }

  return noExit;
}

// ─── Build MTF lookup from arrays ───────────────────────

function buildMtfMap(
  boll1HData: Bollinger1HResult[],
  ema1HData: Ema1HResult[],
  boll2HData: Bollinger1HResult[],
  ema2HData: Ema1HResult[]
): Map<string, SymbolMTFData> {
  const map = new Map<string, SymbolMTFData>();

  const boll1HMap = new Map(boll1HData.map((b) => [b.symbol, b]));
  const ema1HMap = new Map(ema1HData.map((e) => [e.symbol, e]));
  const boll2HMap = new Map(boll2HData.map((b) => [b.symbol, b]));
  const ema2HMap = new Map(ema2HData.map((e) => [e.symbol, e]));

  const allSymbols = new Set([
    ...boll1HMap.keys(),
    ...ema1HMap.keys(),
    ...boll2HMap.keys(),
    ...ema2HMap.keys(),
  ]);

  for (const sym of allSymbols) {
    map.set(sym, {
      boll1H: boll1HMap.get(sym) ?? null,
      ema1H: ema1HMap.get(sym) ?? null,
      boll2H: boll2HMap.get(sym) ?? null,
      ema2H: ema2HMap.get(sym) ?? null,
    });
  }

  return map;
}

// ─── Helper functions ───────────────────────────────────

/**
 * Determine setup quality from scanner row
 */
function determineSetupQuality(row: StockScannerRow): "HIGH" | "MED" | "LOW" {
  if (row.entryQuality === "HIGH") return "HIGH";
  if (row.entryQuality === "MEDIUM") return "MED";
  return "LOW";
}

/**
 * Format signal source as short label
 */
function formatSignalSourceShort(source: PaperTradeSignalSource): string {
  switch (source) {
    case "PDF1_BULLISH_CONFIRMED": return "Bullish confirmed";
    case "PDF2_REVERSAL": return "Reversal";
    case "PDF2_TWO_CANDLE_REVERSAL": return "2-candle reversal";
    case "PDF2_PULLBACK": return "Pullback";
    case "PDF3_BREAKOUT_BUY": return "Breakout";
    case "PDF3_RETEST_BUY": return "Retest bounce";
    case "PDF3_LOWER_HOLD_BUY": return "Support hold";
    default: return "Manual";
  }
}

/**
 * Format exit reason as short label
 */
function formatExitReasonShort(reason: PaperTradeExitReason): string {
  switch (reason) {
    case "HIT_RESISTANCE": return "Resistance hit";
    case "STOP_LOSS_MIDDLE_BAND": return "SL triggered";
    case "STOP_LOSS_1H_MIDDLE_BAND": return "1H SL triggered";
    case "STOP_LOSS_DAILY_LOWER_BAND": return "Daily floor hit";
    case "PROFIT_TARGET_5PCT": return "Target 5%";
    case "TRAILING_STOP_2H": return "2H trail stop";
    case "EXHAUSTION_DETECTED": return "Exhaustion";
    case "BROKEN_BELOW_MIDDLE": return "Support broke";
    case "MAX_HOLD_EXCEEDED": return "Max hold";
    default: return "Manual";
  }
}

// ─── Main scan cycle ────────────────────────────────────

export async function runAutoTradeEngine(
  scannerRows: StockScannerRow[],
  boll1HData: Bollinger1HResult[] = [],
  ema1HData: Ema1HResult[] = [],
  boll2HData: Bollinger1HResult[] = [],
  ema2HData: Ema1HResult[] = []
): Promise<void> {
  const session = getNseMarketSessionStatus();

  if (!session.isMarketOpenNow) {
    const holidayLabel = session.holidayName ? ` (${session.holidayName})` : "";
    console.log(
      `[auto-trade] Blocked: ${session.reason}${holidayLabel} | ${session.localDate} ${session.localTime} IST`
    );
    return;
  }

  // PHASE 3: Fetch RRG data
  let rrgData: any[] = [];
  
  try {
    const rrgResult = await getIndexRrg1D();
    rrgData = rrgResult.rows || [];
  } catch (err) {
    console.log(`[auto-trade] ⚠️ RRG data unavailable, allowing all entries`);
  }

  const mtfMap = buildMtfMap(boll1HData, ema1HData, boll2HData, ema2HData);

  let entriesThisCycle = 0;
  let exitsThisCycle = 0;

  for (const row of scannerRows) {
    const emptyMtf: SymbolMTFData = {
      boll1H: null,
      ema1H: null,
      boll2H: null,
      ema2H: null,
    };
    const mtf = mtfMap.get(row.symbol) ?? emptyMtf;

    // Check exits first (more important)
    if (hasOpenTrade(row.symbol)) {
      const exitDecision = evaluateExit(row, mtf);

      if (exitDecision.shouldExit) {
        const currentPrice = row.latestClose ?? 0;
        const trade = getOpenTrade(row.symbol);

        if (trade && currentPrice > 0) {
          const mtfExitDetail = buildMtfExitReason(mtf, exitDecision.exitReason);
          console.log(`[auto-trade] EXIT ${row.symbol}: ${exitDecision.exitReason}${mtfExitDetail}`);
          
          // Capture market context at exit
          const exitMarketContext = captureMarketContext(
            row.symbol,
            row,
            mtf.boll1H,
            mtf.ema1H,
            mtf.boll2H,
            mtf.ema2H
          );
          
          // Build exit snapshot
          const exitSnapshot = buildExitSnapshot(
            currentPrice,
            exitDecision.exitReason,
            trade.exitReasonDetailed || "",
            formatExitReasonShort(exitDecision.exitReason),
            trade.entryPrice,
            trade.peakPrice,
            exitMarketContext
          );
          
          // Close enhanced trade
          closeEnhancedTrade(trade.id, exitSnapshot);
          
          await closePaperTrade(trade.id, currentPrice, exitDecision.exitReason);
          exitsThisCycle++;
        }
      }

      continue;
    }

    // Check entries (PHASE 1+2+3: Now with all filters)
    const entryDecision = await evaluateEntry(row, mtf, rrgData);

    if (entryDecision.shouldEnter && row.latestClose && row.latestClose > 0) {
      
      // Capture market context at entry
      const entryMarketContext = captureMarketContext(
        row.symbol,
        row,
        mtf.boll1H,
        mtf.ema1H,
        mtf.boll2H,
        mtf.ema2H
      );
      
      const targetResistance =
        row.resistanceDistance !== null && row.latestClose
          ? row.latestClose * (1 + row.resistanceDistance / 100)
          : null;
      
      // Build entry snapshot
      const entrySnapshot = buildEntrySnapshot(
        row.latestClose,
        1, // quantity
        entryDecision.signalSource,
        determineSetupQuality(row),
        entryDecision.reason,
        formatSignalSourceShort(entryDecision.signalSource),
        row.stopLossLevel ?? null,
        targetResistance,
        entryMarketContext
      );
      
      const trade = await createPaperTrade({
        symbol: row.symbol,
        entryPrice: row.latestClose,
        signalSource: entryDecision.signalSource,
        reason: entryDecision.reason,
        stopLossLevel: row.stopLossLevel ?? null,
        targetResistance,
      });
      
      // Create enhanced trade entry
      createEnhancedTradeEntry(trade.id, row.symbol, entrySnapshot);
      
      entriesThisCycle++;
    }
  }

  // PHASE 1+2+3: Log all filter statistics
  console.log(`
[auto-trade] ═══════════════════════════════════════════
[auto-trade] ALL PHASES FILTER STATS:
[auto-trade] Scanned: ${filterStats.totalScanned}
[auto-trade] ──────────────────────────────────────────
[auto-trade] OI Filter:      Passed ${filterStats.passedOI} | Skipped ${filterStats.skippedOI}
[auto-trade] Volume Filter:  Passed ${filterStats.passedVolume} | Skipped ${filterStats.skippedVolume}
[auto-trade] Squeeze Filter: Passed ${filterStats.passedSqueeze} | Skipped ${filterStats.skippedSqueeze}
[auto-trade] EMA Filter:     Passed ${filterStats.passedEMA} | Skipped ${filterStats.skippedEMA}
[auto-trade] R:R Filter:     Passed ${filterStats.passedRR} | Skipped ${filterStats.skippedRR}
[auto-trade] RRG Filter:     Passed ${filterStats.passedRRG} | Skipped ${filterStats.skippedRRG}
[auto-trade] ──────────────────────────────────────────
[auto-trade] ENTERED: ${filterStats.entered}
[auto-trade] ═══════════════════════════════════════════
  `);

  if (entriesThisCycle > 0 || exitsThisCycle > 0) {
    console.log(
      `[auto-trade] Cycle complete: ${entriesThisCycle} entries, ${exitsThisCycle} exits`
    );
  }
}
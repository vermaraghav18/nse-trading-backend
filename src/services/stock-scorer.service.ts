import { StockScannerRow } from "../types/chart.types";
import { Bollinger1HResult } from "../types/bollinger-1h.types";
import { Ema1HResult } from "../types/ema-1h.types";
import { getRrgIndexForStock } from "../utils/sector-to-rrg-map";

// RRG data type (from rrg.service.ts)
type RrgRow = {
  symbol: string;
  quadrant: "LEADING" | "WEAKENING" | "LAGGING" | "IMPROVING";
  current: {
    rsRatio: number;
    rsMomentum: number;
  };
};

export type StockScore = {
  symbol: string;
  totalScore: number;
  breakdown: {
    sector: number;
    volume: number;
    squeeze: number;
    emaTrend: number;
    riskReward: number;
    setupPriority: number;
    scannerGrade: number;
  };
  reason: string;
};

/**
 * Calculate quality score for a stock (0-100 points)
 */
export function calculateStockScore(
  symbol: string,
  scanner1D: StockScannerRow | null,
  boll1H: Bollinger1HResult | null,
  ema1H: Ema1HResult | null,
  rrgData: RrgRow[]
): StockScore {
  const breakdown = {
    sector: 0,
    volume: 0,
    squeeze: 0,
    emaTrend: 0,
    riskReward: 0,
    setupPriority: 0,
    scannerGrade: 0,
  };

  const reasons: string[] = [];

  // If no scanner data, return 0
  if (!scanner1D) {
    return {
      symbol,
      totalScore: 0,
      breakdown,
      reason: "No scanner data available",
    };
  }

  // ── 1. SECTOR STRENGTH (20 points max) ──────────────────
  const rrgIndexSymbol = getRrgIndexForStock(symbol);
  const sectorData = rrgIndexSymbol 
    ? rrgData.find((r) => r.symbol === rrgIndexSymbol)
    : null;

  if (sectorData) {
    if (sectorData.quadrant === "LEADING") {
      breakdown.sector = 20;
      reasons.push(`${sectorData.symbol.replace("NIFTY", "")}: LEADING`);
    } else if (sectorData.quadrant === "IMPROVING") {
      breakdown.sector = 15;
      reasons.push(`${sectorData.symbol.replace("NIFTY", "")}: IMPROVING`);
    } else if (sectorData.quadrant === "WEAKENING") {
      breakdown.sector = 5;
      reasons.push(`${sectorData.symbol.replace("NIFTY", "")}: WEAKENING`);
    } else {
      breakdown.sector = 0;
      reasons.push(`${sectorData.symbol.replace("NIFTY", "")}: LAGGING`);
    }
  } else {
    breakdown.sector = 10; // Default for unknown sectors
  }

  // ── 2. VOLUME CONFIRMATION (15 points max) ──────────────
  if (scanner1D.entrySignal === "BREAKOUT_BUY") {
    if (scanner1D.volumeConfirmation === "HIGH") {
      breakdown.volume = 15;
      reasons.push("Volume: HIGH");
    } else if (scanner1D.volumeConfirmation === "NORMAL") {
      breakdown.volume = 10;
      reasons.push("Volume: NORMAL");
    } else {
      breakdown.volume = 0;
      reasons.push("Volume: LOW");
    }
  } else {
    breakdown.volume = 10; // N/A for non-breakouts
  }

  // ── 3. BOLLINGER SQUEEZE (15 points max) ────────────────
  if (boll1H) {
    const bandwidth =
      ((boll1H.upperBand - boll1H.lowerBand) / boll1H.middleBand) * 100;

    if (bandwidth > 15) {
      breakdown.squeeze = 15;
      reasons.push(`Bandwidth: ${bandwidth.toFixed(1)}% (High)`);
    } else if (bandwidth >= 10) {
      breakdown.squeeze = 10;
      reasons.push(`Bandwidth: ${bandwidth.toFixed(1)}% (Normal)`);
    } else {
      breakdown.squeeze = 0;
      reasons.push(`Bandwidth: ${bandwidth.toFixed(1)}% (Squeeze)`);
    }
  } else {
    breakdown.squeeze = 10; // Default if no 1H data
  }

  // ── 4. EMA TREND STRENGTH (15 points max) ───────────────
  if (ema1H) {
    const bothRising =
      ema1H.ema7dSlant === "UPWARD" && ema1H.ema14dSlant === "UPWARD";
    const aboveEma44 = ema1H.priceVsEma44 === "ABOVE_EMA";

    if (bothRising && aboveEma44) {
      breakdown.emaTrend = 15;
      reasons.push("EMA: Strong uptrend");
    } else if (
      (ema1H.ema7dSlant === "UPWARD" || ema1H.ema14dSlant === "UPWARD") &&
      aboveEma44
    ) {
      breakdown.emaTrend = 8;
      reasons.push("EMA: Moderate");
    } else if (!aboveEma44) {
      breakdown.emaTrend = 0;
      reasons.push("EMA: Below EMA44");
    } else {
      breakdown.emaTrend = 3;
      reasons.push("EMA: Weak");
    }
  } else {
    breakdown.emaTrend = 10; // Default if no 1H data
  }

  // ── 5. RISK-REWARD RATIO (10 points max) ────────────────
  if (
    scanner1D.stopLossLevel &&
    scanner1D.resistanceDistance !== null &&
    scanner1D.latestClose
  ) {
    const target =
      scanner1D.latestClose * (1 + scanner1D.resistanceDistance / 100);
    const risk = scanner1D.latestClose - scanner1D.stopLossLevel;
    const reward = target - scanner1D.latestClose;

    if (risk > 0 && reward > 0) {
      const rr = reward / risk;
      if (rr >= 3.0) {
        breakdown.riskReward = 10;
        reasons.push(`R:R 1:${rr.toFixed(1)}`);
      } else if (rr >= 2.5) {
        breakdown.riskReward = 8;
        reasons.push(`R:R 1:${rr.toFixed(1)}`);
      } else if (rr >= 2.0) {
        breakdown.riskReward = 6;
        reasons.push(`R:R 1:${rr.toFixed(1)}`);
      } else if (rr >= 1.5) {
        breakdown.riskReward = 3;
        reasons.push(`R:R 1:${rr.toFixed(1)}`);
      } else {
        breakdown.riskReward = 0;
        reasons.push(`R:R 1:${rr.toFixed(1)} (Poor)`);
      }
    }
  } else {
    breakdown.riskReward = 5; // Default
  }

  // ── 6. SETUP PRIORITY (10 points max) ───────────────────
  if (scanner1D.setupType === "TWO_CANDLE_REVERSAL") {
    breakdown.setupPriority = 10;
    reasons.push("Setup: 2-Candle Rev");
  } else if (scanner1D.setupType === "REVERSAL") {
    breakdown.setupPriority = 9;
    reasons.push("Setup: Reversal");
  } else if (scanner1D.entrySignal === "BREAKOUT_BUY") {
    breakdown.setupPriority = 8;
    reasons.push("Setup: Breakout");
  } else if (scanner1D.entrySignal === "RETEST_BUY") {
    breakdown.setupPriority = 7;
    reasons.push("Setup: Retest");
  } else if (scanner1D.entrySignal === "LOWER_HOLD_BUY") {
    breakdown.setupPriority = 6;
    reasons.push("Setup: Lower Hold");
  } else if (scanner1D.setupType === "PULLBACK") {
    breakdown.setupPriority = 5;
    reasons.push("Setup: Pullback");
  } else if (scanner1D.pdf1Signal === "BULLISH_CONFIRMED") {
    breakdown.setupPriority = 4;
    reasons.push("Setup: Bullish");
  } else {
    breakdown.setupPriority = 0;
  }

  // ── 7. SCANNER GRADE (10 points max) ────────────────────
  if (scanner1D.scannerGrade === "A") {
    breakdown.scannerGrade = 10;
    reasons.push("Grade: A");
  } else if (scanner1D.scannerGrade === "B") {
    breakdown.scannerGrade = 7;
    reasons.push("Grade: B");
  } else if (scanner1D.scannerGrade === "C") {
    breakdown.scannerGrade = 3;
    reasons.push("Grade: C");
  } else {
    breakdown.scannerGrade = 0;
    reasons.push("Grade: D");
  }

  const totalScore =
    breakdown.sector +
    breakdown.volume +
    breakdown.squeeze +
    breakdown.emaTrend +
    breakdown.riskReward +
    breakdown.setupPriority +
    breakdown.scannerGrade;

  return {
    symbol,
    totalScore: Math.min(totalScore, 100),
    breakdown,
    reason: reasons.join(" | "),
  };
}
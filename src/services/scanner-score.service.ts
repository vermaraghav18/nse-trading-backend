import { StockScannerRow } from "../types/chart.types";

function clampScore(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function scoreTrend(
  row: Pick<
    StockScannerRow,
    | "ema7dSlant"
    | "ema14dSlant"
    | "bias"
    | "pattern"
    | "bollingerPosition"
    | "confirmationStatus"
  >
): number {
  let score = 0;

  if (row.ema7dSlant === "UPWARD") score += 4;
  if (row.ema14dSlant === "UPWARD") score += 4;

  if (row.ema7dSlant === "DOWNWARD") score += 4;
  if (row.ema14dSlant === "DOWNWARD") score += 4;

  if (row.bias === "BULLISH" || row.bias === "BEARISH") {
    score += 6;
  }

  if (
    row.pattern === "STRONG_BULLISH_BODY" ||
    row.pattern === "STRONG_BEARISH_BODY"
  ) {
    score += 5;
  }

  if (
    row.pattern === "LONG_LOWER_SHADOW" ||
    row.pattern === "LONG_UPPER_SHADOW" ||
    row.pattern === "TWO_DAY_BULLISH_ENTRY" ||
    row.pattern === "LARGE_BULLISH_BODY_AT_LOW"
  ) {
    score += 3;
  }

  if (row.bollingerPosition === "HIGH" || row.bollingerPosition === "LOW") {
    score += 2;
  }

  if (row.confirmationStatus === "CONFIRMED") {
    score += 4;
  } else if (row.confirmationStatus === "PENDING") {
    score += 2;
  }

  return clampScore(score, 0, 25);
}

function scoreEntry(
  row: Pick<
    StockScannerRow,
    | "buyZone"
    | "supportDistance"
    | "resistanceDistance"
    | "nearHighCaution"
    | "confirmationStatus"
    | "tradeSignal"
    | "posture"
  >
): number {
  let score = 0;

  if (row.buyZone) {
    score += 10;
  }

  if (row.supportDistance !== null) {
    if (row.supportDistance <= 0.5) score += 8;
    else if (row.supportDistance <= 1.0) score += 6;
    else if (row.supportDistance <= 2.0) score += 3;
  }

  if (row.resistanceDistance !== null) {
    if (row.resistanceDistance >= 5) score += 5;
    else if (row.resistanceDistance >= 2) score += 3;
  }

  if (!row.nearHighCaution) {
    score += 4;
  } else {
    score -= 8;
  }

  if (row.confirmationStatus === "CONFIRMED") {
    score += 5;
  } else if (row.confirmationStatus === "PENDING") {
    score += 2;
  }

  if (row.tradeSignal === "BUY" || row.tradeSignal === "SELL") {
    score += 4;
  }

  if (row.posture === "Near Support") score += 3;
  if (row.posture === "Near Resistance") score -= 2;
  if (row.posture === "Compressed") score -= 2;

  return clampScore(score, 0, 30);
}

function scorePdf1(
  row: Pick<StockScannerRow, "pdf1Signal" | "pattern" | "recentPriceLocation">
): number {
  if (
    row.pdf1Signal === "BULLISH_CONFIRMED" ||
    row.pdf1Signal === "BEARISH_CONFIRMED"
  ) {
    return 25;
  }

  if (
    row.pdf1Signal === "BULLISH_PENDING_CONFIRMATION" ||
    row.pdf1Signal === "BEARISH_PENDING_CONFIRMATION"
  ) {
    return 18;
  }

  if (
    row.pattern === "LONG_LOWER_SHADOW" ||
    row.pattern === "LONG_UPPER_SHADOW"
  ) {
    if (
      row.recentPriceLocation === "RECENT_LOW" ||
      row.recentPriceLocation === "RECENT_HIGH"
    ) {
      return 10;
    }

    return 6;
  }

  if (row.pattern === "DOJI") {
    return 4;
  }

  return 0;
}

function scoreRisk(
  row: Pick<
    StockScannerRow,
    | "volumeConfirmation"
    | "nearHighCaution"
    | "posture"
    | "supportDistance"
    | "resistanceDistance"
  >
): number {
  let score = 0;

  if (row.volumeConfirmation === "HIGH") score += 6;
  else if (row.volumeConfirmation === "NORMAL") score += 3;
  else if (row.volumeConfirmation === "LOW") score -= 2;

  if (!row.nearHighCaution) score += 5;
  else score -= 5;

  if (row.posture === "Near Support") score += 4;
  if (row.posture === "Open Range") score += 2;
  if (row.posture === "Compressed") score -= 2;
  if (row.posture === "Near Resistance") score -= 3;

  if (row.supportDistance !== null && row.supportDistance <= 1.0) {
    score += 3;
  }

  if (row.resistanceDistance !== null && row.resistanceDistance >= 3.0) {
    score += 2;
  }

  return clampScore(score, 0, 20);
}

function scorePdf2(
  row: Pick<
    StockScannerRow,
    | "setupType"
    | "pdf2Signal"
    | "isBigGreenCandle"
    | "bigGreenValidity"
    | "twoCandleReversal"
    | "isExhaustionRisk"
    | "recentPullbackToMiddle"
    | "bullishResumeTrigger"
    | "nearRelativeLow"
    | "nearRelativeHigh"
    | "priceMovePercent"
  >
): number {
  let score = 0;

  switch (row.setupType) {
    case "TWO_CANDLE_REVERSAL":
      score += 12;
      break;
    case "REVERSAL":
      score += 10;
      break;
    case "PULLBACK":
      score += 7;
      break;
    case "BREAKOUT":
      score += 5;
      break;
    case "EXHAUSTION":
      score -= 5;
      break;
    default:
      break;
  }

  if (row.isBigGreenCandle) {
    score += 5;
    if (row.bigGreenValidity === "VALID") score += 5;
    if (row.bigGreenValidity === "INVALID") score -= 8;
    if (row.priceMovePercent >= 15) score += 3;
  }

  if (row.twoCandleReversal) score += 5;

  if (row.nearRelativeLow) score += 4;
  if (row.nearRelativeHigh) score -= 4;

  if (row.recentPullbackToMiddle && row.bullishResumeTrigger) score += 4;

  if (row.isExhaustionRisk) score -= 6;

  return clampScore(score, -15, 25);
}

function resolveEntryQuality(
  entryScore: number
): StockScannerRow["entryQuality"] {
  if (entryScore >= 22) return "HIGH";
  if (entryScore >= 12) return "MEDIUM";
  return "LOW";
}

function resolveScannerGrade(
  scannerScore: number,
  row: Pick<StockScannerRow, "pdf1Signal" | "tradeSignal" | "pdf2Signal">
): StockScannerRow["scannerGrade"] {
  const hasActiveSignal =
    row.pdf1Signal !== "NONE" || row.pdf2Signal === "BUY";

  if (!hasActiveSignal) {
    if (scannerScore >= 65) return "B";
    if (scannerScore >= 45) return "C";
    return "D";
  }

  if (row.tradeSignal === "WAIT") {
    if (scannerScore >= 70) return "B";
    if (scannerScore >= 50) return "C";
    return "D";
  }

  if (scannerScore >= 80) return "A";
  if (scannerScore >= 65) return "B";
  if (scannerScore >= 45) return "C";
  return "D";
}

export function buildScannerScores(
  row: Pick<
    StockScannerRow,
    | "ema7dSlant"
    | "ema14dSlant"
    | "bias"
    | "pattern"
    | "bollingerPosition"
    | "confirmationStatus"
    | "buyZone"
    | "supportDistance"
    | "resistanceDistance"
    | "nearHighCaution"
    | "tradeSignal"
    | "posture"
    | "pdf1Signal"
    | "recentPriceLocation"
    | "volumeConfirmation"
    | "setupType"
    | "pdf2Signal"
    | "isBigGreenCandle"
    | "bigGreenValidity"
    | "twoCandleReversal"
    | "isExhaustionRisk"
    | "recentPullbackToMiddle"
    | "bullishResumeTrigger"
    | "nearRelativeLow"
    | "nearRelativeHigh"
    | "priceMovePercent"
    // PDF3 fields
    | "entrySignal"
    | "middleBandHoldConfirmed"
    | "middleBandBroken"
    | "isOverextended"
    | "lowerBandHoldConfirmed"
  >
): Pick<
  StockScannerRow,
  | "trendScore"
  | "entryScore"
  | "pdf1Score"
  | "riskScore"
  | "scannerScore"
  | "entryQuality"
  | "scannerGrade"
> {
  const trendScore = scoreTrend(row);
  const entryScore = scoreEntry(row);
  const pdf1Score = scorePdf1(row);
  const riskScore = scoreRisk(row);
  const pdf2Score = scorePdf2(row);

  let rawScore =
    trendScore * 2.5 +
    entryScore * 1.5 +
    pdf1Score * 3 +
    riskScore * 1.2 +
    pdf2Score * 2;

  if (row.pdf1Signal === "NONE") {
    rawScore -= 25;
  }

  if (row.pdf1Signal === "NONE" && row.pdf2Signal === "BUY") {
    rawScore += 15;
  }

  if (row.tradeSignal === "WAIT") {
    rawScore -= 20;
  }

  if (!row.buyZone) {
    rawScore -= 10;
  }

  const entryQuality = resolveEntryQuality(entryScore);

  if (entryQuality === "LOW") {
    rawScore -= 10;
  }

  if (row.posture === "Compressed") {
    rawScore -= 8;
  }

  if (row.posture === "Near Resistance") {
    rawScore -= 10;
  }

  if (row.isExhaustionRisk) {
    rawScore -= 10;
  }

  // PDF3 Bollinger entry scoring
  if (row.entrySignal === "BREAKOUT_BUY") rawScore += 15;
  else if (row.entrySignal === "RETEST_BUY") rawScore += 12;
  else if (row.entrySignal === "LOWER_HOLD_BUY") rawScore += 10;
  else if (row.entrySignal === "OVEREXTENDED") rawScore -= 8;
  else if (row.entrySignal === "BROKEN_BELOW") rawScore -= 12;

  if (row.middleBandHoldConfirmed) rawScore += 5;
  if (row.middleBandBroken) rawScore -= 5;

  const scannerScore = clampScore(rawScore, 0, 100);
  const scannerGrade = resolveScannerGrade(scannerScore, row);

  return {
    trendScore,
    entryScore,
    pdf1Score,
    riskScore,
    scannerScore,
    entryQuality,
    scannerGrade,
  };
}
import {
  ChartCandlePoint,
  ChartBollingerPoint,
  Pdf3BollingerEntry,
  Pdf3EntrySignal,
} from "../types/chart.types";

// ─── helpers ────────────────────────────────────────────

function findMatchingBollinger(
  candle: ChartCandlePoint,
  bollinger: ChartBollingerPoint[]
): ChartBollingerPoint | null {
  for (let i = bollinger.length - 1; i >= 0; i--) {
    if (bollinger[i].time === candle.time) return bollinger[i];
  }
  return null;
}

function isAboveMiddleBand(
  candle: ChartCandlePoint,
  boll: ChartBollingerPoint
): boolean {
  return candle.close >= boll.middleBand;
}

function isBelowMiddleBand(
  candle: ChartCandlePoint,
  boll: ChartBollingerPoint
): boolean {
  return candle.close < boll.middleBand;
}

function isNearBand(
  price: number,
  bandLevel: number,
  thresholdPercent: number
): boolean {
  return Math.abs(price - bandLevel) / Math.abs(bandLevel) <= thresholdPercent / 100;
}

// ─── Rule 1: Middle Band Breakout Hold (3-5 day) ────────

function computeMiddleBandHold(
  candles: ChartCandlePoint[],
  bollinger: ChartBollingerPoint[]
): { daysAboveMiddleBand: number; middleBandHoldConfirmed: boolean; crossoverDetected: boolean } {
  if (candles.length < 7 || bollinger.length < 7) {
    return { daysAboveMiddleBand: 0, middleBandHoldConfirmed: false, crossoverDetected: false };
  }

  // Check last 5 candles: how many closed above middle band
  const last5 = candles.slice(-5);
  let daysAbove = 0;

  for (const candle of last5) {
    const boll = findMatchingBollinger(candle, bollinger);
    if (boll && isAboveMiddleBand(candle, boll)) {
      daysAbove++;
    }
  }

  // Check if there was a crossover: the candle before the last 5 was below middle band
  const preCrossoverCandle = candles[candles.length - 6];
  const preCrossoverBoll = preCrossoverCandle
    ? findMatchingBollinger(preCrossoverCandle, bollinger)
    : null;

  const wasBelowBefore =
    preCrossoverCandle && preCrossoverBoll
      ? isBelowMiddleBand(preCrossoverCandle, preCrossoverBoll)
      : false;

  const crossoverDetected = wasBelowBefore && daysAbove >= 1;
  const middleBandHoldConfirmed = crossoverDetected && daysAbove >= 3;

  return { daysAboveMiddleBand: daysAbove, middleBandHoldConfirmed, crossoverDetected };
}

// ─── Rule 2: Overextension Guard ────────────────────────

function computeOverextension(
  candles: ChartCandlePoint[],
  bollinger: ChartBollingerPoint[],
  crossoverDetected: boolean
): { isOverextended: boolean; appreciationSinceCrossover: number } {
  if (!crossoverDetected || candles.length < 7 || bollinger.length < 7) {
    return { isOverextended: false, appreciationSinceCrossover: 0 };
  }

  // Find the crossover candle (first candle in last 5 that crossed above)
  const lookback = candles.slice(-6);
  let crossoverClose: number | null = null;

  for (let i = 1; i < lookback.length; i++) {
    const prev = lookback[i - 1];
    const curr = lookback[i];
    const prevBoll = findMatchingBollinger(prev, bollinger);
    const currBoll = findMatchingBollinger(curr, bollinger);

    if (prevBoll && currBoll && isBelowMiddleBand(prev, prevBoll) && isAboveMiddleBand(curr, currBoll)) {
      crossoverClose = curr.close;
      break;
    }
  }

  if (crossoverClose === null || crossoverClose === 0) {
    return { isOverextended: false, appreciationSinceCrossover: 0 };
  }

  const currentClose = candles[candles.length - 1].close;
  const appreciation = ((currentClose - crossoverClose) / crossoverClose) * 100;
  const rounded = Math.round(appreciation * 100) / 100;

  return {
    isOverextended: rounded > 10,
    appreciationSinceCrossover: rounded,
  };
}

// ─── Rule 3: Middle Band Support Holding ────────────────

function computeMiddleBandSupportHolding(
  candles: ChartCandlePoint[],
  bollinger: ChartBollingerPoint[]
): boolean {
  if (candles.length < 5 || bollinger.length < 5) return false;

  const lastCandle = candles[candles.length - 1];
  const lastBoll = bollinger[bollinger.length - 1];
  if (!lastBoll) return false;

  // Price must be above middle band currently
  if (lastCandle.close < lastBoll.middleBand) return false;

  // Price must be near middle band (within 2%)
  const nearMiddle = isNearBand(lastCandle.close, lastBoll.middleBand, 2);
  if (!nearMiddle) return false;

  // Was recently near upper band (within last 10 candles)
  const lookback = Math.min(10, candles.length);
  let wasNearUpper = false;

  for (let i = candles.length - lookback; i < candles.length - 1; i++) {
    const c = candles[i];
    const b = findMatchingBollinger(c, bollinger);
    if (b && isNearBand(c.high, b.upperBand, 2)) {
      wasNearUpper = true;
      break;
    }
  }

  return wasNearUpper;
}

// ─── Rule 4: Middle Band Broken ─────────────────────────

function computeMiddleBandBroken(
  candles: ChartCandlePoint[],
  bollinger: ChartBollingerPoint[]
): boolean {
  if (candles.length < 3 || bollinger.length < 3) return false;

  const lastCandle = candles[candles.length - 1];
  const lastBoll = bollinger[bollinger.length - 1];
  if (!lastBoll) return false;

  // Current close is below middle band
  if (lastCandle.close >= lastBoll.middleBand) return false;

  // Was above middle band recently (within last 5 candles)
  const lookback = candles.slice(-6, -1);
  let wasAbove = false;

  for (const c of lookback) {
    const b = findMatchingBollinger(c, bollinger);
    if (b && isAboveMiddleBand(c, b)) {
      wasAbove = true;
      break;
    }
  }

  return wasAbove;
}

// ─── Rule 5: Next Day Bounce Confirmation ───────────────

function computeNextDayBounce(
  candles: ChartCandlePoint[],
  bollinger: ChartBollingerPoint[]
): boolean {
  if (candles.length < 2 || bollinger.length < 2) return false;

  const prev = candles[candles.length - 2];
  const last = candles[candles.length - 1];
  const prevBoll = findMatchingBollinger(prev, bollinger);

  if (!prevBoll) return false;

  // Previous candle was near middle band (within 2%)
  const prevNearMiddle = isNearBand(prev.close, prevBoll.middleBand, 2);
  if (!prevNearMiddle) return false;

  // Current candle is green and closes above previous close
  const isGreen = last.close > last.open;
  const closedHigher = last.close > prev.close;

  return isGreen && closedHigher;
}

// ─── Rule 6: Lower Band Hold ────────────────────────────

function computeLowerBandHold(
  candles: ChartCandlePoint[],
  bollinger: ChartBollingerPoint[]
): { lowerBandHoldConfirmed: boolean; daysAboveLowerBand: number } {
  if (candles.length < 5 || bollinger.length < 5) {
    return { lowerBandHoldConfirmed: false, daysAboveLowerBand: 0 };
  }

  const last5 = candles.slice(-5);
  let daysAbove = 0;
  let nearLowerCount = 0;

  for (const candle of last5) {
    const boll = findMatchingBollinger(candle, bollinger);
    if (!boll) continue;

    if (candle.close >= boll.lowerBand) {
      daysAbove++;
    }

    // Check if near lower band (within 3%)
    if (isNearBand(candle.low, boll.lowerBand, 3)) {
      nearLowerCount++;
    }
  }

  // Must be near the lower band AND holding above it
  const lowerBandHoldConfirmed = daysAbove >= 3 && nearLowerCount >= 2;

  return { lowerBandHoldConfirmed, daysAboveLowerBand: daysAbove };
}

// ─── Entry Signal Classification ────────────────────────

function classifyEntrySignal(params: {
  middleBandHoldConfirmed: boolean;
  crossoverDetected: boolean;
  isOverextended: boolean;
  middleBandSupportHolding: boolean;
  middleBandBroken: boolean;
  nextDayBounceConfirmed: boolean;
  lowerBandHoldConfirmed: boolean;
}): Pdf3EntrySignal {
  const {
    middleBandHoldConfirmed,
    crossoverDetected,
    isOverextended,
    middleBandSupportHolding,
    middleBandBroken,
    nextDayBounceConfirmed,
    lowerBandHoldConfirmed,
  } = params;

  // Negative signals first
  if (isOverextended) return "OVEREXTENDED";
  if (middleBandBroken) return "BROKEN_BELOW";

  // Positive signals by priority
  if (middleBandHoldConfirmed && !isOverextended) return "BREAKOUT_BUY";
  if (middleBandSupportHolding && nextDayBounceConfirmed) return "RETEST_BUY";
  if (middleBandSupportHolding) return "RETEST_BUY";
  if (lowerBandHoldConfirmed) return "LOWER_HOLD_BUY";

  return "NONE";
}

// ─── Main export ────────────────────────────────────────

export function buildPdf3BollingerEntry(params: {
  candles: ChartCandlePoint[];
  bollinger: ChartBollingerPoint[];
}): Pdf3BollingerEntry {
  const { candles, bollinger } = params;

  const empty: Pdf3BollingerEntry = {
    middleBandHoldConfirmed: false,
    daysAboveMiddleBand: 0,
    crossoverDetected: false,
    isOverextended: false,
    appreciationSinceCrossover: 0,
    middleBandSupportHolding: false,
    middleBandBroken: false,
    nextDayBounceConfirmed: false,
    lowerBandHoldConfirmed: false,
    daysAboveLowerBand: 0,
    stopLossLevel: null,
    entrySignal: "NONE",
  };

  if (!candles || candles.length < 7 || !bollinger || bollinger.length < 7) {
    return empty;
  }

  // Rule 1
  const holdResult = computeMiddleBandHold(candles, bollinger);

  // Rule 2
  const overextResult = computeOverextension(candles, bollinger, holdResult.crossoverDetected);

  // Rule 3
  const middleBandSupportHolding = computeMiddleBandSupportHolding(candles, bollinger);

  // Rule 4
  const middleBandBroken = computeMiddleBandBroken(candles, bollinger);

  // Rule 5
  const nextDayBounceConfirmed = computeNextDayBounce(candles, bollinger);

  // Rule 6
  const lowerResult = computeLowerBandHold(candles, bollinger);

  // Rule 7: Stop loss at middle band
  const latestBoll = bollinger[bollinger.length - 1];
  const stopLossLevel = latestBoll ? Math.round(latestBoll.middleBand * 100) / 100 : null;

  // Classify
  const entrySignal = classifyEntrySignal({
    middleBandHoldConfirmed: holdResult.middleBandHoldConfirmed,
    crossoverDetected: holdResult.crossoverDetected,
    isOverextended: overextResult.isOverextended,
    middleBandSupportHolding,
    middleBandBroken,
    nextDayBounceConfirmed,
    lowerBandHoldConfirmed: lowerResult.lowerBandHoldConfirmed,
  });

  return {
    middleBandHoldConfirmed: holdResult.middleBandHoldConfirmed,
    daysAboveMiddleBand: holdResult.daysAboveMiddleBand,
    crossoverDetected: holdResult.crossoverDetected,
    isOverextended: overextResult.isOverextended,
    appreciationSinceCrossover: overextResult.appreciationSinceCrossover,
    middleBandSupportHolding,
    middleBandBroken,
    nextDayBounceConfirmed,
    lowerBandHoldConfirmed: lowerResult.lowerBandHoldConfirmed,
    daysAboveLowerBand: lowerResult.daysAboveLowerBand,
    stopLossLevel,
    entrySignal,
  };
}
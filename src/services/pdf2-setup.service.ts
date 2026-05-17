import {
  ChartCandlePoint,
  ChartBollingerPoint,
  Pdf2Setup,
  Pdf2SetupType,
  Pdf2BigGreenValidity,
  Pdf2Signal,
} from "../types/chart.types";

// ─── helpers ────────────────────────────────────────────

function bodySize(c: ChartCandlePoint): number {
  return Math.abs(c.close - c.open);
}

function rangeSize(c: ChartCandlePoint): number {
  return Math.max(c.high - c.low, 0.0001);
}

function isGreen(c: ChartCandlePoint): boolean {
  return c.close > c.open;
}

function lowerShadow(c: ChartCandlePoint): number {
  return Math.min(c.open, c.close) - c.low;
}

// ─── Section A: PDF hard rules ──────────────────────────

function detectBigGreenCandle(c: ChartCandlePoint): {
  isBigGreenCandle: boolean;
  priceMovePercent: number;
  bodyDominanceRatio: number;
  wickCompressionRatio: number;
} {
  const range = rangeSize(c);
  const body = bodySize(c);
  const bodyDominanceRatio = body / range;
  const wickCompressionRatio = 1 - bodyDominanceRatio;
  const priceMovePercent =
    c.open === 0 ? 0 : ((c.close - c.open) / c.open) * 100;

  const isBigGreenCandle =
    isGreen(c) && priceMovePercent >= 10 && bodyDominanceRatio >= 0.85;

  return {
    isBigGreenCandle,
    priceMovePercent: Math.round(priceMovePercent * 100) / 100,
    bodyDominanceRatio: Math.round(bodyDominanceRatio * 1000) / 1000,
    wickCompressionRatio: Math.round(wickCompressionRatio * 1000) / 1000,
  };
}

function computeRangePosition(
  candles: ChartCandlePoint[],
  lookback: number
): { rangePosition: number; nearRelativeLow: boolean; nearRelativeHigh: boolean } {
  const window = candles.slice(-lookback);

  if (window.length < 5) {
    return { rangePosition: 0.5, nearRelativeLow: false, nearRelativeHigh: false };
  }

  let high50 = -Infinity;
  let low50 = Infinity;

  for (const c of window) {
    if (c.high > high50) high50 = c.high;
    if (c.low < low50) low50 = c.low;
  }

  const currentClose = window[window.length - 1].close;
  const totalRange = high50 - low50;

  if (totalRange <= 0) {
    return { rangePosition: 0.5, nearRelativeLow: false, nearRelativeHigh: false };
  }

  const rangePosition =
    Math.round(((currentClose - low50) / totalRange) * 1000) / 1000;

  return {
    rangePosition,
    nearRelativeLow: rangePosition <= 0.35,
    nearRelativeHigh: rangePosition >= 0.75,
  };
}

function classifyBigGreenValidity(
  isBigGreenCandle: boolean,
  nearRelativeLow: boolean,
  nearRelativeHigh: boolean
): Pdf2BigGreenValidity {
  if (!isBigGreenCandle) return "NONE";
  if (nearRelativeLow) return "VALID";
  if (nearRelativeHigh) return "INVALID";
  return "NEUTRAL";
}

function detectTwoCandleReversal(
  candles: ChartCandlePoint[],
  nearRelativeLow: boolean
): boolean {
  if (candles.length < 2 || !nearRelativeLow) return false;

  const prev = candles[candles.length - 2];
  const last = candles[candles.length - 1];

  const prevRange = rangeSize(prev);
  const prevLowerShadow = lowerShadow(prev);
  const prevLowerShadowRatio = prevLowerShadow / prevRange;

  // Day 1: long lower shadow (>= 60% of range)
  const day1LongLowerShadow = prevLowerShadowRatio >= 0.6;

  // Day 2: strong green candle (relaxed vs full big-green — 5% move, 70% body)
  const lastBody = bodySize(last);
  const lastRange = rangeSize(last);
  const lastBodyRatio = lastBody / lastRange;
  const lastMovePercent =
    last.open === 0 ? 0 : ((last.close - last.open) / last.open) * 100;

  const day2StrongGreen =
    isGreen(last) && lastMovePercent >= 5 && lastBodyRatio >= 0.7;

  return day1LongLowerShadow && day2StrongGreen;
}

// ─── Section B: Extended rules (ChatGPT additions) ──────

function detectBollingerProximity(
  candles: ChartCandlePoint[],
  bollinger: ChartBollingerPoint[]
): {
  nowNearMiddleBand: boolean;
  recentlyWasNearUpperBand: boolean;
  recentPullbackToMiddle: boolean;
  bullishResumeTrigger: boolean;
} {
  const defaults = {
    nowNearMiddleBand: false,
    recentlyWasNearUpperBand: false,
    recentPullbackToMiddle: false,
    bullishResumeTrigger: false,
  };

  if (candles.length < 5 || bollinger.length < 10) return defaults;

  const lastCandle = candles[candles.length - 1];
  const latestBoll = bollinger[bollinger.length - 1];

  if (!latestBoll) return defaults;

  // Near middle band: within 1.5% of SMA20
  const distToMiddle =
    Math.abs(lastCandle.close - latestBoll.middleBand) /
    Math.abs(latestBoll.middleBand);
  const nowNearMiddleBand = distToMiddle < 0.015;

  // Was near upper band in last 10 bollinger points
  let recentlyWasNearUpperBand = false;
  const lookbackBoll = bollinger.slice(-10);
  const lookbackCandles = candles.slice(-10);

  for (let i = 0; i < lookbackBoll.length && i < lookbackCandles.length; i++) {
    const c = lookbackCandles[i];
    const b = lookbackBoll[i];
    const distToUpper = Math.abs(c.high - b.upperBand) / Math.abs(b.upperBand);
    if (distToUpper < 0.02) {
      recentlyWasNearUpperBand = true;
      break;
    }
  }

  const recentPullbackToMiddle = recentlyWasNearUpperBand && nowNearMiddleBand;

  // Bullish resume: pullback happened + current candle is green + closes above prev
  let bullishResumeTrigger = false;
  if (recentPullbackToMiddle && candles.length >= 2) {
    const prev = candles[candles.length - 2];
    bullishResumeTrigger =
      isGreen(lastCandle) &&
      lastCandle.close > prev.close &&
      bodySize(lastCandle) / rangeSize(lastCandle) >= 0.5;
  }

  return {
    nowNearMiddleBand,
    recentlyWasNearUpperBand,
    recentPullbackToMiddle,
    bullishResumeTrigger,
  };
}

function detectExhaustion(
  candles: ChartCandlePoint[],
  nearRelativeHigh: boolean
): boolean {
  if (!nearRelativeHigh || candles.length < 10) return false;

  // Check if there's been no meaningful pullback in last 10 candles
  const recent = candles.slice(-10);
  let maxHigh = -Infinity;
  let hadPullback = false;

  for (const c of recent) {
    if (c.high > maxHigh) maxHigh = c.high;
    const drawdown = (maxHigh - c.low) / maxHigh;
    if (drawdown >= 0.05) {
      hadPullback = true;
      break;
    }
  }

  // Exhaustion = near high + no pullback in recent history
  return !hadPullback;
}

// ─── Setup type classification ──────────────────────────

function classifySetupType(params: {
  isBigGreenCandle: boolean;
  bigGreenValidity: Pdf2BigGreenValidity;
  twoCandleReversal: boolean;
  nearRelativeLow: boolean;
  nearRelativeHigh: boolean;
  recentPullbackToMiddle: boolean;
  bullishResumeTrigger: boolean;
  isExhaustionRisk: boolean;
  lastCandle: ChartCandlePoint;
  prevCandle: ChartCandlePoint | null;
}): Pdf2SetupType {
  const {
    isBigGreenCandle,
    bigGreenValidity,
    twoCandleReversal,
    nearRelativeLow,
    nearRelativeHigh,
    recentPullbackToMiddle,
    bullishResumeTrigger,
    isExhaustionRisk,
    lastCandle,
    prevCandle,
  } = params;

  // Priority 1: Two-candle reversal (highest conviction from PDF)
  if (twoCandleReversal) return "TWO_CANDLE_REVERSAL";

  // Priority 2: Big green at structural low = REVERSAL
  if (isBigGreenCandle && bigGreenValidity === "VALID") return "REVERSAL";

  // Priority 3: Pullback to middle band with bullish resume
  if (recentPullbackToMiddle && bullishResumeTrigger) return "PULLBACK";

  // Priority 4: Exhaustion at high
  if (isExhaustionRisk && nearRelativeHigh) return "EXHAUSTION";

  // Priority 5: Breakout — green candle closing above previous high, mid-range
  if (
    prevCandle &&
    isGreen(lastCandle) &&
    lastCandle.close > prevCandle.high &&
    !nearRelativeLow &&
    !nearRelativeHigh &&
    bodySize(lastCandle) / rangeSize(lastCandle) >= 0.6
  ) {
    return "BREAKOUT";
  }

  return "NONE";
}

// ─── Signal + strength ──────────────────────────────────

function computePdf2Signal(
  setupType: Pdf2SetupType,
  bigGreenValidity: Pdf2BigGreenValidity,
  isExhaustionRisk: boolean
): Pdf2Signal {
  if (setupType === "REVERSAL" || setupType === "TWO_CANDLE_REVERSAL") return "BUY";
  if (setupType === "PULLBACK") return "BUY";
  if (setupType === "EXHAUSTION") return "CAUTION";
  if (bigGreenValidity === "INVALID") return "CAUTION";
  if (setupType === "BREAKOUT") return "NEUTRAL";
  return "NONE";
}

function computeStrength(
  setupType: Pdf2SetupType,
  isBigGreenCandle: boolean,
  bigGreenValidity: Pdf2BigGreenValidity,
  twoCandleReversal: boolean,
  isExhaustionRisk: boolean,
  priceMovePercent: number,
  bodyDominanceRatio: number
): number {
  let score = 0;

  if (setupType === "TWO_CANDLE_REVERSAL") score += 40;
  else if (setupType === "REVERSAL") score += 35;
  else if (setupType === "PULLBACK") score += 25;
  else if (setupType === "BREAKOUT") score += 15;

  if (isBigGreenCandle) score += 20;
  if (bigGreenValidity === "VALID") score += 15;
  if (twoCandleReversal) score += 10;
  if (priceMovePercent >= 15) score += 5;
  if (bodyDominanceRatio >= 0.9) score += 5;

  // Penalties
  if (isExhaustionRisk) score -= 20;
  if (bigGreenValidity === "INVALID") score -= 15;

  return Math.max(0, Math.min(100, score));
}

// ─── Main export ────────────────────────────────────────

export function buildPdf2Setup(params: {
  candles: ChartCandlePoint[];
  bollinger: ChartBollingerPoint[];
}): Pdf2Setup {
  const { candles, bollinger } = params;

  const empty: Pdf2Setup = {
    isBigGreenCandle: false,
    priceMovePercent: 0,
    bodyDominanceRatio: 0,
    wickCompressionRatio: 0,
    nearRelativeLow: false,
    nearRelativeHigh: false,
    rangePosition: 0.5,
    bigGreenValidity: "NONE",
    twoCandleReversal: false,
    setupType: "NONE",
    nowNearMiddleBand: false,
    recentlyWasNearUpperBand: false,
    recentPullbackToMiddle: false,
    bullishResumeTrigger: false,
    isExhaustionRisk: false,
    pdf2Signal: "NONE",
    strength: 0,
  };

  if (!candles || candles.length < 5) return empty;

  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles.length >= 2 ? candles[candles.length - 2] : null;

  // Section A: PDF hard rules
  const bigGreen = detectBigGreenCandle(lastCandle);
  const location = computeRangePosition(candles, 50);
  const bigGreenValidity = classifyBigGreenValidity(
    bigGreen.isBigGreenCandle,
    location.nearRelativeLow,
    location.nearRelativeHigh
  );
  const twoCandleReversal = detectTwoCandleReversal(candles, location.nearRelativeLow);

  // Section B: Extended rules
  const bollProximity = detectBollingerProximity(candles, bollinger);
  const isExhaustionRisk = detectExhaustion(candles, location.nearRelativeHigh);

  // Classify
  const setupType = classifySetupType({
    isBigGreenCandle: bigGreen.isBigGreenCandle,
    bigGreenValidity,
    twoCandleReversal,
    nearRelativeLow: location.nearRelativeLow,
    nearRelativeHigh: location.nearRelativeHigh,
    recentPullbackToMiddle: bollProximity.recentPullbackToMiddle,
    bullishResumeTrigger: bollProximity.bullishResumeTrigger,
    isExhaustionRisk,
    lastCandle,
    prevCandle,
  });

  const pdf2Signal = computePdf2Signal(setupType, bigGreenValidity, isExhaustionRisk);

  const strength = computeStrength(
    setupType,
    bigGreen.isBigGreenCandle,
    bigGreenValidity,
    twoCandleReversal,
    isExhaustionRisk,
    bigGreen.priceMovePercent,
    bigGreen.bodyDominanceRatio
  );

  return {
    ...bigGreen,
    ...location,
    bigGreenValidity,
    twoCandleReversal,
    setupType,
    ...bollProximity,
    isExhaustionRisk,
    pdf2Signal,
    strength,
  };
}
import {
  BollingerBandDirection,
  BollingerPosition,
  CandleIntelligence,
  ChartBollingerPoint,
  ChartCandlePoint,
  ChartLinePoint,
  TradeSignal,
  VolumeConfirmation,
} from "../types/chart.types";

function getUpperShadow(candle: ChartCandlePoint): number {
  return candle.high - Math.max(candle.open, candle.close);
}

function getLowerShadow(candle: ChartCandlePoint): number {
  return Math.min(candle.open, candle.close) - candle.low;
}

function getBodySize(candle: ChartCandlePoint): number {
  return Math.abs(candle.close - candle.open);
}

function getRangeSize(candle: ChartCandlePoint): number {
  return candle.high - candle.low;
}

function getNearestBollingerPoint(
  candleTime: string,
  bollinger20: ChartBollingerPoint[]
): ChartBollingerPoint | null {
  const exact = bollinger20.find((point) => point.time === candleTime);
  return exact || bollinger20[bollinger20.length - 1] || null;
}

function getNearestEmaPoint(
  candleTime: string,
  ema44: ChartLinePoint[]
): ChartLinePoint | null {
  const exact = ema44.find((point) => point.time === candleTime);
  return exact || ema44[ema44.length - 1] || null;
}

function getRecentWindow(
  candles: ChartCandlePoint[],
  size: number
): ChartCandlePoint[] {
  return candles.slice(Math.max(0, candles.length - size));
}

function isNearRecentLow(
  candle: ChartCandlePoint,
  candles: ChartCandlePoint[],
  lookback = 20
): boolean {
  const window = getRecentWindow(candles, lookback);

  if (window.length === 0) {
    return false;
  }

  const lowestLow = Math.min(...window.map((item) => item.low));
  const highestHigh = Math.max(...window.map((item) => item.high));
  const totalRange = Math.max(highestHigh - lowestLow, 0.0001);
  const closePositionFromLow = candle.close - lowestLow;

  return closePositionFromLow <= totalRange * 0.25;
}

function isNearRecentHigh(
  candle: ChartCandlePoint,
  candles: ChartCandlePoint[],
  lookback = 60
): boolean {


  const window = getRecentWindow(candles, lookback);

  if (window.length === 0) {
    return false;
  }

  const lowestLow = Math.min(...window.map((item) => item.low));
  const highestHigh = Math.max(...window.map((item) => item.high));
  const totalRange = Math.max(highestHigh - lowestLow, 0.0001);
  const distanceFromHigh = highestHigh - candle.close;

  return distanceFromHigh <= totalRange * 0.15;
  
}

function resolveRecentPriceLocation(
  candle: ChartCandlePoint,
  candles: ChartCandlePoint[],
  lowLookback = 20,
  highLookback = 60
): CandleIntelligence["recentPriceLocation"] {
  const nearLow = isNearRecentLow(candle, candles, lowLookback);
  const nearHigh = isNearRecentHigh(candle, candles, highLookback);

  if (nearLow && !nearHigh) {
    return "RECENT_LOW";
  }

  if (nearHigh && !nearLow) {
    return "RECENT_HIGH";
  }

  if (nearLow && nearHigh) {
    return "MID_RANGE";
  }

  return "MID_RANGE";
}

function isBullishConfirmationCandle(
  confirmationCandle: ChartCandlePoint,
  setupCandle: ChartCandlePoint
): boolean {
  const bullishBody = confirmationCandle.close > confirmationCandle.open;
  const closesAboveSetupClose = confirmationCandle.close > setupCandle.close;
  const closesIntoUpperHalf =
    confirmationCandle.close >= setupCandle.low + getRangeSize(setupCandle) * 0.55;

  return bullishBody && (closesAboveSetupClose || closesIntoUpperHalf);
}

function isBearishConfirmationCandle(
  confirmationCandle: ChartCandlePoint,
  setupCandle: ChartCandlePoint
): boolean {
  const bearishBody = confirmationCandle.close < confirmationCandle.open;
  const closesBelowSetupClose = confirmationCandle.close < setupCandle.close;
  const closesIntoLowerHalf =
    confirmationCandle.close <= setupCandle.low + getRangeSize(setupCandle) * 0.45;

  return bearishBody && (closesBelowSetupClose || closesIntoLowerHalf);
}

function resolvePdf1Signal(params: {
  candles: ChartCandlePoint[];
}): CandleIntelligence["pdf1Signal"] {
  const { candles } = params;

  if (candles.length === 0) {
    return "NONE";
  }

  const latestCandle = candles[candles.length - 1];
  const latestPattern = resolveSingleCandlePattern(latestCandle);
  const latestRecentPriceLocation = resolveRecentPriceLocation(
    latestCandle,
    candles,
    20,
    60
  );

  if (
    latestPattern === "LONG_LOWER_SHADOW" &&
    latestRecentPriceLocation === "RECENT_LOW"
  ) {
    return "BULLISH_PENDING_CONFIRMATION";
  }

  if (
    latestPattern === "LONG_UPPER_SHADOW" &&
    latestRecentPriceLocation === "RECENT_HIGH"
  ) {
    return "BEARISH_PENDING_CONFIRMATION";
  }

  if (candles.length < 2) {
    return "NONE";
  }

  const previousCandle = candles[candles.length - 2];
  const candlesBeforeLatest = candles.slice(0, candles.length - 1);
  const previousPattern = resolveSingleCandlePattern(previousCandle);
  const previousRecentPriceLocation = resolveRecentPriceLocation(
    previousCandle,
    candlesBeforeLatest,
    20,
    60
  );

  const bullishConfirmed =
    previousPattern === "LONG_LOWER_SHADOW" &&
    previousRecentPriceLocation === "RECENT_LOW" &&
    isBullishConfirmationCandle(latestCandle, previousCandle);

  if (bullishConfirmed) {
    return "BULLISH_CONFIRMED";
  }

  const bearishConfirmed =
    previousPattern === "LONG_UPPER_SHADOW" &&
    previousRecentPriceLocation === "RECENT_HIGH" &&
    isBearishConfirmationCandle(latestCandle, previousCandle);

  if (bearishConfirmed) {
    return "BEARISH_CONFIRMED";
  }

  return "NONE";
}

function getBollingerPosition(
  candle: ChartCandlePoint,
  bollingerPoint: ChartBollingerPoint | null
): BollingerPosition {
  if (!bollingerPoint) {
    return "UNKNOWN";
  }

  const bandWidth = Math.max(
    bollingerPoint.upperBand - bollingerPoint.lowerBand,
    0.0001
  );

  const normalized = (candle.close - bollingerPoint.lowerBand) / bandWidth;

  if (normalized <= 0.2) {
    return "LOW";
  }

  if (normalized >= 0.8) {
    return "HIGH";
  }

  return "MID";
}

function isNearLowerBollinger(
  candle: ChartCandlePoint,
  bollingerPoint: ChartBollingerPoint | null
): boolean {
  if (!bollingerPoint) {
    return false;
  }

  const bandWidth = Math.max(
    bollingerPoint.upperBand - bollingerPoint.lowerBand,
    0.0001
  );

  const lowerDistance = Math.abs(candle.close - bollingerPoint.lowerBand);
  return lowerDistance <= bandWidth * 0.12;
}

function isNearUpperBollinger(
  candle: ChartCandlePoint,
  bollingerPoint: ChartBollingerPoint | null
): boolean {
  if (!bollingerPoint) {
    return false;
  }

  const bandWidth = Math.max(
    bollingerPoint.upperBand - bollingerPoint.lowerBand,
    0.0001
  );

  const upperDistance = Math.abs(candle.close - bollingerPoint.upperBand);
  return upperDistance <= bandWidth * 0.12;
}

function getBollingerBandDirection(
  bollinger20: ChartBollingerPoint[],
  lookback = 5
): BollingerBandDirection {
  if (bollinger20.length < lookback + 1) {
    return "FLAT";
  }

  const recent = bollinger20.slice(bollinger20.length - (lookback + 1));
  let risingCount = 0;
  let fallingCount = 0;

  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i].middleBand > recent[i - 1].middleBand) {
      risingCount += 1;
    } else if (recent[i].middleBand < recent[i - 1].middleBand) {
      fallingCount += 1;
    }
  }

  const threshold = Math.ceil(lookback * 0.6);

  if (risingCount >= threshold) {
    return "RISING";
  }

  if (fallingCount >= threshold) {
    return "FALLING";
  }

  return "FLAT";
}

function isNearMiddleBollinger(
  candle: ChartCandlePoint,
  bollingerPoint: ChartBollingerPoint | null
): boolean {
  if (!bollingerPoint) {
    return false;
  }

  const bandWidth = Math.max(
    bollingerPoint.upperBand - bollingerPoint.lowerBand,
    0.0001
  );

  const middleDistance = Math.abs(candle.close - bollingerPoint.middleBand);
  return middleDistance <= bandWidth * 0.10;
}

function resolveMiddleBandTouchSignal(
  candle: ChartCandlePoint,
  bollingerPoint: ChartBollingerPoint | null,
  bandDirection: BollingerBandDirection
): CandleIntelligence["middleBandTouchSignal"] {
  if (!bollingerPoint || !isNearMiddleBollinger(candle, bollingerPoint)) {
    return "NONE";
  }

  if (bandDirection === "RISING") {
    return "BUY_RETEST";
  }

  if (bandDirection === "FALLING") {
    return "SELL_RETEST";
  }

  return "NONE";
}

function isLargeBullishExpansion(candle: ChartCandlePoint): boolean {
  const body = getBodySize(candle);
  const range = Math.max(getRangeSize(candle), 0.0001);
  const upperShadow = getUpperShadow(candle);
  const lowerShadow = getLowerShadow(candle);
  const bodyRatio = body / range;
  const dailyGainPercent =
    candle.open === 0 ? 0 : ((candle.close - candle.open) / candle.open) * 100;

  return (
    candle.close > candle.open &&
    bodyRatio >= 0.7 &&
    upperShadow <= range * 0.12 &&
    lowerShadow <= range * 0.12 &&
    dailyGainPercent > 10
  );
}

function resolveVolumeConfirmation(
  latestCandle: ChartCandlePoint,
  candles: ChartCandlePoint[],
  lookback = 20
): VolumeConfirmation {
  const previousWindow = candles.slice(Math.max(0, candles.length - lookback - 1), candles.length - 1);

  if (previousWindow.length === 0) {
    return "UNKNOWN";
  }

  const averageVolume =
    previousWindow.reduce((sum, candle) => sum + candle.volume, 0) /
    previousWindow.length;

  if (averageVolume <= 0) {
    return "UNKNOWN";
  }

  const ratio = latestCandle.volume / averageVolume;

  if (ratio >= 1.5) {
    return "HIGH";
  }

  if (ratio >= 1.0) {
    return "NORMAL";
  }

  return "LOW";
}

function resolveContext(
  candle: ChartCandlePoint,
  emaPoint: ChartLinePoint | null,
  bollingerPoint: ChartBollingerPoint | null,
  bandDirection: BollingerBandDirection
): CandleIntelligence["context"] {
  if (isNearLowerBollinger(candle, bollingerPoint)) {
    return "NEAR_LOWER_BOLLINGER";
  }

  if (isNearUpperBollinger(candle, bollingerPoint)) {
    return "NEAR_UPPER_BOLLINGER";
  }

  if (isNearMiddleBollinger(candle, bollingerPoint)) {
    if (bandDirection === "RISING") {
      return "NEAR_MIDDLE_BOLLINGER_RISING";
    }
    if (bandDirection === "FALLING") {
      return "NEAR_MIDDLE_BOLLINGER_FALLING";
    }
  }

  if (emaPoint) {
    const emaDistance = candle.close - emaPoint.value;
    const closeThreshold = Math.max(Math.abs(emaPoint.value) * 0.0025, 0.5);

    if (Math.abs(emaDistance) <= closeThreshold) {
      return "AROUND_EMA44";
    }

    return emaDistance > 0 ? "ABOVE_EMA44" : "BELOW_EMA44";
  }

  return "NONE";
}

function resolveSingleCandlePattern(
  candle: ChartCandlePoint
): CandleIntelligence["pattern"] {
  const upperShadow = getUpperShadow(candle);
  const lowerShadow = getLowerShadow(candle);
  const body = getBodySize(candle);
  const range = getRangeSize(candle);

  if (range <= 0) {
    return "NEUTRAL";
  }

  const isDoji =
    body <= range * 0.10 &&
    upperShadow >= Math.max(body * 1.5, range * 0.20) &&
    lowerShadow >= Math.max(body * 1.5, range * 0.20);

  if (isDoji) {
    return "DOJI";
  }

  const isLongLowerShadow =
    lowerShadow >= Math.max(body * 2.5, range * 0.40) &&
    lowerShadow > upperShadow * 1.2;

  if (isLongLowerShadow) {
    return "LONG_LOWER_SHADOW";
  }

  const isLongUpperShadow =
    upperShadow >= Math.max(body * 2.5, range * 0.40) &&
    upperShadow > lowerShadow * 1.2;

  if (isLongUpperShadow) {
    return "LONG_UPPER_SHADOW";
  }

  if (candle.close > candle.open && body >= range * 0.6) {
    return "STRONG_BULLISH_BODY";
  }

  if (candle.close < candle.open && body >= range * 0.6) {
    return "STRONG_BEARISH_BODY";
  }

  if (body <= range * 0.25) {
    return "INSIDE_BODY";
  }

  return "NEUTRAL";
}

function resolvePattern(params: {
  latestCandle: ChartCandlePoint;
  previousCandle: ChartCandlePoint | null;
  candles: ChartCandlePoint[];
  latestBollingerPoint: ChartBollingerPoint | null;
}): CandleIntelligence["pattern"] {
  const { latestCandle, previousCandle, candles, latestBollingerPoint } = params;

  const latestSinglePattern = resolveSingleCandlePattern(latestCandle);
  const atRecentLow = isNearRecentLow(latestCandle, candles, 20);
  const nearLowerBand = isNearLowerBollinger(latestCandle, latestBollingerPoint);
  const bullishExpansion = isLargeBullishExpansion(latestCandle);

  if (bullishExpansion && (nearLowerBand || atRecentLow)) {
    if (previousCandle) {
      const previousPattern = resolveSingleCandlePattern(previousCandle);
      const previousNearLow = isNearRecentLow(previousCandle, candles, 20);

      const isTwoDayBullishEntry =
        previousPattern === "LONG_LOWER_SHADOW" &&
        previousNearLow &&
        latestCandle.close > previousCandle.close &&
        latestCandle.close > previousCandle.high * 0.98;

      if (isTwoDayBullishEntry) {
        return "TWO_DAY_BULLISH_ENTRY";
      }
    }

    return "LARGE_BULLISH_BODY_AT_LOW";
  }

  return latestSinglePattern;
}

function resolveBias(
  pattern: CandleIntelligence["pattern"],
  context: CandleIntelligence["context"]
): CandleIntelligence["bias"] {
  if (
    pattern === "TWO_DAY_BULLISH_ENTRY" ||
    pattern === "LARGE_BULLISH_BODY_AT_LOW"
  ) {
    return "BULLISH";
  }

  if (
    pattern === "LONG_LOWER_SHADOW" &&
    (context === "NEAR_LOWER_BOLLINGER" ||
      context === "NEAR_MIDDLE_BOLLINGER_RISING" ||
      context === "ABOVE_EMA44" ||
      context === "AROUND_EMA44")
  ) {
    return "BULLISH";
  }

  if (context === "NEAR_MIDDLE_BOLLINGER_RISING" &&
    (pattern === "STRONG_BULLISH_BODY" || pattern === "DOJI" || pattern === "INSIDE_BODY")
  ) {
    return "BULLISH";
  }

  if (
    pattern === "LONG_UPPER_SHADOW" &&
    (context === "NEAR_UPPER_BOLLINGER" ||
      context === "NEAR_MIDDLE_BOLLINGER_FALLING" ||
      context === "BELOW_EMA44" ||
      context === "AROUND_EMA44")
  ) {
    return "BEARISH";
  }

  if (context === "NEAR_MIDDLE_BOLLINGER_FALLING" &&
    (pattern === "STRONG_BEARISH_BODY" || pattern === "DOJI" || pattern === "INSIDE_BODY")
  ) {
    return "BEARISH";
  }

  if (pattern === "STRONG_BULLISH_BODY") {
    return "BULLISH";
  }

  if (pattern === "STRONG_BEARISH_BODY") {
    return "BEARISH";
  }

  return "NEUTRAL";
}

function resolveConfirmationStatus(params: {
  bias: CandleIntelligence["bias"];
  pattern: CandleIntelligence["pattern"];
  candles: ChartCandlePoint[];
}): CandleIntelligence["confirmationStatus"] {
  const { bias, pattern, candles } = params;

  if (candles.length === 0) {
    return "NONE";
  }

  const latest = candles[candles.length - 1];
  const previous = candles.length >= 2 ? candles[candles.length - 2] : null;

  if (pattern === "TWO_DAY_BULLISH_ENTRY") {
    return "CONFIRMED";
  }

  if (
    pattern === "LONG_LOWER_SHADOW" ||
    pattern === "LONG_UPPER_SHADOW" ||
    pattern === "DOJI"
  ) {
    return "PENDING";
  }

  if (!previous || bias === "NEUTRAL") {
    return "NONE";
  }

  const candlesBeforeLatest = candles.slice(0, candles.length - 1);
  const previousPattern = resolveSingleCandlePattern(previous);
  const previousRecentPriceLocation = resolveRecentPriceLocation(
    previous,
    candlesBeforeLatest,
    20,
    60
  );

  const bullishConfirmed =
    previousPattern === "LONG_LOWER_SHADOW" &&
    previousRecentPriceLocation === "RECENT_LOW" &&
    isBullishConfirmationCandle(latest, previous);

  if (bullishConfirmed) {
    return "CONFIRMED";
  }

  const bearishConfirmed =
    previousPattern === "LONG_UPPER_SHADOW" &&
    previousRecentPriceLocation === "RECENT_HIGH" &&
    isBearishConfirmationCandle(latest, previous);

  if (bearishConfirmed) {
    return "CONFIRMED";
  }

  if (pattern === "LARGE_BULLISH_BODY_AT_LOW") {
    return latest.close > previous.close ? "CONFIRMED" : "PENDING";
  }

  if (bias === "BULLISH") {
    return latest.close > previous.close ? "CONFIRMED" : "PENDING";
  }

  if (bias === "BEARISH") {
    return latest.close < previous.close ? "CONFIRMED" : "PENDING";
  }

  return "NONE";
}

function buildTitle(
  pattern: CandleIntelligence["pattern"],
  bias: CandleIntelligence["bias"],
  nearHighCaution: boolean
): string {
  if (
    nearHighCaution &&
    (pattern === "LARGE_BULLISH_BODY_AT_LOW" ||
      pattern === "STRONG_BULLISH_BODY" ||
      pattern === "TWO_DAY_BULLISH_ENTRY")
  ) {
    return "Bullish Setup With Near-High Caution";
  }

  if (pattern === "TWO_DAY_BULLISH_ENTRY") {
    return "Two-Day Bullish Entry";
  }

  if (pattern === "LARGE_BULLISH_BODY_AT_LOW") {
    return "Bullish Expansion Near Lower End";
  }

  if (pattern === "LONG_LOWER_SHADOW" && bias === "BULLISH") {
    return "Bullish Rejection Detected";
  }

  if (pattern === "LONG_UPPER_SHADOW" && bias === "BEARISH") {
    return "Bearish Rejection Detected";
  }

  if (pattern === "STRONG_BULLISH_BODY") {
    return "Bullish Momentum Candle";
  }

  if (pattern === "STRONG_BEARISH_BODY") {
    return "Bearish Momentum Candle";
  }

  if (pattern === "DOJI") {
    return "Indecision Candle";
  }

  return "Neutral Candle Structure";
}

function buildMessage(
  pattern: CandleIntelligence["pattern"],
  bias: CandleIntelligence["bias"],
  context: CandleIntelligence["context"],
  confirmationStatus: CandleIntelligence["confirmationStatus"],
  bollingerPosition: BollingerPosition,
  nearHighCaution: boolean,
  volumeConfirmation: VolumeConfirmation,
  recentPriceLocation: CandleIntelligence["recentPriceLocation"],
  pdf1Signal: CandleIntelligence["pdf1Signal"]
): string {
  const contextText =
    context === "NEAR_LOWER_BOLLINGER"
      ? "near the lower Bollinger Band"
      : context === "NEAR_UPPER_BOLLINGER"
        ? "near the upper Bollinger Band"
        : context === "ABOVE_EMA44"
          ? "while price is above EMA 44"
          : context === "BELOW_EMA44"
            ? "while price is below EMA 44"
            : context === "AROUND_EMA44"
              ? "around EMA 44"
              : "without strong location context";

  const positionText =
    bollingerPosition === "LOW"
      ? " Price is positioned near the lower Bollinger zone."
      : bollingerPosition === "HIGH"
        ? " Price is positioned near the upper Bollinger zone."
        : "";

  const volumeText =
    volumeConfirmation === "HIGH"
      ? " Volume confirmation is strong."
      : volumeConfirmation === "NORMAL"
        ? " Volume is supportive."
        : volumeConfirmation === "LOW"
          ? " Volume confirmation is weak."
          : "";

  const cautionText = nearHighCaution
    ? " Caution: price is also near a recent high zone, so bullish continuation is less clean."
    : "";

  if (pdf1Signal === "BULLISH_PENDING_CONFIRMATION") {
    return `A long lower shadow has formed near a recent low. This matches the first half of the PDF 1 bullish rule, but the next candle confirmation is still pending.${positionText}${volumeText}${cautionText}`;
  }

  if (pdf1Signal === "BULLISH_CONFIRMED") {
    return `A lower-shadow rejection formed near a recent low and the latest candle has confirmed the move. This matches the PDF 1 bullish setup.${positionText}${volumeText}${cautionText}`;
  }

  if (pdf1Signal === "BEARISH_PENDING_CONFIRMATION") {
    return `A long upper shadow has formed near a recent high. This matches the first half of the PDF 1 bearish rule, but the next candle confirmation is still pending.${positionText}${volumeText}`;
  }

  if (pdf1Signal === "BEARISH_CONFIRMED") {
    return `An upper-shadow rejection formed near a recent high and the latest candle has confirmed weakness. This matches the PDF 1 bearish setup.${positionText}${volumeText}`;
  }

  if (pattern === "DOJI") {
    return `A doji suggests indecision ${contextText}. PDF 1 does not treat a doji alone as a confirmed entry. Wait for clearer follow-through.${positionText}${volumeText}`;
  }

  if (
    pattern === "LONG_LOWER_SHADOW" &&
    recentPriceLocation !== "RECENT_LOW"
  ) {
    return `A long lower shadow is present, but it is not forming near a recent low. So it does not qualify as a valid PDF 1 bullish setup yet.${positionText}${volumeText}${cautionText}`;
  }

  if (
    pattern === "LONG_UPPER_SHADOW" &&
    recentPriceLocation !== "RECENT_HIGH"
  ) {
    return `A long upper shadow is present, but it is not forming near a recent high. So it does not qualify as a valid PDF 1 bearish setup yet.${positionText}${volumeText}`;
  }

  const confirmationText =
    confirmationStatus === "CONFIRMED"
      ? " Confirmation is present from the latest candles."
      : confirmationStatus === "PENDING"
        ? " Confirmation is still pending from the latest candles."
        : "";

  if (pattern === "TWO_DAY_BULLISH_ENTRY") {
    return `A lower-shadow rejection followed by a strong bullish expansion candle suggests buyers entered aggressively ${contextText}.${positionText}${volumeText}${confirmationText}${cautionText}`;
  }

  if (pattern === "LARGE_BULLISH_BODY_AT_LOW") {
    return `A large bullish body with controlled shadows suggests bullish capital is entering ${contextText}.${positionText}${volumeText}${confirmationText}${cautionText}`;
  }

  if (pattern === "LONG_LOWER_SHADOW") {
    return `A long lower shadow suggests buyers absorbed selling pressure ${contextText}.${positionText}${volumeText}${confirmationText}${cautionText}`;
  }

  if (pattern === "LONG_UPPER_SHADOW") {
    return `A long upper shadow suggests sellers rejected higher prices ${contextText}.${positionText}${volumeText}${confirmationText}`;
  }

  if (pattern === "STRONG_BULLISH_BODY") {
    return `A strong bullish body suggests momentum continuation ${contextText}.${positionText}${volumeText}${confirmationText}${cautionText}`;
  }

  if (pattern === "STRONG_BEARISH_BODY") {
    return `A strong bearish body suggests downside momentum ${contextText}.${positionText}${volumeText}${confirmationText}`;
  }

  if (bias === "BULLISH") {
    return `Bullish candle behavior detected ${contextText}.${positionText}${volumeText}${confirmationText}${cautionText}`;
  }

  if (bias === "BEARISH") {
    return `Bearish candle behavior detected ${contextText}.${positionText}${volumeText}${confirmationText}`;
  }

  return `The latest candle is neutral ${contextText}.${positionText}${volumeText} No strong PDF 1 candle setup is active yet.`;
}

function resolveTradeSignal(params: {
  pattern: CandleIntelligence["pattern"];
  bias: CandleIntelligence["bias"];
  context: CandleIntelligence["context"];
  confirmationStatus: CandleIntelligence["confirmationStatus"];
  bollingerPosition: BollingerPosition;
  nearHighCaution: boolean;
  volumeConfirmation: VolumeConfirmation;
  middleBandTouchSignal: CandleIntelligence["middleBandTouchSignal"];
}): { tradeSignal: TradeSignal; buyZone: boolean } {
  const {
    pattern,
    bias,
    context,
    confirmationStatus,
    bollingerPosition,
    nearHighCaution,
    volumeConfirmation,
    middleBandTouchSignal,
  } = params;

  const lowerBandBuySetup =
    (pattern === "TWO_DAY_BULLISH_ENTRY" ||
      pattern === "LARGE_BULLISH_BODY_AT_LOW" ||
      pattern === "LONG_LOWER_SHADOW") &&
    bias === "BULLISH" &&
    (context === "NEAR_LOWER_BOLLINGER" || bollingerPosition === "LOW");

  // Chapter 5 rule: middle band rising + price retesting = BUY entry
  const middleBandRisingRetest =
    middleBandTouchSignal === "BUY_RETEST" &&
    bias === "BULLISH" &&
    !nearHighCaution;

  // Chapter 5 rule: middle band falling + price rallying to it = SELL/avoid
  const middleBandFallingRetest =
    middleBandTouchSignal === "SELL_RETEST" &&
    (bias === "BEARISH" || bias === "NEUTRAL");

  if (
    lowerBandBuySetup &&
    confirmationStatus === "CONFIRMED" &&
    !nearHighCaution &&
    volumeConfirmation !== "LOW"
  ) {
    return { tradeSignal: "BUY", buyZone: true };
  }

  if (
    middleBandRisingRetest &&
    confirmationStatus === "CONFIRMED" &&
    volumeConfirmation !== "LOW"
  ) {
    return { tradeSignal: "BUY", buyZone: true };
  }

  if (middleBandRisingRetest) {
    return { tradeSignal: "WAIT", buyZone: true };
  }

  if (
    bias === "BEARISH" &&
    (context === "NEAR_UPPER_BOLLINGER" || bollingerPosition === "HIGH") &&
    confirmationStatus !== "NONE"
  ) {
    return { tradeSignal: "SELL", buyZone: false };
  }

  if (middleBandFallingRetest && confirmationStatus !== "NONE") {
    return { tradeSignal: "SELL", buyZone: false };
  }

  if (lowerBandBuySetup) {
    return { tradeSignal: "WAIT", buyZone: true };
  }

  return { tradeSignal: "WAIT", buyZone: false };
}

function calculateStrengthScore(params: {
  candle: ChartCandlePoint;
  pattern: CandleIntelligence["pattern"];
  bias: CandleIntelligence["bias"];
  context: CandleIntelligence["context"];
  confirmationStatus: CandleIntelligence["confirmationStatus"];
  bollingerPosition: BollingerPosition;
  nearHighCaution: boolean;
  volumeConfirmation: VolumeConfirmation;
  middleBandTouchSignal: CandleIntelligence["middleBandTouchSignal"];
}): { strengthScore: number; reasons: string[] } {
  const {
    candle,
    pattern,
    bias,
    context,
    confirmationStatus,
    bollingerPosition,
    nearHighCaution,
    volumeConfirmation,
    middleBandTouchSignal,
  } = params;

  const upperShadow = getUpperShadow(candle);
  const lowerShadow = getLowerShadow(candle);
  const body = getBodySize(candle);
  const range = Math.max(getRangeSize(candle), 0.0001);
  const bodyRatio = body / range;
  const gainPercent =
    candle.open === 0 ? 0 : ((candle.close - candle.open) / candle.open) * 100;

  let score = 0;
  const reasons: string[] = [];

  if (pattern === "TWO_DAY_BULLISH_ENTRY") {
    score += 42;
    reasons.push("Two-day bullish reversal sequence detected.");
  }

  if (pattern === "LARGE_BULLISH_BODY_AT_LOW") {
    score += 34;
    reasons.push("Large bullish expansion candle formed near the lower end.");
  }

  if (pattern === "LONG_LOWER_SHADOW") {
    const ratio = lowerShadow / Math.max(body, 0.0001);
    if (ratio >= 3) {
      score += 28;
      reasons.push("Very strong lower-shadow rejection.");
    } else if (ratio >= 2) {
      score += 20;
      reasons.push("Clear lower-shadow rejection.");
    } else {
      score += 12;
      reasons.push("Lower-shadow support detected.");
    }
  }

  if (pattern === "LONG_UPPER_SHADOW") {
    const ratio = upperShadow / Math.max(body, 0.0001);
    if (ratio >= 3) {
      score += 28;
      reasons.push("Very strong upper-shadow rejection.");
    } else if (ratio >= 2) {
      score += 20;
      reasons.push("Clear upper-shadow rejection.");
    } else {
      score += 12;
      reasons.push("Upper-shadow selling pressure detected.");
    }
  }

  if (pattern === "STRONG_BULLISH_BODY" || pattern === "STRONG_BEARISH_BODY") {
    if (bodyRatio >= 0.75) {
      score += 30;
      reasons.push("Large real body shows strong momentum.");
    } else if (bodyRatio >= 0.6) {
      score += 22;
      reasons.push("Body strength supports momentum.");
    }
  }

    if (
    pattern === "LARGE_BULLISH_BODY_AT_LOW" ||
    pattern === "TWO_DAY_BULLISH_ENTRY"
  ) {
    if (gainPercent > 10) {
      score += 12;
      reasons.push("Single-session bullish expansion exceeds 10%, matching the large green candle rule.");
    }
  }
  if (pattern === "DOJI") {
    score += 8;
    reasons.push("Doji reflects indecision rather than conviction.");
  }

  if (context === "NEAR_LOWER_BOLLINGER" || context === "NEAR_UPPER_BOLLINGER") {
    score += 20;
    reasons.push("Signal is supported by Bollinger location context.");
  } else if (context === "NEAR_MIDDLE_BOLLINGER_RISING") {
    score += 25;
    reasons.push("Price is retesting the rising middle band — a high-quality buy entry per Chapter 5.");
  } else if (context === "NEAR_MIDDLE_BOLLINGER_FALLING") {
    score += 18;
    reasons.push("Price is rallying toward a falling middle band — resistance is strong here.");
  } else if (
    context === "ABOVE_EMA44" ||
    context === "BELOW_EMA44" ||
    context === "AROUND_EMA44"
  ) {
    score += 12;
    reasons.push("Signal aligns with EMA 44 location context.");
  }

  if (middleBandTouchSignal === "BUY_RETEST") {
    score += 15;
    reasons.push("Middle band retest on a rising band — buy opportunity identified (Chapter 5).");
  } else if (middleBandTouchSignal === "SELL_RETEST") {
    score += 12;
    reasons.push("Middle band retest on a falling band — avoid buying here (Chapter 5).");
  }

  if (bollingerPosition === "LOW") {
    score += 10;
    reasons.push("Price is sitting in the lower Bollinger zone.");
  } else if (bollingerPosition === "HIGH") {
    score += 10;
    reasons.push("Price is sitting in the upper Bollinger zone.");
  }

  if (volumeConfirmation === "HIGH") {
    score += 14;
    reasons.push("Volume confirmation is strong.");
  } else if (volumeConfirmation === "NORMAL") {
    score += 6;
    reasons.push("Volume is supportive.");
  } else if (volumeConfirmation === "LOW") {
    score -= 10;
    reasons.push("Volume confirmation is weak.");
  }

  if (confirmationStatus === "CONFIRMED") {
    score += 22;
    reasons.push("Recent candles confirm the signal.");
  } else if (confirmationStatus === "PENDING") {
    score += 8;
    reasons.push("Signal exists, but confirmation is still pending.");
  }

  if (nearHighCaution) {
    score -= 18;
    reasons.push("Near-high caution is active.");
  }

  if (bias === "NEUTRAL") {
    score = Math.min(score, 25);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (reasons.length === 0) {
    reasons.push("No strong candle-intelligence edge detected yet.");
  }

  return {
    strengthScore: score,
    reasons,
  };
}

export function buildCandleIntelligence(params: {
  candles: ChartCandlePoint[];
  ema44: ChartLinePoint[];
  bollinger20: ChartBollingerPoint[];
}): CandleIntelligence {
  const { candles, ema44, bollinger20 } = params;

  const latestCandle = candles[candles.length - 1];

   if (!latestCandle) {
    return {
      pattern: "NEUTRAL",
      bias: "NEUTRAL",
      context: "NONE",
      confirmationStatus: "NONE",
      title: "No Candle Data",
      message: "Not enough candle data is available to analyze.",
      strengthScore: 0,
      reasons: ["No candle data is available."],

      bodySize: 0,
      rangeSize: 0,
      upperShadowSize: 0,
      lowerShadowSize: 0,
      recentPriceLocation: "UNKNOWN",
      pdf1Signal: "NONE",

      bollingerPosition: "UNKNOWN",
      bollingerBandDirection: "FLAT",
      middleBandTouchSignal: "NONE",
      tradeSignal: "WAIT",
      buyZone: false,
      nearHighCaution: false,
      volumeConfirmation: "UNKNOWN",
    };
  }

  const previousCandle = candles.length >= 2 ? candles[candles.length - 2] : null;
  const latestEmaPoint = getNearestEmaPoint(latestCandle.time, ema44);
  const latestBollingerPoint = getNearestBollingerPoint(
    latestCandle.time,
    bollinger20
  );

    const bollingerBandDirection = getBollingerBandDirection(bollinger20, 5);
  const bodySize = getBodySize(latestCandle);
  const rangeSize = getRangeSize(latestCandle);
  const upperShadowSize = getUpperShadow(latestCandle);
  const lowerShadowSize = getLowerShadow(latestCandle);

  const middleBandTouchSignal = resolveMiddleBandTouchSignal(
    latestCandle,
    latestBollingerPoint,
    bollingerBandDirection
  );

  const pattern = resolvePattern({
    latestCandle,
    previousCandle,
    candles,
    latestBollingerPoint,
  });

  const context = resolveContext(latestCandle, latestEmaPoint, latestBollingerPoint, bollingerBandDirection);
  const bias = resolveBias(pattern, context);
  const confirmationStatus = resolveConfirmationStatus({
    bias,
    pattern,
    candles,
  });
    const bollingerPosition = getBollingerPosition(
    latestCandle,
    latestBollingerPoint
  );
  const recentPriceLocation = resolveRecentPriceLocation(
    latestCandle,
    candles,
    20,
    60
  );
  const nearHighCaution = isNearRecentHigh(latestCandle, candles, 60);
  const volumeConfirmation = resolveVolumeConfirmation(latestCandle, candles, 20);
   const pdf1Signal = resolvePdf1Signal({
    candles,
  });
  const title = buildTitle(pattern, bias, nearHighCaution);
   const message = buildMessage(
    pattern,
    bias,
    context,
    confirmationStatus,
    bollingerPosition,
    nearHighCaution,
    volumeConfirmation,
    recentPriceLocation,
    pdf1Signal
  );
  const { strengthScore, reasons } = calculateStrengthScore({
    candle: latestCandle,
    pattern,
    bias,
    context,
    confirmationStatus,
    bollingerPosition,
    nearHighCaution,
    volumeConfirmation,
    middleBandTouchSignal,
  });
  const { tradeSignal, buyZone } = resolveTradeSignal({
    pattern,
    bias,
    context,
    confirmationStatus,
    bollingerPosition,
    nearHighCaution,
    volumeConfirmation,
    middleBandTouchSignal,
  });

    return {
    pattern,
    bias,
    context,
    confirmationStatus,
    title,
    message,
    strengthScore,
    reasons,

    bodySize,
    rangeSize,
    upperShadowSize,
    lowerShadowSize,
    recentPriceLocation,
    pdf1Signal,

    bollingerPosition,
    bollingerBandDirection,
    middleBandTouchSignal,
    tradeSignal,
    buyZone,
    nearHighCaution,
    volumeConfirmation,
  };
}

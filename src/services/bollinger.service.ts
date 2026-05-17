import { Candle } from "../types/candle.types";
import {
  BollingerBandResult,
  BollingerBandSignal,
  BollingerEntryReadiness,
  BollingerMiddleBandDirection,
  BollingerSetupSignal,
} from "../types/bollinger.types";
import { getHistoricalDailySeries } from "./market-history.service";
import { getAllCandles } from "./candle.service";

const BOLLINGER_PERIOD = 20;
const STANDARD_DEVIATION_MULTIPLIER = 2;

type DailyPricePoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ComputedBollingerPoint = DailyPricePoint & {
  middleBand: number;
  upperBand: number;
  lowerBand: number;
  bandWidthPercent: number;
};

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function calculateMean(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function calculateStandardDeviation(values: number[], mean: number): number {
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    values.length;

  return Math.sqrt(variance);
}

function getBandSignal(
  currentClose: number,
  upperBand: number,
  lowerBand: number
): BollingerBandSignal {
  if (currentClose > upperBand) {
    return "ABOVE_UPPER";
  }

  if (currentClose < lowerBand) {
    return "BELOW_LOWER";
  }

  return "INSIDE_BANDS";
}

function buildDailySeries(
  candles: [string, number, number, number, number, number, number][],
  liveCandle: Candle | undefined
): DailyPricePoint[] {
  const historical = [...candles]
    .slice(1)
    .reverse()
    .map((row) => ({
      time: row[0],
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5],
    }));

  if (!liveCandle) {
    return historical;
  }

  const nextPoint: DailyPricePoint = {
    time: liveCandle.date,
    open: liveCandle.open,
    high: liveCandle.high,
    low: liveCandle.low,
    close: liveCandle.close,
    volume: liveCandle.volume,
  };

  if (historical.length === 0) {
    return [nextPoint];
  }

  const last = historical[historical.length - 1];

  if (last.time === nextPoint.time) {
    historical[historical.length - 1] = nextPoint;
    return historical;
  }

  historical.push(nextPoint);
  return historical;
}

function buildBollingerSeries(
  candles: DailyPricePoint[]
): ComputedBollingerPoint[] {
  if (candles.length < BOLLINGER_PERIOD) {
    return [];
  }

  const points: ComputedBollingerPoint[] = [];

  for (let index = BOLLINGER_PERIOD - 1; index < candles.length; index += 1) {
    const window = candles.slice(index - (BOLLINGER_PERIOD - 1), index + 1);
    const closes = window.map((item) => item.close);
    const mean = calculateMean(closes);
    const std = calculateStandardDeviation(closes, mean);
    const middleBand = roundTo2(mean);
    const upperBand = roundTo2(
      mean + STANDARD_DEVIATION_MULTIPLIER * std
    );
    const lowerBand = roundTo2(
      mean - STANDARD_DEVIATION_MULTIPLIER * std
    );

    points.push({
      ...candles[index],
      middleBand,
      upperBand,
      lowerBand,
      bandWidthPercent:
        middleBand <= 0
          ? 0
          : roundTo2(((upperBand - lowerBand) / middleBand) * 100),
    });
  }

  return points;
}

function getMiddleBandDirection(
  points: ComputedBollingerPoint[],
  lookback = 5
): BollingerMiddleBandDirection {
  if (points.length < lookback + 1) {
    return "FLAT";
  }

  const recent = points.slice(points.length - (lookback + 1));
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

function countConsecutiveClosesAboveMiddle(
  points: ComputedBollingerPoint[],
  maxLookback = 5
): number {
  let count = 0;

  for (
    let index = points.length - 1;
    index >= 0 && count < maxLookback;
    index -= 1
  ) {
    const point = points[index];

    if (point.close >= point.middleBand) {
      count += 1;
      continue;
    }

    break;
  }

  return count;
}

function findRecentBreakoutIndex(
  points: ComputedBollingerPoint[],
  lookback = 5
): number | null {
  const start = Math.max(1, points.length - lookback);

  for (let index = start; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    if (
      previous.close <= previous.middleBand &&
      current.close > current.middleBand
    ) {
      return index;
    }
  }

  return null;
}

function isRecentSqueeze(
  points: ComputedBollingerPoint[],
  lookback = 6
): boolean {
  if (points.length < lookback + 1) {
    return false;
  }

  const latest = points[points.length - 1];
  const previousWidths = points
    .slice(points.length - (lookback + 1), points.length - 1)
    .map((item) => item.bandWidthPercent);

  const averagePreviousWidth =
    previousWidths.reduce((sum, value) => sum + value, 0) /
    previousWidths.length;

  return latest.bandWidthPercent <= averagePreviousWidth * 0.9;
}

function hasValidSupportRetest(points: ComputedBollingerPoint[]): boolean {
  if (points.length < 3) {
    return false;
  }

  const recent = points.slice(-3);
  const latest = recent[recent.length - 1];
  const latestBandWidth = Math.max(
    latest.upperBand - latest.lowerBand,
    0.0001
  );

  const touchedMiddle = recent.some(
    (point) =>
      point.low <= point.middleBand ||
      Math.abs(point.close - point.middleBand) <= latestBandWidth * 0.10
  );

  const heldAboveMiddle = recent.every(
    (point) => point.close >= point.middleBand * 0.995
  );

  const latestGreen = latest.close > latest.open;
  const cameFromAbove = recent.some((point) => point.close > point.middleBand);

  return touchedMiddle && heldAboveMiddle && latestGreen && cameFromAbove;
}

function getSupportRetestConfirmation(points: ComputedBollingerPoint[]): {
  isValid: boolean;
  holdDays: number;
  runUpPercent: number;
} {
  if (points.length < 3) {
    return {
      isValid: false,
      holdDays: 0,
      runUpPercent: 0,
    };
  }

  const recent = points.slice(-5);
  const retestIndex = recent.findIndex(
    (point) =>
      point.low <= point.middleBand ||
      Math.abs(point.close - point.middleBand) <=
        Math.max(point.upperBand - point.lowerBand, 0.0001) * 0.10
  );

  if (retestIndex === -1) {
    return {
      isValid: false,
      holdDays: 0,
      runUpPercent: 0,
    };
  }

  const confirmationSlice = recent.slice(retestIndex);
  const holdDays = confirmationSlice.filter(
    (point) => point.close >= point.middleBand * 0.995
  ).length;

  const retestClose = confirmationSlice[0]?.close ?? 0;
  const maxCloseAfterRetest = Math.max(
    ...confirmationSlice.map((point) => point.close)
  );

  const runUpPercent =
    retestClose <= 0
      ? 0
      : ((maxCloseAfterRetest - retestClose) / retestClose) * 100;

  const latest = points[points.length - 1];
  const latestGreen = latest.close > latest.open;

  const isValid =
    holdDays >= 2 &&
    holdDays <= 5 &&
    runUpPercent <= 10 &&
    latestGreen;

  return {
    isValid,
    holdDays,
    runUpPercent: roundTo2(runUpPercent),
  };
}

function hasLowerBandWatch(points: ComputedBollingerPoint[]): boolean {
  if (points.length < 3) {
    return false;
  }

  const recent = points.slice(-3);
  const latest = recent[recent.length - 1];
  const latestBandWidth = Math.max(
    latest.upperBand - latest.lowerBand,
    0.0001
  );

  const nearLowerBand = recent.some(
    (point) =>
      point.low <= point.lowerBand ||
      Math.abs(point.close - point.lowerBand) <= latestBandWidth * 0.12
  );

  const heldAboveLowerBand = recent.every(
    (point) => point.close >= point.lowerBand * 0.995
  );

  const latestRecovery =
    latest.close >= latest.open || latest.close >= latest.lowerBand;

  return nearLowerBand && heldAboveLowerBand && latestRecovery;
}

function hasMiddleBandBreakdownRisk(points: ComputedBollingerPoint[]): boolean {
  if (points.length < 2) {
    return false;
  }

  const latest = points[points.length - 1];
  const previous = points[points.length - 2];

  return (
    previous.close >= previous.middleBand &&
    latest.close < latest.middleBand
  );
}

function buildSetup(
  points: ComputedBollingerPoint[]
): {
  setupSignal: BollingerSetupSignal;
  entryReadiness: BollingerEntryReadiness;
  breakoutConfirmedDays: number;
  entryPrice: number | null;
  stopLoss: number | null;
  targetPrice: number | null;
  setupNotes: string[];
} {
  const latest = points[points.length - 1];
  const direction = getMiddleBandDirection(points);
  const aboveMiddleDays = countConsecutiveClosesAboveMiddle(points, 5);
  const breakoutIndex = findRecentBreakoutIndex(points, 5);
  const squeeze = isRecentSqueeze(points, 6);
  const supportRetest = getSupportRetestConfirmation(points);

  if (breakoutIndex !== null) {
    const breakoutSlice = points.slice(breakoutIndex);
    const breakoutClose = points[breakoutIndex].close;
    const maxCloseAfterBreakout = Math.max(
      ...breakoutSlice.map((item) => item.close)
    );
    const runUpPercent =
      breakoutClose <= 0
        ? 0
        : ((maxCloseAfterBreakout - breakoutClose) / breakoutClose) * 100;

    const hasValidBreakoutHold =
      aboveMiddleDays >= 3 && aboveMiddleDays <= 5;

    const hasValidRunUp = runUpPercent <= 10;

    if (hasValidBreakoutHold && hasValidRunUp && squeeze) {
      return {
        setupSignal: "BREAKOUT_BUY",
        entryReadiness: "READY",
        breakoutConfirmedDays: aboveMiddleDays,
        entryPrice: roundTo2(latest.close),
        stopLoss: roundTo2(latest.middleBand * 0.995),
        targetPrice: roundTo2(latest.close * 1.05),
        setupNotes: [
          "Price broke above the middle band and held above it for 3 to 5 candles.",
          "Bands were contracting into the breakout, which matches the Chapter 5 squeeze breakout condition.",
          "Initial breakout run-up is still within the 10% cap described in the PDF.",
        ],
      };
    }

    if (hasValidBreakoutHold && hasValidRunUp && !squeeze) {
      return {
        setupSignal: "NO_SETUP",
        entryReadiness: "WATCH",
        breakoutConfirmedDays: aboveMiddleDays,
        entryPrice: null,
        stopLoss: null,
        targetPrice: null,
        setupNotes: [
          "Price did break above the middle band and hold above it for 3 to 5 candles.",
          "However, the Bollinger bands were not contracting enough before the breakout.",
          "Per Chapter 5, this weakens the breakout quality, so this remains a watch condition instead of a ready breakout buy.",
        ],
      };
    }
  }

  if (direction === "RISING" && hasValidSupportRetest(points)) {
    if (supportRetest.isValid) {
      return {
        setupSignal: "SUPPORT_BUY",
        entryReadiness: "READY",
        breakoutConfirmedDays: supportRetest.holdDays,
        entryPrice: roundTo2(latest.close),
        stopLoss: roundTo2(latest.middleBand * 0.995),
        targetPrice: roundTo2(latest.close * 1.05),
        setupNotes: [
          "Price pulled back to the rising middle band and held above it.",
          `Support held for ${supportRetest.holdDays} candles after the retest, which confirms the bounce more cleanly.`,
          `Post-retest run-up is ${supportRetest.runUpPercent}%, which is still within the 10% discipline cap.`,
          "This matches the stricter Chapter 5 support-retest buy setup.",
        ],
      };
    }

    return {
      setupSignal: "NO_SETUP",
      entryReadiness: "WATCH",
      breakoutConfirmedDays: supportRetest.holdDays,
      entryPrice: null,
      stopLoss: null,
      targetPrice: null,
      setupNotes: [
        "Price did react near the rising middle band, but confirmation is still weaker than required.",
        `Support hold after retest is ${supportRetest.holdDays} candles and run-up is ${supportRetest.runUpPercent}%.`,
        "Wait for a cleaner hold above the middle band and a controlled bounce before upgrading this to SUPPORT_BUY.",
      ],
    };
  }

  if (hasMiddleBandBreakdownRisk(points)) {
    return {
      setupSignal: "BREAKDOWN_RISK",
      entryReadiness: "AVOID",
      breakoutConfirmedDays: aboveMiddleDays,
      entryPrice: null,
      stopLoss: null,
      targetPrice: null,
      setupNotes: [
        "Price has slipped back below the middle band after testing it.",
        "The middle band is failing as support.",
        "This is an avoid / defensive condition, not a fresh long entry.",
      ],
    };
  }

  if (hasLowerBandWatch(points)) {
    return {
      setupSignal: "LOWER_BAND_WATCH",
      entryReadiness: "WATCH",
      breakoutConfirmedDays: aboveMiddleDays,
      entryPrice: roundTo2(latest.lowerBand),
      stopLoss: roundTo2(latest.lowerBand * 0.995),
      targetPrice: roundTo2(latest.lowerBand * 1.05),
      setupNotes: [
        "Price is near the lower band and has not broken down decisively.",
        "This is a watch zone, not the cleanest confirmed entry yet.",
        "Watch for stability and a bullish reaction before upgrading to a buy.",
      ],
    };
  }

  return {
    setupSignal: "NO_SETUP",
    entryReadiness: "WATCH",
    breakoutConfirmedDays: aboveMiddleDays,
    entryPrice: null,
    stopLoss: null,
    targetPrice: null,
    setupNotes: [
      "No Chapter 5 entry condition is fully active right now.",
      "Wait for either a middle-band breakout hold or a clean support retest.",
    ],
  };
}

/**
 * Calculates daily Bollinger values and Chapter 5 entry logic:
 * - middle-band breakout buy
 * - middle-band support buy
 * - lower-band watch
 * - breakdown risk
 */
export async function getLatestBollingerBands(): Promise<BollingerBandResult[]> {
  const [historicalSeries, liveCandles] = await Promise.all([
    getHistoricalDailySeries(),
    getAllCandles(),
  ]);

  const liveCandleMap = new Map(
    liveCandles.map((candle) => [candle.instrumentKey, candle])
  );

  return historicalSeries
    .map((series) => {
      const mergedDailySeries = buildDailySeries(
        series.candles,
        liveCandleMap.get(series.instrumentKey)
      );

      const bollingerSeries = buildBollingerSeries(mergedDailySeries);

      if (bollingerSeries.length === 0) {
        return null;
      }

      const latest = bollingerSeries[bollingerSeries.length - 1];
      const bandSignal = getBandSignal(
        latest.close,
        latest.upperBand,
        latest.lowerBand
      );
      const middleBandDirection = getMiddleBandDirection(bollingerSeries);
      const setup = buildSetup(bollingerSeries);

      return {
        id: series.id,
        symbol: series.symbol,
        timeframe: "1D" as const,
        period: BOLLINGER_PERIOD,
        currentClose: roundTo2(latest.close),
        middleBand: latest.middleBand,
        upperBand: latest.upperBand,
        lowerBand: latest.lowerBand,
        bandSignal,
        setupSignal: setup.setupSignal,
        entryReadiness: setup.entryReadiness,
        middleBandDirection,
        bandWidthPercent: latest.bandWidthPercent,
        breakoutConfirmedDays: setup.breakoutConfirmedDays,
        entryPrice: setup.entryPrice,
        stopLoss: setup.stopLoss,
        targetPrice: setup.targetPrice,
        setupNotes: setup.setupNotes,
      };
    })
    .filter((result): result is BollingerBandResult => Boolean(result));
}
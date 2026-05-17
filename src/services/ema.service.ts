import {
  EmaResult,
  EmaSlant,
  PriceVsEma44,
  TrendState,
} from "../types/ema.types";
import { getCachedHistoricalSeries } from "./market-history-cache.service";
import { getCachedLiveCandles } from "./live-market-cache.service";

const EMA_PERIOD = 44;
const SLOPE_FLAT_THRESHOLD = 0.02;
const PRICE_EMA_NEAR_THRESHOLD_PERCENT = 0.002; // 0.2%

function calculateEmaSeries(values: number[], period: number): number[] {
  if (values.length < period) {
    return [];
  }

  const multiplier = 2 / (period + 1);

  let ema =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;

  const emaSeries: number[] = [ema];

  for (let i = period; i < values.length; i += 1) {
    ema = (values[i] - ema) * multiplier + ema;
    emaSeries.push(ema);
  }

  return emaSeries;
}

function calculateSlope(values: number[]): number {
  const n = values.length;

  if (n < 2) {
    return 0;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = values[i];

    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = n * sumXX - sumX * sumX;

  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function getSlantLabel(values: number[]): EmaSlant {
  const slope = calculateSlope(values);

  if (Math.abs(slope) <= SLOPE_FLAT_THRESHOLD) {
    return "FLAT";
  }

  return slope > 0 ? "UPWARD" : "DOWNWARD";
}

function getPriceVsEma44(
  currentClose: number,
  ema44: number
): PriceVsEma44 {
  const tolerance = ema44 * PRICE_EMA_NEAR_THRESHOLD_PERCENT;

  if (currentClose > ema44 + tolerance) {
    return "ABOVE_EMA";
  }

  if (currentClose < ema44 - tolerance) {
    return "BELOW_EMA";
  }

  return "NEAR_EMA";
}

function getTrendState(
  priceVsEma44: PriceVsEma44,
  ema7dSlant: EmaSlant,
  ema14dSlant: EmaSlant
): TrendState {
  if (
    priceVsEma44 === "ABOVE_EMA" &&
    ema7dSlant === "UPWARD" &&
    ema14dSlant === "UPWARD"
  ) {
    return "UPTREND";
  }

  if (
    priceVsEma44 === "BELOW_EMA" &&
    ema7dSlant === "DOWNWARD" &&
    ema14dSlant === "DOWNWARD"
  ) {
    return "DOWNTREND";
  }

  if (
    priceVsEma44 === "ABOVE_EMA" &&
    ema7dSlant === "DOWNWARD" &&
    ema14dSlant === "UPWARD"
  ) {
    return "BULLISH_PULLBACK";
  }

  if (
    priceVsEma44 === "ABOVE_EMA" &&
    ema7dSlant === "DOWNWARD" &&
    ema14dSlant === "DOWNWARD"
  ) {
    return "BEARISH_BOUNCE";
  }

  if (
    priceVsEma44 === "ABOVE_EMA" &&
    ema7dSlant === "UPWARD" &&
    ema14dSlant === "DOWNWARD"
  ) {
    return "EARLY_RECOVERY";
  }

  if (
    priceVsEma44 === "BELOW_EMA" &&
    ema7dSlant === "UPWARD" &&
    ema14dSlant === "DOWNWARD"
  ) {
    return "EARLY_RECOVERY";
  }

  if (
    priceVsEma44 === "BELOW_EMA" &&
    ema7dSlant === "DOWNWARD" &&
    ema14dSlant === "UPWARD"
  ) {
    return "FAILED_RECOVERY";
  }

  return "SIDEWAYS";
}

export function getLatestEma44(): EmaResult[] {
  const historicalSeries = getCachedHistoricalSeries();
  const liveCandles = getCachedLiveCandles();

  if (historicalSeries.length === 0 || liveCandles.length === 0) {
    return [];
  }

  const liveCloseMap = new Map(
    liveCandles.map((candle) => [candle.instrumentKey, candle.close])
  );

  return historicalSeries
    .map((series) => {
      const liveClose = liveCloseMap.get(series.instrumentKey);

      if (typeof liveClose !== "number") {
        return null;
      }

      const historicalCloses = [...series.candles]
        .slice(1)
        .reverse()
        .map((row) => row[4]);

      const closes = [...historicalCloses, liveClose];

      const emaSeries = calculateEmaSeries(closes, EMA_PERIOD);

      if (emaSeries.length < 14) {
        return null;
      }

      const currentEma = emaSeries[emaSeries.length - 1];
      const last7EmaValues = emaSeries.slice(-7);
      const last14EmaValues = emaSeries.slice(-14);

      const ema7dSlant = getSlantLabel(last7EmaValues);
      const ema14dSlant = getSlantLabel(last14EmaValues);
      const priceVsEma44 = getPriceVsEma44(liveClose, currentEma);
      const trendState = getTrendState(
        priceVsEma44,
        ema7dSlant,
        ema14dSlant
      );

      return {
        id: series.id,
        symbol: series.symbol,
        timeframe: "1D" as const,
        period: 44 as const,
        currentClose: Number(liveClose.toFixed(2)),
        ema44: Number(currentEma.toFixed(2)),
        ema7dSlant,
        ema14dSlant,
        priceVsEma44,
        trendState,
      };
    })
    .filter((item): item is EmaResult => Boolean(item));
}
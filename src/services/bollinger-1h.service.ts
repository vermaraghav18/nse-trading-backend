import {
  Bollinger1HResult,
  Bollinger1HSignal,
} from "../types/bollinger-1h.types";
import { getCachedHistorical1HSeries } from "./market-history-1h-cache.service";
import { getCachedLive1HCandles } from "./live-1h-cache.service";

const BOLLINGER_PERIOD = 20;
const STANDARD_DEVIATION_MULTIPLIER = 2;

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

function getBollingerSignal(
  currentClose: number,
  upperBand: number,
  lowerBand: number
): Bollinger1HSignal {
  if (currentClose > upperBand) {
    return "ABOVE_UPPER";
  }

  if (currentClose < lowerBand) {
    return "BELOW_LOWER";
  }

  return "INSIDE_BANDS";
}

function buildMerged1HCloses(
  candles: [string, number, number, number, number, number, number][],  // ← Changed from 6 to 7
  liveCandle?: {
    dateTime: string;
    close: number;
  }
): number[] {
  const chronological = [...candles].reverse();
  const closes = chronological.map((row) => row[4]);

  if (!liveCandle) {
    return closes;
  }

  const lastHistorical = chronological[chronological.length - 1];

  if (lastHistorical && lastHistorical[0] === liveCandle.dateTime) {
    const next = [...closes];
    next[next.length - 1] = liveCandle.close;
    return next;
  }

  return [...closes, liveCandle.close];
}

export function getLatestBollinger1H(): Bollinger1HResult[] {
  const historicalSeries = getCachedHistorical1HSeries();

  if (historicalSeries.length === 0) {
    return [];
  }

  const liveCandles = getCachedLive1HCandles();
  const liveCandleMap = new Map(
    liveCandles.map((candle) => [
      candle.instrumentKey,
      { close: candle.close, dateTime: candle.dateTime },
    ])
  );

  return historicalSeries
    .map((series) => {
      const liveCandle = liveCandleMap.get(series.instrumentKey);
      const rawCloses = buildMerged1HCloses(series.candles, liveCandle);
      const closes = rawCloses.filter((c): c is number => typeof c === "number" && !isNaN(c));

      if (closes.length < BOLLINGER_PERIOD) {
        return null;
      }

      const recentCloses = closes.slice(-BOLLINGER_PERIOD);
      const currentClose = closes[closes.length - 1];

      const mean = calculateMean(recentCloses);
      const standardDeviation = calculateStandardDeviation(recentCloses, mean);

      const middleBand = Number(mean.toFixed(2));
      const upperBand = Number(
        (mean + STANDARD_DEVIATION_MULTIPLIER * standardDeviation).toFixed(2)
      );
      const lowerBand = Number(
        (mean - STANDARD_DEVIATION_MULTIPLIER * standardDeviation).toFixed(2)
      );

      return {
        id: series.id,
        symbol: series.symbol,
        timeframe: "1H" as const,
        period: 20 as const,
        currentClose: Number(currentClose.toFixed(2)),
        middleBand,
        upperBand,
        lowerBand,
        signal: getBollingerSignal(currentClose, upperBand, lowerBand),
      };
    })
    .filter((item): item is Bollinger1HResult => Boolean(item));
}
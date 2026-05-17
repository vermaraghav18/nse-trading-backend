import {
  BollingerBandResult,
  BollingerBandSignal,
  BollingerEntryReadiness,
  BollingerMiddleBandDirection,
  BollingerSetupSignal,
} from "../types/bollinger.types";
import { getCachedHistoricalSeries } from "./market-history-cache.service";
import { getCachedLiveCandles } from "./live-market-cache.service";

const BOLLINGER_PERIOD = 20;
const STANDARD_DEVIATION_MULTIPLIER = 2;

let cachedBollinger: BollingerBandResult[] = [];
let lastBollingerRefreshAt: string | null = null;
let isRefreshingBollinger = false;

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

function getBollingerBandSignal(
  currentClose: number,
  upperBand: number,
  lowerBand: number
): BollingerBandSignal {
  if (currentClose > upperBand) return "ABOVE_UPPER";
  if (currentClose < lowerBand) return "BELOW_LOWER";
  return "INSIDE_BANDS";
}

function getMiddleBandDirection(closes: number[]): BollingerMiddleBandDirection {
  if (closes.length < BOLLINGER_PERIOD + 1) {
    return "FLAT";
  }

  const previousWindow = closes.slice(-(BOLLINGER_PERIOD + 1), -1);
  const currentWindow = closes.slice(-BOLLINGER_PERIOD);

  const previousMean = calculateMean(previousWindow);
  const currentMean = calculateMean(currentWindow);

  if (currentMean > previousMean) return "RISING";
  if (currentMean < previousMean) return "FALLING";
  return "FLAT";
}

function getBandWidthPercent(
  middleBand: number,
  upperBand: number,
  lowerBand: number
): number {
  if (middleBand === 0) return 0;
  return Number((((upperBand - lowerBand) / middleBand) * 100).toFixed(2));
}

/**
 * This live cache is only for freshness/snapshot support.
 * It should not try to recreate the full Chapter 5 strategy engine here.
 */
function getDefaultSetupSignal(): BollingerSetupSignal {
  return "NO_SETUP";
}

function getDefaultEntryReadiness(
  currentClose: number,
  middleBand: number
): BollingerEntryReadiness {
  if (currentClose > middleBand) return "WATCH";
  return "AVOID";
}

export async function refreshLiveBollingerCache(): Promise<void> {
  if (isRefreshingBollinger) return;

  isRefreshingBollinger = true;

  try {
    const historicalSeries = getCachedHistoricalSeries();
    const liveCandles = getCachedLiveCandles();

    if (historicalSeries.length === 0) {
      console.warn("[bollinger-cache] Historical cache empty. Skipping refresh.");
      return;
    }

    if (liveCandles.length === 0) {
      console.warn("[bollinger-cache] Live candle cache empty. Skipping refresh.");
      return;
    }

    const liveCloseMap = new Map(
      liveCandles.map((c) => [c.instrumentKey, c.close] as const)
    );

    const results = historicalSeries
      .map((series): BollingerBandResult | null => {
        const liveClose = liveCloseMap.get(series.instrumentKey);
        if (typeof liveClose !== "number") return null;

        const historicalCloses = [...series.candles]
          .slice(1)
          .reverse()
          .map((row) => row[4]);

        const last19 = historicalCloses.slice(-(BOLLINGER_PERIOD - 1));
        if (last19.length < BOLLINGER_PERIOD - 1) return null;

        const closes = [...last19, liveClose];

        const mean = calculateMean(closes);
        const std = calculateStandardDeviation(closes, mean);

        const middleBand = Number(mean.toFixed(2));
        const upperBand = Number(
          (mean + STANDARD_DEVIATION_MULTIPLIER * std).toFixed(2)
        );
        const lowerBand = Number(
          (mean - STANDARD_DEVIATION_MULTIPLIER * std).toFixed(2)
        );

        const bandSignal = getBollingerBandSignal(
          liveClose,
          upperBand,
          lowerBand
        );

        const middleBandDirection = getMiddleBandDirection(
          historicalCloses.slice(-BOLLINGER_PERIOD).concat(liveClose)
        );

        const bandWidthPercent = getBandWidthPercent(
          middleBand,
          upperBand,
          lowerBand
        );

        const setupSignal = getDefaultSetupSignal();
        const entryReadiness = getDefaultEntryReadiness(liveClose, middleBand);

        return {
          id: series.id,
          symbol: series.symbol,
          timeframe: "1D" as const,
          period: BOLLINGER_PERIOD,
          currentClose: Number(liveClose.toFixed(2)),
          middleBand,
          upperBand,
          lowerBand,
          bandSignal,
          setupSignal,
          entryReadiness,
          middleBandDirection,
          bandWidthPercent,
          breakoutConfirmedDays: 0,
          entryPrice: null as number | null,
          stopLoss: null as number | null,
          targetPrice: null as number | null,
          setupNotes: [
            "Live cache result generated from historical daily candles plus latest live close.",
            "This cache supports dashboard/chart freshness and does not replace the full Bollinger strategy engine.",
          ],
        };
      })
      .filter((item): item is BollingerBandResult => item !== null);

    if (results.length > 0) {
      cachedBollinger = results;
      lastBollingerRefreshAt = new Date().toISOString();

      console.log(
        `[bollinger-cache] Refreshed ${results.length} stocks at ${lastBollingerRefreshAt}`
      );
    } else {
      console.warn("[bollinger-cache] Refresh returned 0 rows. Keeping old cache.");
    }
  } catch (error) {
    console.error("[bollinger-cache] Error refreshing live bollinger cache:", error);
  } finally {
    isRefreshingBollinger = false;
  }
}

export function getCachedLiveBollinger(): BollingerBandResult[] {
  return cachedBollinger;
}

export function getLastBollingerRefreshAt(): string | null {
  return lastBollingerRefreshAt;
}
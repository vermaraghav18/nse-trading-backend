import {
  Ema1HResult,
  Ema1HSlant,
  PriceVsEma1H,
  TrendState1H,
} from "../types/ema-1h.types";
import { getCachedHistorical1HSeries } from "./market-history-1h-cache.service";
import { getCachedLive1HCandles } from "./live-1h-cache.service";
import { 
  getMerged1HCandlesByInstrument,
  getUpstoxMarketWsStatus 
} from "./upstox-market-ws.service";

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

function getSlantLabel(values: number[]): Ema1HSlant {
  const slope = calculateSlope(values);

  if (Math.abs(slope) <= SLOPE_FLAT_THRESHOLD) {
    return "FLAT";
  }

  return slope > 0 ? "UPWARD" : "DOWNWARD";
}

function getPriceVsEma44(currentClose: number, ema44: number): PriceVsEma1H {
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
  priceVsEma44: PriceVsEma1H,
  ema7dSlant: Ema1HSlant,
  ema14dSlant: Ema1HSlant
): TrendState1H {
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

function buildMerged1HCloses(
  candles: [string, number, number, number, number, number, number][],
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

export async function getLatestEma1H(): Promise<Ema1HResult[]> {
  const historicalSeries = getCachedHistorical1HSeries();
  const liveCandles = getCachedLive1HCandles();

  console.log(`[ema-1h-diagnostic] Historical series count: ${historicalSeries.length}`);
  console.log(`[ema-1h-diagnostic] Live candles from cache: ${liveCandles.length}`);

  if (historicalSeries.length === 0) {
    console.log(`[ema-1h-diagnostic] ❌ Historical series is EMPTY - returning []`);
    return [];
  }

  console.log(`[ema-1h-diagnostic] ✅ Processing ${historicalSeries.length} instruments`);

  // Step 1: seed map from Upstox intraday cache — covers all stocks, refreshed every 60s
  const liveCandleMap = new Map<string, { close: number; dateTime: string }>();

  for (const candle of liveCandles) {
    liveCandleMap.set(candle.instrumentKey, {
      close: candle.close,
      dateTime: candle.dateTime,
    });
  }

  // Step 2: override with real-time WS minute candles for subscribed instruments
  const wsStatus = getUpstoxMarketWsStatus();
  const wsInstruments = new Set(wsStatus.subscribedInstrumentKeys);
  let wsLiveCount = 0;

  for (const instrumentKey of wsInstruments) {
    try {
      const ws1HCandles = await getMerged1HCandlesByInstrument(instrumentKey);
      if (ws1HCandles.length > 0) {
        const latest = ws1HCandles[ws1HCandles.length - 1];
        liveCandleMap.set(instrumentKey, {
          close: latest.close,
          dateTime: latest.bucketStart,
        });
        wsLiveCount++;
      }
    } catch {
      // Skip if WS data not available for this instrument
    }
  }

  console.log(`[ema-1h-diagnostic] ✅ Live candles: ${wsLiveCount} from WebSocket + ${liveCandles.length} from cache = ${liveCandleMap.size} total`);

  const results = historicalSeries
    .map((series) => {
      const liveCandle = liveCandleMap.get(series.instrumentKey);
      const rawCloses = buildMerged1HCloses(series.candles, liveCandle);
      const closes = rawCloses.filter((c): c is number => typeof c === "number" && !isNaN(c));

      if (closes.length < EMA_PERIOD) {
        return null;
      }

      const emaSeries = calculateEmaSeries(closes, EMA_PERIOD);

      if (emaSeries.length < 14) {
        return null;
      }

      const currentClose = closes[closes.length - 1];
      const currentEma = emaSeries[emaSeries.length - 1];
      const last7EmaValues = emaSeries.slice(-7);
      const last14EmaValues = emaSeries.slice(-14);

      const ema7dSlant = getSlantLabel(last7EmaValues);
      const ema14dSlant = getSlantLabel(last14EmaValues);
      const priceVsEma44 = getPriceVsEma44(currentClose, currentEma);
      const trendState = getTrendState(
        priceVsEma44,
        ema7dSlant,
        ema14dSlant
      );

      return {
        id: series.id,
        symbol: series.symbol,
        timeframe: "1H" as const,
        period: 44 as const,
        currentClose: Number(currentClose.toFixed(2)),
        ema44: Number(currentEma.toFixed(2)),
        ema7dSlant,
        ema14dSlant,
        priceVsEma44,
        trendState,
      };
    })
    .filter((item): item is Ema1HResult => Boolean(item));

  return results;
}
import { getCachedHistoricalSeries } from "./market-history-cache.service";
import { getCachedLiveCandles } from "./live-market-cache.service";
import {
  getMerged1HCandlesByInstrument as getWsMerged1HCandlesByInstrument,
  getMerged2HCandlesByInstrument as getWsMerged2HCandlesByInstrument,
} from "./upstox-market-ws.service";
import { buildCandleIntelligence } from "./candle-intelligence.service";
import {
  buildSupportAnalysis,
  buildSupportClusters,
} from "./support-engine.service";
import {
  buildResistanceAnalysis,
  buildResistanceClusters,
} from "./resistance-engine.service";
import { buildTradePlan } from "./trade-plan.service";
import { detectOscillationSignal } from "./oscillation-engine.service";
import { detectBollingerConfluence } from "./bollinger-confluence.service";
import { getAllStocks } from "./stock.service";
import { buildScannerScores } from "./scanner-score.service";
import { buildPdf2Setup } from "./pdf2-setup.service";
import { buildPdf3BollingerEntry } from "./pdf3-bollinger-entry.service";
import {
  ChartBollingerPoint,
  ChartCandlePoint,
  ChartLinePoint,
  ChartTimeframe,
  StockChartData,
  StockScannerResponse,
  StockScannerRow,
} from "../types/chart.types";

const EMA_PERIOD = 44;
const BOLLINGER_PERIOD = 20;
const BOLLINGER_STD_MULTIPLIER = 2;

type RawHistoricalCandle = [
  string,
  number,
  number,
  number,
  number,
  number,
  number,
];

type SlantValue = "UPWARD" | "DOWNWARD" | "FLAT";

type ResolvedStockIdentity = {
  symbol: string;
  instrumentKey: string;
};

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function calculateEmaSeries(values: number[], period: number): number[] {
  if (values.length < period) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  let ema =
    values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const result: number[] = [ema];

  for (let index = period; index < values.length; index += 1) {
    ema = (values[index] - ema) * multiplier + ema;
    result.push(ema);
  }

  return result;
}

function calculateMean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateStandardDeviation(values: number[], mean: number): number {
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    values.length;

  return Math.sqrt(variance);
}

function buildHistoricalChartCandles(
  candles: RawHistoricalCandle[] | any[]
): ChartCandlePoint[] {
  const seen = new Set<string>();
  const result: ChartCandlePoint[] = [];
  const reversed = [...candles].reverse();

  for (const row of reversed) {
    // Handle both array format [time, o, h, l, c, v] and object format {date, open, high, low, close, volume}
    let time: string;
    let open: number;
    let high: number;
    let low: number;
    let close: number;
    let volume: number;

    if (Array.isArray(row)) {
      // Array format (Upstox/expected)
      time = row[0];
      open = row[1];
      high = row[2];
      low = row[3];
      close = row[4];
      volume = row[5];
    } else {
      // Object format (Zerodha fallback)
      time = row.date;
      open = row.open;
      high = row.high;
      low = row.low;
      close = row.close;
      volume = row.volume;
    }

    if (!seen.has(time)) {
      seen.add(time);
      result.push({
        time,
        open,
        high,
        low,
        close,
        volume,
      });
    }
  }

  result.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  return result;
}

function mergeLiveCandle(
  historicalCandles: ChartCandlePoint[],
  liveCandle: {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null
): ChartCandlePoint[] {
  if (!liveCandle) {
    return historicalCandles;
  }

  const nextCandles = [...historicalCandles];
  const nextPoint: ChartCandlePoint = {
    time: liveCandle.date,
    open: liveCandle.open,
    high: liveCandle.high,
    low: liveCandle.low,
    close: liveCandle.close,
    volume: liveCandle.volume,
  };

  if (nextCandles.length === 0) {
    return [nextPoint];
  }

  const existingIndex = nextCandles.findIndex(
    (candle) => candle.time === nextPoint.time
  );

  if (existingIndex >= 0) {
    nextCandles[existingIndex] = nextPoint;
  } else {
    nextCandles.push(nextPoint);
  }

  nextCandles.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  const deduped: ChartCandlePoint[] = [];
  const seen = new Set<string>();

  for (const candle of nextCandles) {
    if (!seen.has(candle.time)) {
      seen.add(candle.time);
      deduped.push(candle);
    }
  }

  return deduped;
}

function mergeLive1HCandle(
  historicalCandles: ChartCandlePoint[],
  liveCandle: {
    dateTime: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null
): ChartCandlePoint[] {
  if (!liveCandle) {
    return historicalCandles;
  }

  const nextCandles = [...historicalCandles];
  const nextPoint: ChartCandlePoint = {
    time: liveCandle.dateTime,
    open: liveCandle.open,
    high: liveCandle.high,
    low: liveCandle.low,
    close: liveCandle.close,
    volume: liveCandle.volume,
  };

  if (nextCandles.length === 0) {
    return [nextPoint];
  }

  const existingIndex = nextCandles.findIndex(
    (candle) => candle.time === nextPoint.time
  );

  if (existingIndex >= 0) {
    nextCandles[existingIndex] = nextPoint;
  } else {
    nextCandles.push(nextPoint);
  }

  nextCandles.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));

  const deduped: ChartCandlePoint[] = [];
  const seen = new Set<string>();

  for (const candle of nextCandles) {
    if (!seen.has(candle.time)) {
      seen.add(candle.time);
      deduped.push(candle);
    }
  }

  return deduped;
}

function buildEma44Series(candles: ChartCandlePoint[]): ChartLinePoint[] {
  const closes = candles.map((candle) => candle.close);
  const emaSeries = calculateEmaSeries(closes, EMA_PERIOD);

  if (emaSeries.length === 0) {
    return [];
  }

  const startIndex = EMA_PERIOD - 1;

  return emaSeries.map((value, index) => ({
    time: candles[startIndex + index].time,
    value: roundTo2(value),
  }));
}

function buildBollinger20Series(
  candles: ChartCandlePoint[]
): ChartBollingerPoint[] {
  if (candles.length < BOLLINGER_PERIOD) {
    return [];
  }

  const points: ChartBollingerPoint[] = [];

  for (let index = BOLLINGER_PERIOD - 1; index < candles.length; index += 1) {
    const window = candles.slice(index - (BOLLINGER_PERIOD - 1), index + 1);
    const closes = window.map((candle) => candle.close);
    const mean = calculateMean(closes);
    const std = calculateStandardDeviation(closes, mean);

    points.push({
      time: candles[index].time,
      middleBand: roundTo2(mean),
      upperBand: roundTo2(mean + BOLLINGER_STD_MULTIPLIER * std),
      lowerBand: roundTo2(mean - BOLLINGER_STD_MULTIPLIER * std),
    });
  }

  return points;
}

function calculateSlantFromEmaSeries(
  emaSeries: ChartLinePoint[],
  lookbackPeriods: number
): SlantValue | null {
  if (emaSeries.length <= lookbackPeriods) {
    return null;
  }

  const latest = emaSeries[emaSeries.length - 1]?.value;
  const previous = emaSeries[emaSeries.length - 1 - lookbackPeriods]?.value;

  if (typeof latest !== "number" || typeof previous !== "number") {
    return null;
  }

  const diff = latest - previous;
  const flatThreshold = Math.abs(previous) * 0.0005;

  if (Math.abs(diff) <= flatThreshold) {
    return "FLAT";
  }

  return diff > 0 ? "UPWARD" : "DOWNWARD";
}


function sortAndDedupeChartCandles(
  candles: ChartCandlePoint[]
): ChartCandlePoint[] {
  const sorted = [...candles].sort((a, b) =>
    a.time < b.time ? -1 : a.time > b.time ? 1 : 0
  );

  const latestByTime = new Map<string, ChartCandlePoint>();

  for (const candle of sorted) {
    latestByTime.set(candle.time, candle);
  }

  return Array.from(latestByTime.values()).sort((a, b) =>
    a.time < b.time ? -1 : a.time > b.time ? 1 : 0
  );
}

function getTradingDateKey(time: string): string {
  return time.split("T")[0];
}



function aggregate1HTo2H(candles1H: ChartCandlePoint[]): ChartCandlePoint[] {
  const sorted = sortAndDedupeChartCandles(candles1H);

  if (sorted.length === 0) {
    return [];
  }

  const groupedByDay = new Map<string, ChartCandlePoint[]>();

  for (const candle of sorted) {
    const dayKey = getTradingDateKey(candle.time);

    if (!groupedByDay.has(dayKey)) {
      groupedByDay.set(dayKey, []);
    }

    groupedByDay.get(dayKey)!.push(candle);
  }

  const result: ChartCandlePoint[] = [];

  for (const dayCandles of groupedByDay.values()) {
    for (let i = 0; i < dayCandles.length; i += 2) {
      const first = dayCandles[i];
      const second = dayCandles[i + 1];

      if (!first) {
        continue;
      }

      if (!second) {
        result.push({
          time: first.time,
          open: first.open,
          high: first.high,
          low: first.low,
          close: first.close,
          volume: first.volume,
        });
        continue;
      }

      result.push({
        time: first.time,
        open: first.open,
        high: Math.max(first.high, second.high),
        low: Math.min(first.low, second.low),
        close: second.close,
        volume: first.volume + second.volume,
      });
    }
  }

  return result.sort((a, b) =>
    a.time < b.time ? -1 : a.time > b.time ? 1 : 0
  );
}

function buildVwapSeries(
  candles: ChartCandlePoint[],
  timeframe: ChartTimeframe
): ChartLinePoint[] {
  if (candles.length === 0) {
    return [];
  }

  const sorted = sortAndDedupeChartCandles(candles);
  const result: ChartLinePoint[] = [];

  function buildVwapSeries(
  candles: ChartCandlePoint[],
  timeframe: ChartTimeframe
): ChartLinePoint[] {
  if (candles.length === 0) {
    return [];
  }

  const sorted = sortAndDedupeChartCandles(candles);
  const result: ChartLinePoint[] = [];

  if (timeframe === "1D") {
    return [];
  }

  // For intraday charts, reset VWAP every trading day.
  let currentDay = "";
  let cumulativeTpv = 0;
  let cumulativeVolume = 0;

  for (const candle of sorted) {
    const dayKey = getTradingDateKey(candle.time);

    if (dayKey !== currentDay) {
      currentDay = dayKey;
      cumulativeTpv = 0;
      cumulativeVolume = 0;
    }

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTpv += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    if (cumulativeVolume > 0) {
      result.push({
        time: candle.time,
        value: roundTo2(cumulativeTpv / cumulativeVolume),
      });
    }
  }

  return result;
}

  // For intraday charts, reset VWAP every trading day.
  let currentDay = "";
  let cumulativeTpv = 0;
  let cumulativeVolume = 0;

  for (const candle of sorted) {
    const dayKey = getTradingDateKey(candle.time);

    if (dayKey !== currentDay) {
      currentDay = dayKey;
      cumulativeTpv = 0;
      cumulativeVolume = 0;
    }

    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    cumulativeTpv += typicalPrice * candle.volume;
    cumulativeVolume += candle.volume;

    if (cumulativeVolume > 0) {
      result.push({
        time: candle.time,
        value: roundTo2(cumulativeTpv / cumulativeVolume),
      });
    }
  }

  return result;
}
function mapAggregatedCandlesToChartCandles(
  candles: {
    bucketStart: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[]
): ChartCandlePoint[] {
  return sortAndDedupeChartCandles(
    candles.map((candle) => ({
      time: candle.bucketStart,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    }))
  );
}

async function getMergedIntradayChartCandles(
  instrumentKey: string,
  timeframe: "1H" | "2H"
): Promise<ChartCandlePoint[]> {
  const aggregated =
    timeframe === "2H"
      ? await getWsMerged2HCandlesByInstrument(instrumentKey)
      : await getWsMerged1HCandlesByInstrument(instrumentKey);

  return mapAggregatedCandlesToChartCandles(aggregated);
}

function getMergedDailyChartCandles(
  instrumentKey: string
): ChartCandlePoint[] | null {
  const historicalSeries = getCachedHistoricalSeries().find(
    (series) => series.instrumentKey === instrumentKey
  );

  if (!historicalSeries) {
    return null;
  }

  const liveCandle = getCachedLiveCandles().find(
    (candle) => candle.instrumentKey === instrumentKey
  );

  const historicalCandles = buildHistoricalChartCandles(
    historicalSeries.candles
  );

  return mergeLiveCandle(historicalCandles, liveCandle || null);
}

async function getChartCandlesByTimeframe(
  instrumentKey: string,
  timeframe: ChartTimeframe
): Promise<ChartCandlePoint[] | null> {
  if (timeframe === "1D") {
    return getMergedDailyChartCandles(instrumentKey);
  }

  return getMergedIntradayChartCandles(
    instrumentKey,
    timeframe as "1H" | "2H"
  );
}
function getSnapshotBandSignal(
  currentClose: number,
  upperBand: number,
  lowerBand: number
): "ABOVE_UPPER" | "BELOW_LOWER" | "INSIDE_BANDS" {
  if (currentClose > upperBand) {
    return "ABOVE_UPPER";
  }

  if (currentClose < lowerBand) {
    return "BELOW_LOWER";
  }

  return "INSIDE_BANDS";
}

async function resolveStockIdentity(
  symbol: string
): Promise<ResolvedStockIdentity | null> {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!normalizedSymbol) {
    return null;
  }

  const stocks = await getAllStocks();
  const stock = stocks.find(
    (item) => item.symbol.trim().toUpperCase() === normalizedSymbol
  );

  if (!stock) {
    return null;
  }

  return {
    symbol: stock.symbol,
    instrumentKey: stock.instrumentKey,
  };
}

async function build2HConfirmationSnapshot(
  instrumentKey: string
): Promise<StockChartData["bollinger1H"]> {
  const merged1H = await getMergedIntradayChartCandles(instrumentKey, "1H");

  if (merged1H.length < BOLLINGER_PERIOD) {
    return {
      middleBand: null,
      upperBand: null,
      lowerBand: null,
      currentClose: null,
      signal: "UNAVAILABLE",
    };
  }

  const bollinger1H = buildBollinger20Series(merged1H);

  if (bollinger1H.length === 0) {
    return {
      middleBand: null,
      upperBand: null,
      lowerBand: null,
      currentClose: null,
      signal: "UNAVAILABLE",
    };
  }

  const latest1HCandle = merged1H[merged1H.length - 1];
  const latest1HBands = bollinger1H[bollinger1H.length - 1];

  return {
    middleBand: latest1HBands.middleBand,
    upperBand: latest1HBands.upperBand,
    lowerBand: latest1HBands.lowerBand,
    currentClose: latest1HCandle.close,
    signal: getSnapshotBandSignal(
      latest1HCandle.close,
      latest1HBands.upperBand,
      latest1HBands.lowerBand
    ),
  };
}

async function buildStockChartData(
  symbol: string,
  timeframe: ChartTimeframe = "1D"
): Promise<StockChartData | null> {
  const resolvedStock = await resolveStockIdentity(symbol);

  if (!resolvedStock) {
    return null;
  }

  const normalizedSymbol = resolvedStock.symbol.trim().toUpperCase();
  const instrumentKey = resolvedStock.instrumentKey;

   const chartCandles = await getChartCandlesByTimeframe(
    instrumentKey,
    timeframe
  );

  if (!chartCandles || chartCandles.length === 0) {
    return null;
  }

    const candles = sortAndDedupeChartCandles(chartCandles);
  const ema44 = buildEma44Series(candles);
  const bollinger20 = buildBollinger20Series(candles);
  const vwap = buildVwapSeries(candles, timeframe);

  const slantLookback = timeframe === "1D" ? 7 : timeframe === "1H" ? 14 : 7;
  const slantLookback2 =
    timeframe === "1D" ? 14 : timeframe === "1H" ? 28 : 14;

  const ema7dSlant = calculateSlantFromEmaSeries(ema44, slantLookback);
  const ema14dSlant = calculateSlantFromEmaSeries(ema44, slantLookback2);

  const latestClose =
    candles.length > 0 ? candles[candles.length - 1].close : null;

  const intelligence = buildCandleIntelligence({ candles, ema44, bollinger20 });

  const pdf2Setup = buildPdf2Setup({
    candles,
    bollinger: bollinger20,
  });

  const pdf3BollingerEntry = buildPdf3BollingerEntry({
    candles,
    bollinger: bollinger20,
  });

  const support = buildSupportAnalysis({ candles, bollinger20, latestClose });
  const supportClusters = buildSupportClusters({
    candles,
    bollinger20,
    latestClose,
  });

  const resistance = buildResistanceAnalysis({
    candles,
    bollinger20,
    latestClose,
  });

  const resistanceClusters = buildResistanceClusters({
    candles,
    bollinger20,
    latestClose,
  });

  const oscillationSignal = detectOscillationSignal({
    candles,
    latestClose,
    supportClusters,
    resistanceClusters,
  });

   const bollinger1H = await build2HConfirmationSnapshot(instrumentKey);

  const bollingerConfluence = detectBollingerConfluence({
    latestClose,
    bollinger20,
    bollinger1H,
    support,
  });

  const tradePlan = buildTradePlan({
    intelligence,
    support,
    supportClusters,
    resistance,
    resistanceClusters,
    oscillationSignal,
  });

   return {
    symbol: normalizedSymbol,
    instrumentKey,
    timeframe,
    candles,
    ema44,
    bollinger20,
    vwap,
    latestClose,
    ema7dSlant,
    ema14dSlant,
    intelligence,
    pdf2Setup,
    pdf3BollingerEntry,
    support,
    supportClusters,
    resistance,
    resistanceClusters,
    oscillationSignal,
    bollinger1H,
    bollingerConfluence,
    tradePlan,
  } as StockChartData;
}

function buildPosture(
  supportDistance: number | null,
  resistanceDistance: number | null
): StockScannerRow["posture"] {
  const supportNear = supportDistance !== null && supportDistance <= 1.5;
  const resistanceNear =
    resistanceDistance !== null && resistanceDistance <= 1.5;

  if (supportNear && resistanceNear) {
    return "Compressed";
  }

  if (supportNear) {
    return "Near Support";
  }

  if (resistanceNear) {
    return "Near Resistance";
  }

  return "Open Range";
}

export async function getStockChart1D(
  symbol: string
): Promise<StockChartData | null> {
  return buildStockChartData(symbol, "1D");
}

export async function getStockChart1H(
  symbol: string
): Promise<StockChartData | null> {
  return buildStockChartData(symbol, "1H");
}

export async function getStockChart2H(
  symbol: string
): Promise<StockChartData | null> {
  return buildStockChartData(symbol, "2H");
}

export async function buildStockScannerRow(
  symbol: string,
  timeframe: ChartTimeframe = "1D"
): Promise<StockScannerRow | null> {

  const chart = await buildStockChartData(symbol, timeframe);

  if (!chart) {
    return null;
  }

  const support = chart.supportClusters?.[0] ?? chart.support ?? null;
  const resistance =
    chart.resistanceClusters?.[0] ?? chart.resistance ?? null;

  const supportDistance = support?.distancePercent ?? null;
  const resistanceDistance = resistance?.distancePercent ?? null;
  const posture = buildPosture(supportDistance, resistanceDistance);

  const scannerScores = buildScannerScores({
    ema7dSlant: chart.ema7dSlant,
    ema14dSlant: chart.ema14dSlant,
    bias: chart.intelligence.bias,
    pattern: chart.intelligence.pattern,
    bollingerPosition: chart.intelligence.bollingerPosition,
    confirmationStatus: chart.intelligence.confirmationStatus,
    buyZone: chart.intelligence.buyZone,
    supportDistance,
    resistanceDistance,
    nearHighCaution: chart.intelligence.nearHighCaution,
    tradeSignal: chart.intelligence.tradeSignal,
    posture,
    pdf1Signal: chart.intelligence.pdf1Signal,
    recentPriceLocation: chart.intelligence.recentPriceLocation,
    volumeConfirmation: chart.intelligence.volumeConfirmation,
    setupType: chart.pdf2Setup.setupType,
    pdf2Signal: chart.pdf2Setup.pdf2Signal,
    isBigGreenCandle: chart.pdf2Setup.isBigGreenCandle,
    bigGreenValidity: chart.pdf2Setup.bigGreenValidity,
    twoCandleReversal: chart.pdf2Setup.twoCandleReversal,
    isExhaustionRisk: chart.pdf2Setup.isExhaustionRisk,
    recentPullbackToMiddle: chart.pdf2Setup.recentPullbackToMiddle,
    bullishResumeTrigger: chart.pdf2Setup.bullishResumeTrigger,
    nearRelativeLow: chart.pdf2Setup.nearRelativeLow,
    nearRelativeHigh: chart.pdf2Setup.nearRelativeHigh,
    priceMovePercent: chart.pdf2Setup.priceMovePercent,
    entrySignal: chart.pdf3BollingerEntry.entrySignal,
    middleBandHoldConfirmed: chart.pdf3BollingerEntry.middleBandHoldConfirmed,
    middleBandBroken: chart.pdf3BollingerEntry.middleBandBroken,
    isOverextended: chart.pdf3BollingerEntry.isOverextended,
    lowerBandHoldConfirmed: chart.pdf3BollingerEntry.lowerBandHoldConfirmed,
  });

  return {
    symbol: chart.symbol,
    timeframe: chart.timeframe,
    latestClose: chart.latestClose,

    ema7dSlant: chart.ema7dSlant,
    ema14dSlant: chart.ema14dSlant,

    pattern: chart.intelligence.pattern,
    bias: chart.intelligence.bias,
    context: chart.intelligence.context,
    confirmationStatus: chart.intelligence.confirmationStatus,
    recentPriceLocation: chart.intelligence.recentPriceLocation,
    pdf1Signal: chart.intelligence.pdf1Signal,

    bodySize: chart.intelligence.bodySize,
    rangeSize: chart.intelligence.rangeSize,
    upperShadowSize: chart.intelligence.upperShadowSize,
    lowerShadowSize: chart.intelligence.lowerShadowSize,

    bollingerPosition: chart.intelligence.bollingerPosition,
    volumeConfirmation: chart.intelligence.volumeConfirmation,

    tradeSignal: chart.intelligence.tradeSignal,
    buyZone: chart.intelligence.buyZone,
    nearHighCaution: chart.intelligence.nearHighCaution,

    supportDistance,
    resistanceDistance,
    posture,

    action: chart.tradePlan.action,
    actionTone: chart.tradePlan.actionTone,
    headline: chart.tradePlan.headline,
    strengthScore: chart.intelligence.strengthScore,

    trendScore: scannerScores.trendScore,
    entryScore: scannerScores.entryScore,
    pdf1Score: scannerScores.pdf1Score,
    riskScore: scannerScores.riskScore,
    scannerScore: scannerScores.scannerScore,
    entryQuality: scannerScores.entryQuality,
    scannerGrade: scannerScores.scannerGrade,

    isBigGreenCandle: chart.pdf2Setup.isBigGreenCandle,
    priceMovePercent: chart.pdf2Setup.priceMovePercent,
    bodyDominanceRatio: chart.pdf2Setup.bodyDominanceRatio,
    wickCompressionRatio: chart.pdf2Setup.wickCompressionRatio,
    nearRelativeLow: chart.pdf2Setup.nearRelativeLow,
    nearRelativeHigh: chart.pdf2Setup.nearRelativeHigh,
    rangePosition: chart.pdf2Setup.rangePosition,
    bigGreenValidity: chart.pdf2Setup.bigGreenValidity,
    twoCandleReversal: chart.pdf2Setup.twoCandleReversal,
    setupType: chart.pdf2Setup.setupType,
    nowNearMiddleBand: chart.pdf2Setup.nowNearMiddleBand,
    recentlyWasNearUpperBand: chart.pdf2Setup.recentlyWasNearUpperBand,
    recentPullbackToMiddle: chart.pdf2Setup.recentPullbackToMiddle,
    bullishResumeTrigger: chart.pdf2Setup.bullishResumeTrigger,
    isExhaustionRisk: chart.pdf2Setup.isExhaustionRisk,
    pdf2Signal: chart.pdf2Setup.pdf2Signal,
    pdf2Strength: chart.pdf2Setup.strength,

    entrySignal: chart.pdf3BollingerEntry.entrySignal,
    middleBandHoldConfirmed: chart.pdf3BollingerEntry.middleBandHoldConfirmed,
    daysAboveMiddleBand: chart.pdf3BollingerEntry.daysAboveMiddleBand,
    crossoverDetected: chart.pdf3BollingerEntry.crossoverDetected,
    isOverextended: chart.pdf3BollingerEntry.isOverextended,
    appreciationSinceCrossover: chart.pdf3BollingerEntry.appreciationSinceCrossover,
    middleBandSupportHolding: chart.pdf3BollingerEntry.middleBandSupportHolding,
    middleBandBroken: chart.pdf3BollingerEntry.middleBandBroken,
    nextDayBounceConfirmed: chart.pdf3BollingerEntry.nextDayBounceConfirmed,
    lowerBandHoldConfirmed: chart.pdf3BollingerEntry.lowerBandHoldConfirmed,
    daysAboveLowerBand: chart.pdf3BollingerEntry.daysAboveLowerBand,
    stopLossLevel: chart.pdf3BollingerEntry.stopLossLevel,
  };
}


export async function buildStockScannerRow1D(
  symbol: string
): Promise<StockScannerRow | null> {
  const chart = await buildStockChartData(symbol, "1D");

  if (!chart) {
    return null;
  }

  const support = chart.supportClusters?.[0] ?? chart.support ?? null;
  const resistance =
    chart.resistanceClusters?.[0] ?? chart.resistance ?? null;

  const supportDistance = support?.distancePercent ?? null;
  const resistanceDistance = resistance?.distancePercent ?? null;
  const posture = buildPosture(supportDistance, resistanceDistance);

  const scannerScores = buildScannerScores({
    ema7dSlant: chart.ema7dSlant,
    ema14dSlant: chart.ema14dSlant,
    bias: chart.intelligence.bias,
    pattern: chart.intelligence.pattern,
    bollingerPosition: chart.intelligence.bollingerPosition,
    confirmationStatus: chart.intelligence.confirmationStatus,
    buyZone: chart.intelligence.buyZone,
    supportDistance,
    resistanceDistance,
    nearHighCaution: chart.intelligence.nearHighCaution,
    tradeSignal: chart.intelligence.tradeSignal,
    posture,
    pdf1Signal: chart.intelligence.pdf1Signal,
    recentPriceLocation: chart.intelligence.recentPriceLocation,
    volumeConfirmation: chart.intelligence.volumeConfirmation,
    setupType: chart.pdf2Setup.setupType,
    pdf2Signal: chart.pdf2Setup.pdf2Signal,
    isBigGreenCandle: chart.pdf2Setup.isBigGreenCandle,
    bigGreenValidity: chart.pdf2Setup.bigGreenValidity,
    twoCandleReversal: chart.pdf2Setup.twoCandleReversal,
    isExhaustionRisk: chart.pdf2Setup.isExhaustionRisk,
    recentPullbackToMiddle: chart.pdf2Setup.recentPullbackToMiddle,
    bullishResumeTrigger: chart.pdf2Setup.bullishResumeTrigger,
    nearRelativeLow: chart.pdf2Setup.nearRelativeLow,
    nearRelativeHigh: chart.pdf2Setup.nearRelativeHigh,
    priceMovePercent: chart.pdf2Setup.priceMovePercent,

    // Step 5: keep 1D scanner independent from live 1H entry dependency
    entrySignal: "NONE",
    middleBandHoldConfirmed: false,
    middleBandBroken: false,
    isOverextended: false,
    lowerBandHoldConfirmed: false,
  });

  return {
    symbol: chart.symbol,
    timeframe: chart.timeframe,
    latestClose: chart.latestClose,

    ema7dSlant: chart.ema7dSlant,
    ema14dSlant: chart.ema14dSlant,

    pattern: chart.intelligence.pattern,
    bias: chart.intelligence.bias,
    context: chart.intelligence.context,
    confirmationStatus: chart.intelligence.confirmationStatus,
    recentPriceLocation: chart.intelligence.recentPriceLocation,
    pdf1Signal: chart.intelligence.pdf1Signal,

    bodySize: chart.intelligence.bodySize,
    rangeSize: chart.intelligence.rangeSize,
    upperShadowSize: chart.intelligence.upperShadowSize,
    lowerShadowSize: chart.intelligence.lowerShadowSize,

    bollingerPosition: chart.intelligence.bollingerPosition,
    volumeConfirmation: chart.intelligence.volumeConfirmation,

    tradeSignal: chart.intelligence.tradeSignal,
    buyZone: chart.intelligence.buyZone,
    nearHighCaution: chart.intelligence.nearHighCaution,

    supportDistance,
    resistanceDistance,
    posture,

    action: chart.tradePlan.action,
    actionTone: chart.tradePlan.actionTone,
    headline: chart.tradePlan.headline,
    strengthScore: chart.intelligence.strengthScore,

    trendScore: scannerScores.trendScore,
    entryScore: scannerScores.entryScore,
    pdf1Score: scannerScores.pdf1Score,
    riskScore: scannerScores.riskScore,
    scannerScore: scannerScores.scannerScore,
    entryQuality: scannerScores.entryQuality,
    scannerGrade: scannerScores.scannerGrade,

    isBigGreenCandle: chart.pdf2Setup.isBigGreenCandle,
    priceMovePercent: chart.pdf2Setup.priceMovePercent,
    bodyDominanceRatio: chart.pdf2Setup.bodyDominanceRatio,
    wickCompressionRatio: chart.pdf2Setup.wickCompressionRatio,
    nearRelativeLow: chart.pdf2Setup.nearRelativeLow,
    nearRelativeHigh: chart.pdf2Setup.nearRelativeHigh,
    rangePosition: chart.pdf2Setup.rangePosition,
    bigGreenValidity: chart.pdf2Setup.bigGreenValidity,
    twoCandleReversal: chart.pdf2Setup.twoCandleReversal,
    setupType: chart.pdf2Setup.setupType,
    nowNearMiddleBand: chart.pdf2Setup.nowNearMiddleBand,
    recentlyWasNearUpperBand: chart.pdf2Setup.recentlyWasNearUpperBand,
    recentPullbackToMiddle: chart.pdf2Setup.recentPullbackToMiddle,
    bullishResumeTrigger: chart.pdf2Setup.bullishResumeTrigger,
    isExhaustionRisk: chart.pdf2Setup.isExhaustionRisk,
    pdf2Signal: chart.pdf2Setup.pdf2Signal,
    pdf2Strength: chart.pdf2Setup.strength,

    // Neutral placeholders only for 1D scanner cache
    entrySignal: "NONE",
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
  };
}


export async function getStockScanner(
  timeframe: ChartTimeframe = "1D"
): Promise<StockScannerResponse> {
  const rows: StockScannerRow[] = [];
  const stocks = await getAllStocks();

  for (const stock of stocks) {
    const row = await buildStockScannerRow(stock.symbol, timeframe);

    if (row) {
      rows.push(row);
    }
  }

  return { rows };
}

export async function getStockScanner1D(): Promise<StockScannerResponse> {
  return getStockScanner("1D");
}

export async function getStockScanner1H(): Promise<StockScannerResponse> {
  return getStockScanner("1H");
}

export async function getStockScanner2H(): Promise<StockScannerResponse> {
  return getStockScanner("2H");
}
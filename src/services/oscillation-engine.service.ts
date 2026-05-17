import {
  ChartCandlePoint,
  ResistanceCluster,
  SupportCluster,
  ZoneOscillationSignal,
} from "../types/chart.types";

const OSCILLATION_LOOKBACK = 6;
const NARROW_RANGE_RATIO = 0.45;

function getAverageCandleRange(candles: ChartCandlePoint[], lookback = 20): number {
  const window = candles.slice(Math.max(0, candles.length - lookback));

  if (window.length === 0) {
    return 0;
  }

  return (
    window.reduce((sum, candle) => sum + (candle.high - candle.low), 0) /
    window.length
  );
}

function isNarrowRangeCompression(
  recentCandles: ChartCandlePoint[],
  averageRange: number
): boolean {
  if (recentCandles.length === 0 || averageRange <= 0) {
    return false;
  }

  const compressionCount = recentCandles.filter(
    (candle) => candle.high - candle.low <= averageRange * NARROW_RANGE_RATIO
  ).length;

  return compressionCount >= Math.ceil(recentCandles.length * 0.5);
}

function candlesHuggingZone(
  recentCandles: ChartCandlePoint[],
  zoneLow: number,
  zoneHigh: number,
  tolerance: number
): boolean {
  if (recentCandles.length === 0) {
    return false;
  }

  const huggingCount = recentCandles.filter(
    (candle) =>
      candle.low >= zoneLow - tolerance &&
      candle.high <= zoneHigh + tolerance * 2
  ).length;

  return huggingCount >= Math.ceil(recentCandles.length * 0.6);
}

export function detectOscillationSignal(params: {
  candles: ChartCandlePoint[];
  latestClose: number | null;
  supportClusters: SupportCluster[];
  resistanceClusters: ResistanceCluster[];
}): ZoneOscillationSignal {
  const { candles, latestClose, supportClusters, resistanceClusters } = params;

  if (!latestClose || candles.length < OSCILLATION_LOOKBACK + 2) {
    return "NONE";
  }

  const averageRange = getAverageCandleRange(candles, 20);
  const tolerance = Math.max(averageRange * 0.5, latestClose * 0.005);
  const recentCandles = candles.slice(candles.length - OSCILLATION_LOOKBACK);

  const compressionActive = isNarrowRangeCompression(recentCandles, averageRange);

  if (!compressionActive) {
    return "NONE";
  }

  const nearResistance = resistanceClusters.find(
    (cluster) =>
      cluster.zoneLow !== null &&
      cluster.zoneHigh !== null &&
      latestClose >= cluster.zoneLow - tolerance &&
      latestClose <= cluster.zoneHigh + tolerance
  );

  if (nearResistance && nearResistance.zoneLow !== null && nearResistance.zoneHigh !== null) {
    const hugging = candlesHuggingZone(
      recentCandles,
      nearResistance.zoneLow,
      nearResistance.zoneHigh,
      tolerance
    );

    if (hugging) {
      return "BREAKOUT_LIKELY";
    }
  }

  const nearSupport = supportClusters.find(
    (cluster) =>
      cluster.zoneLow !== null &&
      cluster.zoneHigh !== null &&
      latestClose >= cluster.zoneLow - tolerance &&
      latestClose <= cluster.zoneHigh + tolerance
  );

  if (nearSupport && nearSupport.zoneLow !== null && nearSupport.zoneHigh !== null) {
    const hugging = candlesHuggingZone(
      recentCandles,
      nearSupport.zoneLow,
      nearSupport.zoneHigh,
      tolerance
    );

    if (hugging) {
      return "BREAKDOWN_LIKELY";
    }
  }

  return "NONE";
}
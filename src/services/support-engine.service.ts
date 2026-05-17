import {
  ChartBollingerPoint,
  ChartCandlePoint,
  SupportAnalysis,
  SupportCluster,
  SupportSource,
  ZoneStrength,
} from "../types/chart.types";

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function getRecentWindow(
  candles: ChartCandlePoint[],
  size: number
): ChartCandlePoint[] {
  return candles.slice(Math.max(0, candles.length - size));
}

function getLatestBollingerPoint(
  bollinger20: ChartBollingerPoint[]
): ChartBollingerPoint | null {
  return bollinger20[bollinger20.length - 1] || null;
}

function getAverageCandleRange(
  candles: ChartCandlePoint[],
  lookback = 20
): number {
  const window = getRecentWindow(candles, lookback);

  if (window.length === 0) {
    return 0;
  }

  return (
    window.reduce((sum, candle) => sum + (candle.high - candle.low), 0) /
    window.length
  );
}

function isLocalSwingLow(
  candles: ChartCandlePoint[],
  index: number,
  left = 2,
  right = 2
): boolean {
  const current = candles[index];

  if (!current) {
    return false;
  }

  for (let offset = 1; offset <= left; offset += 1) {
    const previous = candles[index - offset];
    if (previous && previous.low <= current.low) {
      return false;
    }
  }

  for (let offset = 1; offset <= right; offset += 1) {
    const next = candles[index + offset];
    if (next && next.low <= current.low) {
      return false;
    }
  }

  return true;
}

function isBollingerBandDeclining(
  bollinger20: ChartBollingerPoint[],
  band: "upperBand" | "middleBand" | "lowerBand",
  lookback = 4
): boolean {
  if (bollinger20.length < lookback + 1) {
    return false;
  }

  const recent = bollinger20.slice(bollinger20.length - (lookback + 1));
  let declineCount = 0;

  for (let i = 1; i < recent.length; i += 1) {
    if (recent[i][band] < recent[i - 1][band]) {
      declineCount += 1;
    }
  }

  return declineCount >= Math.ceil(lookback * 0.6);
}

function wasLowSubsequentlyBroken(
  candles: ChartCandlePoint[],
  index: number
): boolean {
  const candidate = candles[index];
  if (!candidate) {
    return false;
  }

  const futureWindow = candles.slice(
    index + 1,
    Math.min(candles.length, index + 31)
  );

  return futureWindow.some((candle) => candle.close < candidate.low * 0.995);
}

function collectPreviousLowSupports(
  candles: ChartCandlePoint[],
  currentPrice: number
): number[] {
  const startIndex = Math.max(2, candles.length - 180);
  const endIndex = candles.length - 3;
  const levels: number[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    if (!isLocalSwingLow(candles, index)) {
      continue;
    }

    if (wasLowSubsequentlyBroken(candles, index)) {
      continue;
    }

    const level = candles[index].low;
    if (level < currentPrice) {
      levels.push(level);
    }
  }

  return levels;
}

function collectBrokenHighFlipSupports(
  candles: ChartCandlePoint[],
  currentPrice: number
): number[] {
  const startIndex = Math.max(2, candles.length - 220);
  const endIndex = candles.length - 10;
  const levels: number[] = [];

  for (let index = startIndex; index <= endIndex; index += 1) {
    const candidate = candles[index];
    if (!candidate) {
      continue;
    }

    const futureWindow = candles.slice(
      index + 1,
      Math.min(candles.length, index + 31)
    );

    if (futureWindow.length === 0) {
      continue;
    }

    const breakoutHappened = futureWindow.some(
      (candle) => candle.close > candidate.high * 1.005
    );

    if (!breakoutHappened) {
      continue;
    }

    const level = candidate.high;
    if (level < currentPrice) {
      levels.push(level);
    }
  }

  return levels;
}

function collectFallbackHistoricalSupports(
  candles: ChartCandlePoint[],
  currentPrice: number
): number[] {
  const levels = candles
    .map((candle) => candle.low)
    .filter((low) => Number.isFinite(low) && low <= currentPrice);

  if (levels.length === 0) {
    return [];
  }

  const deduped = Array.from(new Set(levels.map((value) => roundTo2(value))));
  return deduped.sort((a, b) => b - a);
}

function getBollingerSupportLevel(
  currentPrice: number,
  latestBollinger: ChartBollingerPoint | null,
  bollinger20: ChartBollingerPoint[]
): { level: number | null; source: SupportSource | null } {
  if (!latestBollinger) {
    return { level: null, source: null };
  }

  if (
    currentPrice >= latestBollinger.middleBand &&
    currentPrice <= latestBollinger.upperBand
  ) {
    if (isBollingerBandDeclining(bollinger20, "middleBand")) {
      return { level: null, source: null };
    }
    return { level: latestBollinger.middleBand, source: "BOLL_MIDDLE" };
  }

  if (
    currentPrice >= latestBollinger.lowerBand &&
    currentPrice < latestBollinger.middleBand
  ) {
    if (isBollingerBandDeclining(bollinger20, "lowerBand")) {
      return { level: null, source: null };
    }
    return { level: latestBollinger.lowerBand, source: "BOLL_LOWER" };
  }

  if (currentPrice < latestBollinger.lowerBand) {
    if (isBollingerBandDeclining(bollinger20, "lowerBand")) {
      return { level: null, source: null };
    }
    return { level: latestBollinger.lowerBand, source: "BOLL_LOWER" };
  }

  return { level: null, source: null };
}

function clusterNearbyLevels(levels: number[], tolerance: number): number[][] {
  if (levels.length === 0) {
    return [];
  }

  const sorted = [...levels].sort((a, b) => a - b);
  const clusters: number[][] = [];
  let bucket: number[] = [sorted[0]];

  for (let index = 1; index < sorted.length; index += 1) {
    const level = sorted[index];
    const previous = bucket[bucket.length - 1];

    if (Math.abs(level - previous) <= tolerance) {
      bucket.push(level);
      continue;
    }

    clusters.push(bucket);
    bucket = [level];
  }

  if (bucket.length > 0) {
    clusters.push(bucket);
  }

  return clusters;
}

function resolveStrength(sourceCount: number): ZoneStrength {
  if (sourceCount >= 3) {
    return "HIGH";
  }

  if (sourceCount === 2) {
    return "MEDIUM";
  }

  return "LOW";
}

function createClusterZone(params: {
  levels: number[];
  sources: SupportSource[];
  latestClose: number;
  zonePadding: number;
}): SupportCluster {
  const { levels, sources, latestClose, zonePadding } = params;

  const zoneLow = roundTo2(Math.min(...levels) - zonePadding);
  const zoneHigh = roundTo2(Math.max(...levels) + zonePadding);

  // distance from actual support base, not top of support zone
  const distancePercent = roundTo2(
    ((latestClose - zoneLow) / zoneLow) * 100
  );

  const inZone = latestClose >= zoneLow && latestClose <= zoneHigh;

  return {
    zoneLow,
    zoneHigh,
    strength: resolveStrength(sources.length),
    sources,
    distancePercent: distancePercent < 0 ? 0 : distancePercent,
    inZone,
  };
}

function dedupeSources(sources: SupportSource[]): SupportSource[] {
  return Array.from(new Set(sources));
}

export function buildSupportClusters(params: {
  candles: ChartCandlePoint[];
  bollinger20: ChartBollingerPoint[];
  latestClose: number | null;
}): SupportCluster[] {
  const { candles, bollinger20, latestClose } = params;

  if (!latestClose || candles.length === 0) {
    return [];
  }

  const averageRange = Math.max(
    getAverageCandleRange(candles, 20),
    latestClose * 0.005
  );
  const zonePadding = Math.max(averageRange * 0.35, latestClose * 0.004);
  const clusteringTolerance = Math.max(
    averageRange * 0.6,
    latestClose * 0.006
  );

  const previousLowLevels = collectPreviousLowSupports(
    candles,
    latestClose
  ).map((level) => ({
    level,
    source: "PREVIOUS_LOW" as SupportSource,
  }));

  const brokenHighLevels = collectBrokenHighFlipSupports(
    candles,
    latestClose
  ).map((level) => ({
    level,
    source: "PREVIOUS_HIGH_FLIP" as SupportSource,
  }));

  const latestBollinger = getLatestBollingerPoint(bollinger20);
  const bollingerSupport = getBollingerSupportLevel(
    latestClose,
    latestBollinger,
    bollinger20
  );

  const structuralCandidates = [...previousLowLevels, ...brokenHighLevels];

  const structuralClusters = clusterNearbyLevels(
    structuralCandidates.map((item) => item.level),
    clusteringTolerance
  );

  let clusters: SupportCluster[] = structuralClusters.map((clusterLevels) => {
    const matchedCandidates = structuralCandidates.filter((candidate) =>
      clusterLevels.some(
        (level) => Math.abs(level - candidate.level) <= clusteringTolerance
      )
    );

    return createClusterZone({
      levels: clusterLevels,
      sources: dedupeSources(matchedCandidates.map((item) => item.source)),
      latestClose,
      zonePadding,
    });
  });

  if (bollingerSupport.level !== null && bollingerSupport.source) {
    const overlappingCluster = clusters.find((cluster) => {
      if (cluster.zoneLow === null || cluster.zoneHigh === null) {
        return false;
      }

      return (
        bollingerSupport.level !== null &&
        bollingerSupport.level >= cluster.zoneLow - clusteringTolerance &&
        bollingerSupport.level <= cluster.zoneHigh + clusteringTolerance
      );
    });

    if (overlappingCluster) {
      const currentZoneLow = overlappingCluster.zoneLow ?? bollingerSupport.level;
      const currentZoneHigh = overlappingCluster.zoneHigh ?? bollingerSupport.level;

      overlappingCluster.zoneLow = roundTo2(
        Math.min(currentZoneLow, bollingerSupport.level - zonePadding)
      );

      overlappingCluster.zoneHigh = roundTo2(
        Math.max(currentZoneHigh, bollingerSupport.level + zonePadding)
      );

      overlappingCluster.sources = dedupeSources([
        ...overlappingCluster.sources,
        bollingerSupport.source,
      ]);

      overlappingCluster.strength = resolveStrength(
        overlappingCluster.sources.length
      );

      const safeZoneLow = overlappingCluster.zoneLow ?? bollingerSupport.level;

      const distancePercent = roundTo2(
        ((latestClose - safeZoneLow) / safeZoneLow) * 100
      );

      overlappingCluster.distancePercent = distancePercent < 0 ? 0 : distancePercent;

      const safeZoneHigh = overlappingCluster.zoneHigh ?? bollingerSupport.level;

      overlappingCluster.inZone =
        latestClose >= safeZoneLow &&
        latestClose <= safeZoneHigh;
    } else {
      clusters.push(
        createClusterZone({
          levels: [bollingerSupport.level],
          sources: [bollingerSupport.source],
          latestClose,
          zonePadding,
        })
      );
    }
  }

  if (clusters.length === 0) {
    const fallbackLevels = collectFallbackHistoricalSupports(candles, latestClose);

    if (fallbackLevels.length > 0) {
      const nearestFallbackLevel = fallbackLevels[0];

      clusters.push(
        createClusterZone({
          levels: [nearestFallbackLevel],
          sources: ["PREVIOUS_LOW"],
          latestClose,
          zonePadding,
        })
      );
    }
  }

  const filteredClusters = clusters
    .filter(
      (cluster) => cluster.zoneLow !== null && cluster.zoneLow <= latestClose * 1.01
    )
    .sort((a, b) => (b.zoneHigh ?? 0) - (a.zoneHigh ?? 0));

  if (filteredClusters.length > 0) {
    return filteredClusters;
  }

  const fallbackLevels = collectFallbackHistoricalSupports(candles, latestClose);

  if (fallbackLevels.length > 0) {
    const nearestFallbackLevel = fallbackLevels[0];

    return [
      createClusterZone({
        levels: [nearestFallbackLevel],
        sources: ["PREVIOUS_LOW"],
        latestClose,
        zonePadding,
      }),
    ];
  }

  return [];
}

export function buildSupportAnalysis(params: {
  candles: ChartCandlePoint[];
  bollinger20: ChartBollingerPoint[];
  latestClose: number | null;
}): SupportAnalysis {
  const clusters = buildSupportClusters(params);

  if (clusters.length === 0) {
    return {
      zoneLow: null,
      zoneHigh: null,
      strength: "LOW",
      sources: [],
      distancePercent: null,
      inZone: false,
    };
  }

  return clusters[0];
}
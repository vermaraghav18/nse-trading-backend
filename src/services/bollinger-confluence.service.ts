import {
  Bollinger1HSnapshot,
  BollingerConfluence,
  ChartBollingerPoint,
  SupportAnalysis,
} from "../types/chart.types";
import { getLatestBollinger1H } from "./bollinger-1h.service";

function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

export function getBollinger1HSnapshot(
  instrumentKey: string
): Bollinger1HSnapshot {
  const results = getLatestBollinger1H();
  const match = results.find((r) => r.symbol === instrumentKey || r.id === instrumentKey);

  if (!match) {
    return {
      middleBand: null,
      upperBand: null,
      lowerBand: null,
      currentClose: null,
      signal: "UNAVAILABLE",
    };
  }

  return {
    middleBand: match.middleBand,
    upperBand: match.upperBand,
    lowerBand: match.lowerBand,
    currentClose: match.currentClose,
    signal: match.signal,
  };
}

export function getBollinger1HSnapshotBySymbol(
  symbol: string
): Bollinger1HSnapshot {
  const results = getLatestBollinger1H();
  const match = results.find(
    (r) => r.symbol.toUpperCase() === symbol.toUpperCase()
  );

  if (!match) {
    return {
      middleBand: null,
      upperBand: null,
      lowerBand: null,
      currentClose: null,
      signal: "UNAVAILABLE",
    };
  }

  return {
    middleBand: match.middleBand,
    upperBand: match.upperBand,
    lowerBand: match.lowerBand,
    currentClose: match.currentClose,
    signal: match.signal,
  };
}

function getDailyBollingerSupportLevel(
  latestClose: number,
  bollinger20: ChartBollingerPoint[]
): number | null {
  if (bollinger20.length === 0) return null;

  const latest = bollinger20[bollinger20.length - 1];
  const bandWidth = latest.upperBand - latest.lowerBand;

  // Price near lower band = lower band is the daily support
  if (Math.abs(latestClose - latest.lowerBand) <= bandWidth * 0.15) {
    return roundTo2(latest.lowerBand);
  }

  // Price between middle and upper = middle band is the daily support
  if (latestClose >= latest.middleBand && latestClose <= latest.upperBand) {
    return roundTo2(latest.middleBand);
  }

  // Price between lower and middle = lower band is the daily support
  if (latestClose >= latest.lowerBand && latestClose < latest.middleBand) {
    return roundTo2(latest.lowerBand);
  }

  return roundTo2(latest.middleBand);
}

function get2HConfirmationBollingerSupportLevel(
  snapshot: Bollinger1HSnapshot
): number | null {
  if (
    snapshot.signal === "UNAVAILABLE" ||
    snapshot.lowerBand === null ||
    snapshot.middleBand === null ||
    snapshot.currentClose === null
  ) {
    return null;
  }

  // Price near lower band on 1H = lower band is 1H support
  const bandWidth = (snapshot.upperBand ?? 0) - snapshot.lowerBand;
  if (
    snapshot.signal === "BELOW_LOWER" ||
    Math.abs(snapshot.currentClose - snapshot.lowerBand) <= bandWidth * 0.12
  ) {
    return roundTo2(snapshot.lowerBand);
  }

  // Price between middle and upper on 1H = middle band is 1H support
  if (
    snapshot.currentClose >= snapshot.middleBand &&
    snapshot.currentClose <= (snapshot.upperBand ?? Infinity)
  ) {
    return roundTo2(snapshot.middleBand);
  }

  // Price between lower and middle = lower band is 1H support
  if (
    snapshot.currentClose >= snapshot.lowerBand &&
    snapshot.currentClose < snapshot.middleBand
  ) {
    return roundTo2(snapshot.lowerBand);
  }

  return roundTo2(snapshot.middleBand);
}

// Chapter 5 Part 2: Detect if daily BOLL support and 2H confirmation BOLL support
// are in confluence (within 1.5% of each other).
// When they converge on the same zone → high-confidence entry per PDF.
export function detectBollingerConfluence(params: {
  latestClose: number | null;
  bollinger20: ChartBollingerPoint[];
  bollinger1H: Bollinger1HSnapshot;
  support: SupportAnalysis;
}): BollingerConfluence {
  const { latestClose, bollinger20, bollinger1H, support } = params;

  const noData: BollingerConfluence = {
    detected: false,
    dailyLevel: null,
    hourlyLevel: null,
    confluenceZoneLow: null,
    confluenceZoneHigh: null,
    distancePercent: null,
    description: "Insufficient data to compute Bollinger confluence.",
  };

  if (!latestClose || bollinger20.length === 0) return noData;
    if (bollinger1H.signal === "UNAVAILABLE") {
    return {
      ...noData,
      description:
        "2H confirmation Bollinger data not available. Daily analysis only. Check back during market hours.",
    };
  }

  const dailyLevel = getDailyBollingerSupportLevel(latestClose, bollinger20);
const hourlyLevel = get2HConfirmationBollingerSupportLevel(bollinger1H);    

  if (dailyLevel === null || hourlyLevel === null) return noData;

  const distancePercent = roundTo2(
    (Math.abs(dailyLevel - hourlyLevel) / dailyLevel) * 100
  );

   // Confluence threshold: daily and 2H confirmation support within 1.5% of each other
  const confluenceDetected = distancePercent <= 1.5;

  const zoneLow = roundTo2(Math.min(dailyLevel, hourlyLevel) * 0.998);
  const zoneHigh = roundTo2(Math.max(dailyLevel, hourlyLevel) * 1.002);

  const priceDistanceToZone =
    latestClose > zoneHigh
      ? roundTo2(((latestClose - zoneHigh) / latestClose) * 100)
      : 0;

  if (confluenceDetected) {
    return {
      detected: true,
      dailyLevel,
      hourlyLevel,
      confluenceZoneLow: zoneLow,
      confluenceZoneHigh: zoneHigh,
      distancePercent: priceDistanceToZone,
           description: `Daily BOLL support at ₹${dailyLevel} and 2H confirmation BOLL support at ₹${hourlyLevel} are confluent (${distancePercent}% apart). This is a high-confidence entry zone per Chapter 5. Price needs to reach ₹${zoneHigh}–₹${zoneLow} for the entry signal.`,
    };
  }

  return {
    detected: false,
    dailyLevel,
    hourlyLevel,
    confluenceZoneLow: null,
    confluenceZoneHigh: null,
    distancePercent: distancePercent,
        description: `Daily BOLL support is at ₹${dailyLevel}. 2H confirmation BOLL support is at ₹${hourlyLevel}. These are ${distancePercent}% apart — no confluence yet. Wait for the 2H level to align closer to the daily level before entering.`,
  };
}
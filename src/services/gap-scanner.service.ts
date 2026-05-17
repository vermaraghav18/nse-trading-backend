import { getCachedHistoricalSeries } from "./market-history-cache.service";
import { getCachedLiveCandles } from "./live-market-cache.service";
import { STOCK_SECTOR_MAP } from "../integrations/upstox/sector-map";

export type GapDirection = "GAP_UP" | "GAP_DOWN" | "FLAT";

export type GapScenario =
  | "SCENARIO_1_CONTINUOUS_RISE"   // Gap up, price continues rising — buy next day lower
  | "SCENARIO_2_LOW_VOLATILITY"    // Gap up, low volatility consolidation — buy in range
  | "SCENARIO_3_PULLBACK_TO_GAP"   // Gap up, pulled back to gap boundary — buy on dip
  | "GAP_DOWN_STRONG"              // Gap down, strong selling — avoid / short watch
  | "GAP_DOWN_RECOVERING"          // Gap down but price recovering above prev close — shakeout
  | "NONE";

export type GapSupportStatus =
  | "HOLDING_ABOVE_GAP"    // Price still above gap's upper boundary — bullish
  | "AT_GAP_BOUNDARY"      // Price at upper/lower boundary — entry zone
  | "BELOW_GAP_SUPPORT"    // Price fell below gap bottom — INVALIDATED
  | "N/A";

export type GapScanRow = {
  symbol: string;
  sector: string;
  livePrice: number;
  prevClose: number;
  gapPct: number;              // (open - prevClose) / prevClose * 100
  direction: GapDirection;
  scenario: GapScenario;
  supportStatus: GapSupportStatus;
  gapUpperBoundary: number;    // today's open
  gapLowerBoundary: number;    // prev close
  volumeSurgeRatio: number;    // today vol / avg 20d vol
  entryZone: string;           // plain English entry instruction
  stopLoss: number | null;     // below gap lower boundary
  isValid: boolean;            // false if price broke below gap support
  updatedAt: string;
};

const MIN_GAP_PCT = 0.5; // minimum gap % to consider a valid gap
const GAP_BOUNDARY_TOLERANCE_PCT = 0.3; // within 0.3% of boundary = "at boundary"

function classifyScenario(
  gapPct: number,
  direction: GapDirection,
  livePrice: number,
  todayOpen: number,
  prevClose: number,
  todayHigh: number,
  todayLow: number,
  bbWidthPct: number | null
): GapScenario {
  if (direction === "FLAT") return "NONE";

  if (direction === "GAP_UP") {
    // Price is below gap support — invalidated
    if (livePrice < prevClose * 0.997) return "NONE";

    // Scenario 3: Price pulled back toward gap boundary but holding
    const distFromLower = ((livePrice - prevClose) / prevClose) * 100;
    if (distFromLower < 1.0 && livePrice >= prevClose * 0.997) {
      return "SCENARIO_3_PULLBACK_TO_GAP";
    }

    // Scenario 2: Low volatility (tight range today)
    const rangePct = todayHigh > 0 ? ((todayHigh - todayLow) / todayOpen) * 100 : 999;
    if (rangePct < 1.5 && bbWidthPct !== null && bbWidthPct < 6) {
      return "SCENARIO_2_LOW_VOLATILITY";
    }

    // Scenario 1: Continuing to rise
    return "SCENARIO_1_CONTINUOUS_RISE";
  }

  if (direction === "GAP_DOWN") {
    // Recovering — price has come back close to prev close
    if (livePrice >= prevClose * 0.997) return "GAP_DOWN_RECOVERING";
    return "GAP_DOWN_STRONG";
  }

  return "NONE";
}

function getSupportStatus(
  livePrice: number,
  gapUpper: number,
  gapLower: number,
  todayHigh: number,
  todayLow: number
): GapSupportStatus {
  // Hard invalidation: price is below gap lower boundary
  if (livePrice < gapLower * 0.997) return "BELOW_GAP_SUPPORT";

  // Gap-fill detection:
  // If today's candle range covers 80%+ of the gap size AND price fell
  // 70%+ back from today's high toward the gap lower boundary,
  // the gap was fully filled intraday — treat as failed regardless of
  // where price closed. Example: PERSISTENT gapped +6.63% but crashed
  // -6.28% intraday back to the gap bottom. That is NOT a valid S3 setup.
  const gapSize = gapUpper - gapLower;
  const candleRange = todayHigh - todayLow;
  const priceFellFromHigh = todayHigh - livePrice;

  if (
    gapSize > 0 &&
    candleRange > gapSize * 0.8 &&       // candle range covers 80%+ of the gap
    priceFellFromHigh > gapSize * 0.7    // price fell 70%+ back from today's high
  ) {
    return "BELOW_GAP_SUPPORT";          // failed gap — fully filled intraday
  }

  const toleranceUpper = gapUpper * (GAP_BOUNDARY_TOLERANCE_PCT / 100);
  const toleranceLower = gapLower * (GAP_BOUNDARY_TOLERANCE_PCT / 100);

  if (
    Math.abs(livePrice - gapUpper) <= toleranceUpper ||
    Math.abs(livePrice - gapLower) <= toleranceLower
  ) {
    return "AT_GAP_BOUNDARY";
  }

  if (livePrice > gapLower) return "HOLDING_ABOVE_GAP";

  return "N/A";
}

function getEntryZone(scenario: GapScenario, supportStatus: GapSupportStatus, gapLower: number, gapUpper: number): string {
  switch (scenario) {
    case "SCENARIO_1_CONTINUOUS_RISE":
      return "Buy tomorrow at a lower price — gap is holding strong";
    case "SCENARIO_2_LOW_VOLATILITY":
      return `Buy now in low-vol range ₹${gapLower.toFixed(2)}–₹${gapUpper.toFixed(2)}, wait for breakout`;
    case "SCENARIO_3_PULLBACK_TO_GAP":
      if (supportStatus === "AT_GAP_BOUNDARY") return `Entry zone now — price at gap boundary ₹${gapLower.toFixed(2)}`;
      if (supportStatus === "HOLDING_ABOVE_GAP") return `Wait for pullback to ₹${gapLower.toFixed(2)}–₹${gapUpper.toFixed(2)} zone`;
      return "Gap support broken — avoid";
    case "GAP_DOWN_STRONG":
      return "Gap down — avoid longs, watch for short setup";
    case "GAP_DOWN_RECOVERING":
      return "Gap down but recovering — possible shakeout, watch closely";
    default:
      return "No valid gap setup";
  }
}

export async function getGapScanRows(): Promise<GapScanRow[]> {
  const [historicalSeries, liveCandles] = await Promise.all([
    Promise.resolve(getCachedHistoricalSeries()),
    Promise.resolve(getCachedLiveCandles()),
  ]);

  const liveCandleMap = new Map(liveCandles.map((c) => [c.symbol, c]));

  const rows: GapScanRow[] = [];

  for (const series of historicalSeries) {
    try {
      // Need at least 22 candles for volume average
      if (!series.candles || series.candles.length < 22) continue;

      const live = liveCandleMap.get(series.symbol);
      if (!live) continue;

      // Historical sorted ascending (index 0 = oldest)
      // series.candles[0] = most recent historical (yesterday)
      const prevCandle = series.candles[0];
      if (!prevCandle) continue;

      const prevClose: number = prevCandle[4]; // index 4 = close
      const todayOpen: number = live.open;
      const todayHigh: number = live.high;
      const todayLow: number = live.low;
      const livePrice: number = live.close;
      const todayVolume: number = live.volume;

      if (!prevClose || prevClose <= 0) continue;

      // Gap %
      const gapPct = ((todayOpen - prevClose) / prevClose) * 100;
      const roundedGapPct = Number(gapPct.toFixed(2));

      // Filter: only gaps >= MIN_GAP_PCT
      if (Math.abs(roundedGapPct) < MIN_GAP_PCT) continue;

      const direction: GapDirection =
        roundedGapPct >= MIN_GAP_PCT
          ? "GAP_UP"
          : roundedGapPct <= -MIN_GAP_PCT
          ? "GAP_DOWN"
          : "FLAT";

      // Volume surge: today vol vs avg of last 20 historical candles
      const last20 = series.candles.slice(1, 21); // skip index 0 (yesterday), take 20 before
      const avgVol =
        last20.length > 0
          ? last20.reduce((sum, c) => sum + (c[5] as number), 0) / last20.length
          : 0;
      const volumeSurgeRatio =
        avgVol > 0 ? Number((todayVolume / avgVol).toFixed(2)) : 0;

      // BB width (rough estimate from recent candles — optional, pass null if unavailable)
      const bbWidthPct: number | null = null;

      const scenario = classifyScenario(
        roundedGapPct,
        direction,
        livePrice,
        todayOpen,
        prevClose,
        todayHigh,
        todayLow,
        bbWidthPct
      );

      if (scenario === "NONE") continue;

      const gapUpperBoundary = todayOpen;
      const gapLowerBoundary = prevClose;

      // Pass todayHigh and todayLow so gap-fill detection works correctly
      const supportStatus = getSupportStatus(
        livePrice,
        gapUpperBoundary,
        gapLowerBoundary,
        todayHigh,
        todayLow
      );

      const isValid = supportStatus !== "BELOW_GAP_SUPPORT";

      const entryZone = getEntryZone(scenario, supportStatus, gapLowerBoundary, gapUpperBoundary);

      const stopLoss =
        direction === "GAP_UP"
          ? Number((gapLowerBoundary * 0.995).toFixed(2))
          : direction === "GAP_DOWN"
          ? Number((todayHigh * 1.005).toFixed(2))
          : null;

      const sector =
        (STOCK_SECTOR_MAP as Record<string, string>)[series.symbol] ?? "Other";

      rows.push({
        symbol: series.symbol,
        sector,
        livePrice: Number(livePrice.toFixed(2)),
        prevClose: Number(prevClose.toFixed(2)),
        gapPct: roundedGapPct,
        direction,
        scenario,
        supportStatus,
        gapUpperBoundary: Number(gapUpperBoundary.toFixed(2)),
        gapLowerBoundary: Number(gapLowerBoundary.toFixed(2)),
        volumeSurgeRatio,
        entryZone,
        stopLoss,
        isValid,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // skip bad data
    }
  }

  // Sort: valid rows first, then by gapPct descending within each direction
  rows.sort((a, b) => {
    // Valid setups always above invalid ones
    if (a.isValid !== b.isValid) return a.isValid ? -1 : 1;
    // GAP_UP before GAP_DOWN
    if (a.direction !== b.direction) return a.direction === "GAP_UP" ? -1 : 1;
    // Larger gap % first
    return Math.abs(b.gapPct) - Math.abs(a.gapPct);
  });

  return rows;
}
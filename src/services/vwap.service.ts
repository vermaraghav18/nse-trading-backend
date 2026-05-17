import { getCachedHistoricalSeries } from "./market-history-cache.service";
import { getCachedLiveCandles } from "./live-market-cache.service";

export interface VwapResult {
  id: string;
  symbol: string;
  instrumentKey: string;
  currentPrice: number;
  vwap: number;
  priceVsVwap: "ABOVE" | "BELOW" | "AT";
  deviation: number; // Percentage deviation from VWAP
  volume: number;
  date: string;
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 * VWAP = Σ(Price × Volume) / Σ(Volume)
 * 
 * For intraday: Uses typical price (H+L+C)/3
 * We calculate it using historical daily candles
 */
function calculateVwap(
  candles: [string, number, number, number, number, number, number][]
): number {
  if (candles.length === 0) return 0;

  let sumPriceVolume = 0;
  let sumVolume = 0;

  // Process candles (format: [date, open, high, low, close, volume, oi])
  for (const candle of candles) {
    const high = candle[2];
    const low = candle[3];
    const close = candle[4];
    const volume = candle[5];

    // Typical price = (H + L + C) / 3
    const typicalPrice = (high + low + close) / 3;

    sumPriceVolume += typicalPrice * volume;
    sumVolume += volume;
  }

  if (sumVolume === 0) return 0;

  return sumPriceVolume / sumVolume;
}

/**
 * Get latest VWAP for all stocks
 */
export function getLatestVwap(): VwapResult[] {
  const historicalSeries = getCachedHistoricalSeries();
  const liveCandles = getCachedLiveCandles();

  if (historicalSeries.length === 0) {
    console.log("[vwap-service] Historical series cache is empty");
    return [];
  }

  // Create map of live candles for quick lookup
  const liveCandleMap = new Map(
    liveCandles.map((c) => [c.instrumentKey, c])
  );

  return historicalSeries
    .map((series) => {
      const liveCandle = liveCandleMap.get(series.instrumentKey);
      
      if (!liveCandle) {
        return null;
      }

      // Use last 20 days for VWAP calculation
      const recentCandles = series.candles.slice(-20);
      const vwap = calculateVwap(recentCandles);

      if (vwap === 0) {
        return null;
      }

      const currentPrice = liveCandle.close;
      const deviation = ((currentPrice - vwap) / vwap) * 100;

      let priceVsVwap: "ABOVE" | "BELOW" | "AT" = "AT";
      if (currentPrice > vwap * 1.001) {
        priceVsVwap = "ABOVE";
      } else if (currentPrice < vwap * 0.999) {
        priceVsVwap = "BELOW";
      }

      return {
        id: series.id,
        symbol: series.symbol,
        instrumentKey: series.instrumentKey,
        currentPrice: Number(currentPrice.toFixed(2)),
        vwap: Number(vwap.toFixed(2)),
        priceVsVwap,
        deviation: Number(deviation.toFixed(2)),
        volume: liveCandle.volume,
        date: liveCandle.date,
      };
    })
    .filter((item): item is VwapResult => Boolean(item));
}

/**
 * Get VWAP statistics
 */
export function getVwapStats() {
  const vwaps = getLatestVwap();
  
  const totalStocks = vwaps.length;
  const aboveVwap = vwaps.filter(v => v.priceVsVwap === "ABOVE").length;
  const belowVwap = vwaps.filter(v => v.priceVsVwap === "BELOW").length;
  const atVwap = vwaps.filter(v => v.priceVsVwap === "AT").length;

  return {
    totalStocks,
    aboveVwap,
    belowVwap,
    atVwap,
    percentageAbove: totalStocks > 0 ? (aboveVwap / totalStocks) * 100 : 0,
  };
}
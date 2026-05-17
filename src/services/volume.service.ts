import { getCachedLiveCandles } from "./live-market-cache.service";

export interface VolumeResult {
  id: string;
  symbol: string;
  instrumentKey: string;
  volume: number;
  date: string;
  hasVolume: boolean;
}

/**
 * Get latest volume data for all stocks
 * This reads from the live market cache which already fetches volume
 */
export function getLatestVolume(): VolumeResult[] {
  const candles = getCachedLiveCandles();

  if (candles.length === 0) {
    console.log("[volume-service] No candles in cache");
    return [];
  }

  return candles.map((candle) => ({
    id: candle.id,
    symbol: candle.symbol,
    instrumentKey: candle.instrumentKey,
    volume: candle.volume,
    date: candle.date,
    hasVolume: candle.volume > 0,
  }));
}

/**
 * Get volume statistics
 */
export function getVolumeStats() {
  const volumes = getLatestVolume();
  
  const totalStocks = volumes.length;
  const stocksWithVolume = volumes.filter(v => v.hasVolume).length;
  const stocksWithoutVolume = totalStocks - stocksWithVolume;

  return {
    totalStocks,
    stocksWithVolume,
    stocksWithoutVolume,
    percentageWithVolume: totalStocks > 0 ? (stocksWithVolume / totalStocks) * 100 : 0,
  };
}
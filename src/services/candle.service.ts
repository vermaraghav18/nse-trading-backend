import { Candle } from "../types/candle.types";
import { getCachedLiveCandles, refreshLiveCandlesCache } from "./live-market-cache.service";

/**
 * Returns cached live candles.
 * If cache is empty on first hit, does one on-demand refresh.
 */
export async function getAllCandles(): Promise<Candle[]> {
  let candles = getCachedLiveCandles();

  if (candles.length === 0) {
    await refreshLiveCandlesCache();
    candles = getCachedLiveCandles();
  }

  return candles;
}
/**
 * Maps Zerodha candle data to internal format
 */

import { ZerodhaHistoricalData } from "./zerodha.types";

/**
 * Convert Zerodha candles to internal format
 * Zerodha format: [date, open, high, low, close, volume, oi]
 * Internal format: same as Upstox for compatibility
 */
export function mapZerodhaCandlesToInternal(
  zerodhaData: ZerodhaHistoricalData,
  instrumentKey: string,
  symbol: string
) {
  const candles = zerodhaData.data?.candles || [];

  return {
    status: "success",
    data: {
      candles: candles.map((candle: any) => [
        candle[0], // date
        candle[1], // open
        candle[2], // high
        candle[3], // low
        candle[4], // close
        candle[5], // volume
        candle[6] || 0, // oi
      ]),
    },
  };
}

/**
 * Convert Zerodha instrument key to internal format
 * Zerodha uses: NSE:SYMBOL
 * Internal uses: NSE_EQ|SYMBOL
 */
export function zerodhaKeyToInternal(zerodhaKey: string): string {
  // NSE:INFY -> NSE_EQ|INFY
  const parts = zerodhaKey.split(":");
  if (parts.length === 2) {
    return `${parts[0]}_EQ|${parts[1]}`;
  }
  return zerodhaKey;
}

/**
 * Convert internal key to Zerodha format
 * CRITICAL FIX: Use trading symbol, not ISIN code
 * Internal: NSE_EQ|INE251B01027 + symbol: ZENTEC
 * Zerodha: NSE:ZENTEC
 */
export function internalKeyToZerodha(internalKey: string, symbol: string): string {
  // Extract exchange from internal key
  const parts = internalKey.split("|");
  if (parts.length === 2) {
    const exchange = parts[0].replace("_EQ", "").replace("_INDEX", "");
    // Use the trading symbol passed as parameter, NOT the ISIN code
    return `${exchange}:${symbol}`;
  }
  return internalKey;
}
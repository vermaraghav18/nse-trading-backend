/**
 * Upstox V3 historical candle response shape.
 * Each candle row is:
 * [timestamp, open, high, low, close, volume, openInterest]
 */
export type UpstoxHistoricalCandlesResponse = {
  status: string;
  data?: {
    candles?: [
      string,
      number,
      number,
      number,
      number,
      number,
      number
    ][];
  };
};
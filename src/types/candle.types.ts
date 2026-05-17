/**
 * Latest daily candle used by the frontend OHLC section.
 */
export type Candle = {
  id: string;
  instrumentKey: string;
  symbol: string;
  timeframe: "1D";
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/**
 * Full historical candle series kept in backend so indicators can reuse it.
 */
export type HistoricalCandleSeries = {
  id: string;
  instrumentKey: string;
  symbol: string;
  timeframe: "1D";
  candles: [string, number, number, number, number, number, number][];
};
import { Candle } from "../../types/candle.types";

/**
 * Maps a single latest Upstox candle row into our internal candle type.
 */
export function mapLatestCandleToInternalCandle(params: {
  id: string;
  instrumentKey: string;
  symbol: string;
  candleRow: [string, number, number, number, number, number, number];
}): Candle {
  const [timestamp, open, high, low, close, volume] = params.candleRow;

  return {
    id: params.id,
    instrumentKey: params.instrumentKey,
    symbol: params.symbol,
    timeframe: "1D",
    date: timestamp.split("T")[0],
    open,
    high,
    low,
    close,
    volume,
  };
}
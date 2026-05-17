export type Intraday1HCandle = {
  id: string;
  instrumentKey: string;
  symbol: string;
  timeframe: "1H";
  dateTime: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Historical1HSeries = {
  id: string;
  instrumentKey: string;
  symbol: string;
  timeframe: "1H";
  candles: [string, number, number, number, number, number][];
};
export type UpstoxOhlcCandle = {
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  ts?: number;
};

export type UpstoxOhlcQuote = {
  last_price?: number;
  instrument_token?: string;
  prev_ohlc?: UpstoxOhlcCandle | null;
  live_ohlc?: UpstoxOhlcCandle | null;
};

export type UpstoxOhlcQuotesResponse = {
  status: string;
  data: Record<string, UpstoxOhlcQuote>;
};
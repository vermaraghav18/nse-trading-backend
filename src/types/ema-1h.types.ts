export type Ema1HSlant = "UPWARD" | "DOWNWARD" | "FLAT";
export type PriceVsEma1H = "ABOVE_EMA" | "BELOW_EMA" | "NEAR_EMA";
export type TrendState1H =
  | "UPTREND"
  | "DOWNTREND"
  | "BULLISH_PULLBACK"
  | "BEARISH_BOUNCE"
  | "EARLY_RECOVERY"
  | "FAILED_RECOVERY"
  | "SIDEWAYS";

export type Ema1HResult = {
  id: string;
  symbol: string;
  timeframe: "1H";
  period: 44;
  currentClose: number;
  ema44: number;
  ema7dSlant: Ema1HSlant;
  ema14dSlant: Ema1HSlant;
  priceVsEma44: PriceVsEma1H;
  trendState: TrendState1H;
};
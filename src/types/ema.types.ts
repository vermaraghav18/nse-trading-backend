export type EmaSlant = "UPWARD" | "DOWNWARD" | "FLAT";
export type PriceVsEma44 = "ABOVE_EMA" | "BELOW_EMA" | "NEAR_EMA";
export type TrendState =
  | "UPTREND"
  | "DOWNTREND"
  | "BULLISH_PULLBACK"
  | "BEARISH_BOUNCE"
  | "EARLY_RECOVERY"
  | "FAILED_RECOVERY"
  | "SIDEWAYS";

export type EmaResult = {
  id: string;
  symbol: string;
  timeframe: "1D";
  period: 44;
  currentClose: number;
  ema44: number;
  ema7dSlant: EmaSlant;
  ema14dSlant: EmaSlant;
  priceVsEma44: PriceVsEma44;
  trendState: TrendState;
};
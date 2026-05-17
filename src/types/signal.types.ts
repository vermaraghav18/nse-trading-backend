export type SignalSummary = {
  id: string | number;
  symbol: string;
  timeframe: "1D" | "1H";
  indicator: "BOLLINGER" | "MULTIPLE";
  bandSignal?: "ABOVE_UPPER" | "BELOW_LOWER" | "INSIDE_BANDS";
  setupSignal?:
    | "BREAKOUT_BUY"
    | "SUPPORT_BUY"
    | "LOWER_BAND_WATCH"
    | "BREAKDOWN_RISK"
    | "NO_SETUP";
  state: "BUY_READY" | "BUY_WATCH" | "AVOID" | "NEUTRAL";
  actionBias: "BUY" | "SELL" | "WAIT";
  entryPrice: number | null;
  stopLoss: number | null;
  targetPrice: number | null;
  reason: string;
};
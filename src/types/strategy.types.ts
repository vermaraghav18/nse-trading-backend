export type StrategyDecision = {
  id: string;
  strategyName: string;
  symbol: string;
  timeframe: "1D";
  indicatorSource: "BOLLINGER";
  signalState: "BUY_READY" | "BUY_WATCH" | "AVOID" | "NEUTRAL";
  decision: "BUY" | "SELL" | "HOLD";
  confidence: "LOW" | "MEDIUM" | "HIGH";
  entryPrice: number | null;
  stopLoss: number | null;
  targetPrice: number | null;
  reason: string;
};
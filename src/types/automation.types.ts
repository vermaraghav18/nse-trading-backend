/**
 * Automation-ready action record.
 * This is the bridge between strategy decisions and future paper-trade creation.
 */
export type AutomationSignalState =
  | "BUY_READY"
  | "BUY_WATCH"
  | "AVOID"
  | "NEUTRAL";

export type AutomationAction = {
  id: string;
  symbol: string;
  timeframe: "1D";
  strategyName: string;
  signalState: AutomationSignalState;
  decision: "BUY" | "SELL" | "HOLD";
  automationStatus: "READY" | "BLOCKED" | "WAITING";
  shouldCreatePaperTrade: boolean;
  reason: string;
};
export type PaperTradeStatus = "OPEN" | "CLOSED";

export type PaperTradeSignalSource =
  | "PDF1_BULLISH_CONFIRMED"
  | "PDF2_REVERSAL"
  | "PDF2_TWO_CANDLE_REVERSAL"
  | "PDF2_PULLBACK"
  | "PDF3_BREAKOUT_BUY"
  | "PDF3_RETEST_BUY"
  | "PDF3_LOWER_HOLD_BUY"
  | "MANUAL";

export type PaperTradeExitReason =
  | "HIT_RESISTANCE"
  | "STOP_LOSS_MIDDLE_BAND"
  | "STOP_LOSS_1H_MIDDLE_BAND"
  | "STOP_LOSS_DAILY_LOWER_BAND"
  | "PROFIT_TARGET_5PCT"
  | "TRAILING_STOP_2H"
  | "EXHAUSTION_DETECTED"
  | "BROKEN_BELOW_MIDDLE"
  | "MAX_HOLD_EXCEEDED"
  | "MANUAL";

export type PaperTrade = {
  id: string;
  symbol: string;
  side: "BUY";
  quantity: number;

  // Entry
  entryPrice: number;
  entryDate: string;
  entrySignalSource: PaperTradeSignalSource;
  entryReason: string;

  // Live tracking
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;

  // Exit (filled when closed)
  exitPrice: number | null;
  exitDate: string | null;
  exitReason: PaperTradeExitReason | null;
  exitReasonDetailed: string | null;  // *** ADD THIS LINE ***
  realizedPnL: number | null;
  realizedPnLPercent: number | null;

  // Meta
  status: PaperTradeStatus;
  holdingDays: number;
  stopLossLevel: number | null;
  targetResistance: number | null;

  // Multi-timeframe tracking
  peakPrice: number;
  consecutive1HBelowMiddle: number;
};
export type PaperTradesResponse = {
  ok: boolean;
  data: {
    trades: PaperTrade[];
    summary: PaperTradeSummary;
  };
};

export type PaperTradeSummary = {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalInvested: number;
  totalReturns: number;
  totalProfitPercent: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  netPnL: number;
  currentInvested: number;
  currentValue: number;
  overallInvested: number;
  overallValue: number;
  todaysPnL: number;
};
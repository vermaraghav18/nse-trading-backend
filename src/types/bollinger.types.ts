export type BollingerBandSignal =
  | "ABOVE_UPPER"
  | "BELOW_LOWER"
  | "INSIDE_BANDS";

export type BollingerSetupSignal =
  | "BREAKOUT_BUY"
  | "SUPPORT_BUY"
  | "LOWER_BAND_WATCH"
  | "BREAKDOWN_RISK"
  | "NO_SETUP";

export type BollingerEntryReadiness = "READY" | "WATCH" | "AVOID";

export type BollingerMiddleBandDirection = "RISING" | "FALLING" | "FLAT";

export type BollingerBandResult = {
  id: string;
  symbol: string;
  timeframe: "1D";
  period: number;
  currentClose: number;
  middleBand: number;
  upperBand: number;
  lowerBand: number;
  bandSignal: BollingerBandSignal;
  setupSignal: BollingerSetupSignal;
  entryReadiness: BollingerEntryReadiness;
  middleBandDirection: BollingerMiddleBandDirection;
  bandWidthPercent: number;
  breakoutConfirmedDays: number;
  entryPrice: number | null;
  stopLoss: number | null;
  targetPrice: number | null;
  setupNotes: string[];
};
export type ChartTimeframe = "1D" | "1H" | "2H";

export type ChartCandlePoint = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartLinePoint = {
  time: string;
  value: number;
};

export type ChartBollingerPoint = {
  time: string;
  middleBand: number;
  upperBand: number;
  lowerBand: number;
};

export type CandleIntelligenceBias = "BULLISH" | "BEARISH" | "NEUTRAL";
export type CandleIntelligencePattern =
  | "LONG_LOWER_SHADOW"
  | "LONG_UPPER_SHADOW"
  | "STRONG_BULLISH_BODY"
  | "STRONG_BEARISH_BODY"
  | "LARGE_BULLISH_BODY_AT_LOW"
  | "TWO_DAY_BULLISH_ENTRY"
  | "DOJI"
  | "INSIDE_BODY"
  | "NEUTRAL";

export type CandleIntelligenceContext =
  | "NEAR_LOWER_BOLLINGER"
  | "NEAR_UPPER_BOLLINGER"
  | "NEAR_MIDDLE_BOLLINGER_RISING"
  | "NEAR_MIDDLE_BOLLINGER_FALLING"
  | "ABOVE_EMA44"
  | "BELOW_EMA44"
  | "AROUND_EMA44"
  | "NONE";

export type CandleIntelligenceConfirmation = "CONFIRMED" | "PENDING" | "NONE";
export type BollingerPosition = "LOW" | "MID" | "HIGH" | "UNKNOWN";
export type BollingerBandDirection = "RISING" | "FALLING" | "FLAT";
export type TradeSignal = "BUY" | "SELL" | "WAIT";
export type VolumeConfirmation = "HIGH" | "NORMAL" | "LOW" | "UNKNOWN";

export type RecentPriceLocation =
  | "RECENT_LOW"
  | "RECENT_HIGH"
  | "MID_RANGE"
  | "UNKNOWN";

export type Pdf1Signal =
  | "BULLISH_PENDING_CONFIRMATION"
  | "BULLISH_CONFIRMED"
  | "BEARISH_PENDING_CONFIRMATION"
  | "BEARISH_CONFIRMED"
  | "NONE";

export type ZoneOscillationSignal = "BREAKOUT_LIKELY" | "BREAKDOWN_LIKELY" | "NONE";

export type SupportSource =
  | "PREVIOUS_LOW"
  | "PREVIOUS_HIGH_FLIP"
  | "BOLL_MIDDLE"
  | "BOLL_LOWER";

export type ResistanceSource =
  | "PREVIOUS_HIGH"
  | "PREVIOUS_LOW_FLIP"
  | "BOLL_UPPER"
  | "BOLL_MIDDLE"
  | "BOLL_LOWER_DOWNTREND_RESISTANCE";

export type ZoneStrength = "LOW" | "MEDIUM" | "HIGH";

export type SupportAnalysis = {
  zoneLow: number | null;
  zoneHigh: number | null;
  strength: ZoneStrength;
  sources: SupportSource[];
  distancePercent: number | null;
  inZone: boolean;
};

export type ResistanceAnalysis = {
  zoneLow: number | null;
  zoneHigh: number | null;
  strength: ZoneStrength;
  sources: ResistanceSource[];
  distancePercent: number | null;
  inZone: boolean;
};

export type SupportCluster = SupportAnalysis;
export type ResistanceCluster = ResistanceAnalysis;

export type CandleIntelligence = {
  pattern: CandleIntelligencePattern;
  bias: CandleIntelligenceBias;
  context: CandleIntelligenceContext;
  confirmationStatus: CandleIntelligenceConfirmation;

  title: string;
  message: string;
  strengthScore: number;
  reasons: string[];

  bodySize: number;
  rangeSize: number;
  upperShadowSize: number;
  lowerShadowSize: number;

  recentPriceLocation: RecentPriceLocation;
  pdf1Signal: Pdf1Signal;

  bollingerPosition: BollingerPosition;
  bollingerBandDirection: BollingerBandDirection;
  middleBandTouchSignal: "BUY_RETEST" | "SELL_RETEST" | "NONE";
  tradeSignal: TradeSignal;
  buyZone: boolean;
  nearHighCaution: boolean;
  volumeConfirmation: VolumeConfirmation;
};

export type TradePlanAction = "BUY" | "WAIT" | "HOLD" | "TRIM" | "SELL";
export type TradePlanTone = "emerald" | "amber" | "blue" | "red" | "slate";

export type TradePlan = {
  action: TradePlanAction;
  actionTone: TradePlanTone;
  headline: string;
  notes: string[];
  upsideRoom: string;
  downsideCushion: string;
};

export type BollingerConfluence = {
  detected: boolean;
  dailyLevel: number | null;
  hourlyLevel: number | null;
  confluenceZoneLow: number | null;
  confluenceZoneHigh: number | null;
  distancePercent: number | null;
  description: string;
};

export type Bollinger1HSnapshot = {
  middleBand: number | null;
  upperBand: number | null;
  lowerBand: number | null;
  currentClose: number | null;
  signal: "ABOVE_UPPER" | "BELOW_LOWER" | "INSIDE_BANDS" | "UNAVAILABLE";
};

export type Pdf2SetupType =
  | "REVERSAL"
  | "TWO_CANDLE_REVERSAL"
  | "PULLBACK"
  | "BREAKOUT"
  | "EXHAUSTION"
  | "NONE";

export type Pdf2BigGreenValidity = "VALID" | "INVALID" | "NEUTRAL" | "NONE";

export type Pdf2Signal = "BUY" | "CAUTION" | "NEUTRAL" | "NONE";

export type Pdf2Setup = {
  // --- Section A: PDF hard rules ---
  isBigGreenCandle: boolean;
  priceMovePercent: number;
  bodyDominanceRatio: number;
  wickCompressionRatio: number;
  nearRelativeLow: boolean;
  nearRelativeHigh: boolean;
  rangePosition: number;
  bigGreenValidity: Pdf2BigGreenValidity;
  twoCandleReversal: boolean;

  // --- Section B: Extended rules ---
  setupType: Pdf2SetupType;
  nowNearMiddleBand: boolean;
  recentlyWasNearUpperBand: boolean;
  recentPullbackToMiddle: boolean;
  bullishResumeTrigger: boolean;
  isExhaustionRisk: boolean;
  pdf2Signal: Pdf2Signal;
  strength: number;
};

export type Pdf3EntrySignal =
  | "BREAKOUT_BUY"
  | "RETEST_BUY"
  | "LOWER_HOLD_BUY"
  | "OVEREXTENDED"
  | "BROKEN_BELOW"
  | "NONE";

export type Pdf3BollingerEntry = {
  middleBandHoldConfirmed: boolean;
  daysAboveMiddleBand: number;
  crossoverDetected: boolean;
  isOverextended: boolean;
  appreciationSinceCrossover: number;
  middleBandSupportHolding: boolean;
  middleBandBroken: boolean;
  nextDayBounceConfirmed: boolean;
  lowerBandHoldConfirmed: boolean;
  daysAboveLowerBand: number;
  stopLossLevel: number | null;
  entrySignal: Pdf3EntrySignal;
};

export type StockChartData = {
  symbol: string;
  instrumentKey: string;
  timeframe: ChartTimeframe;
    candles: ChartCandlePoint[];
  ema44: ChartLinePoint[];
  bollinger20: ChartBollingerPoint[];
  vwap: ChartLinePoint[];
  latestClose: number | null;
  ema7dSlant: string | null;
  ema14dSlant: string | null;
  intelligence: CandleIntelligence;
 pdf2Setup: Pdf2Setup;
  pdf3BollingerEntry: Pdf3BollingerEntry;
  support: SupportAnalysis;
  supportClusters: SupportCluster[];
  resistance: ResistanceAnalysis;
  resistanceClusters: ResistanceCluster[];
  oscillationSignal: ZoneOscillationSignal;
  bollinger1H: Bollinger1HSnapshot;
  bollingerConfluence: BollingerConfluence;
  tradePlan: TradePlan;
};

export type StockChartQuery = {
  symbol: string;
  timeframe: ChartTimeframe;
};

export type ScannerEntryQuality = "HIGH" | "MEDIUM" | "LOW";
export type ScannerGrade = "A" | "B" | "C" | "D";

export type StockScannerRow = {
  symbol: string;
  timeframe: ChartTimeframe;
  latestClose: number | null;

  ema7dSlant: string | null;
  ema14dSlant: string | null;

  pattern: CandleIntelligence["pattern"];
  bias: CandleIntelligence["bias"];
  context: CandleIntelligence["context"];
  confirmationStatus: CandleIntelligence["confirmationStatus"];
  recentPriceLocation: CandleIntelligence["recentPriceLocation"];
  pdf1Signal: CandleIntelligence["pdf1Signal"];

  bodySize: number;
  rangeSize: number;
  upperShadowSize: number;
  lowerShadowSize: number;

  bollingerPosition: BollingerPosition;
  volumeConfirmation: VolumeConfirmation;

  tradeSignal: TradeSignal;
  buyZone: boolean;
  nearHighCaution: boolean;

  supportDistance: number | null;
  resistanceDistance: number | null;
  posture: "Compressed" | "Near Support" | "Near Resistance" | "Open Range";

  action: TradePlanAction;
  actionTone: TradePlanTone;
  headline: string;
  strengthScore: number;

  trendScore: number;
  entryScore: number;
  pdf1Score: number;
  riskScore: number;
  scannerScore: number;
  entryQuality: ScannerEntryQuality;
  scannerGrade: ScannerGrade;

 // --- PDF2 fields ---
  isBigGreenCandle: boolean;
  priceMovePercent: number;
  bodyDominanceRatio: number;
  wickCompressionRatio: number;
  nearRelativeLow: boolean;
  nearRelativeHigh: boolean;
  rangePosition: number;
  bigGreenValidity: Pdf2BigGreenValidity;
  twoCandleReversal: boolean;
  setupType: Pdf2SetupType;
  nowNearMiddleBand: boolean;
  recentlyWasNearUpperBand: boolean;
  recentPullbackToMiddle: boolean;
  bullishResumeTrigger: boolean;
  isExhaustionRisk: boolean;
  pdf2Signal: Pdf2Signal;
 pdf2Strength: number;

  // --- PDF3 fields ---
  entrySignal: Pdf3EntrySignal;
  middleBandHoldConfirmed: boolean;
  daysAboveMiddleBand: number;
  crossoverDetected: boolean;
  isOverextended: boolean;
  appreciationSinceCrossover: number;
  middleBandSupportHolding: boolean;
  middleBandBroken: boolean;
  nextDayBounceConfirmed: boolean;
  lowerBandHoldConfirmed: boolean;
  daysAboveLowerBand: number;
  stopLossLevel: number | null;
};

export type StockScannerResponse = {
  rows: StockScannerRow[];
};
export type Bollinger1HSignal =
  | "ABOVE_UPPER"
  | "BELOW_LOWER"
  | "INSIDE_BANDS";

export type Bollinger1HResult = {
  id: string;
  symbol: string;
  timeframe: "1H";
  period: 20;
  currentClose: number;
  middleBand: number;
  upperBand: number;
  lowerBand: number;
  signal: Bollinger1HSignal;
};
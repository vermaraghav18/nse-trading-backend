/**
 * Minimal NIFTY 200 CSV row shape after parsing.
 * We only care about the symbol.
 */
export type Nifty200Row = {
  Symbol: string;
};
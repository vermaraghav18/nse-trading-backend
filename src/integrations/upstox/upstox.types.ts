/**
 * Minimal Upstox instrument shape needed for our stock universe.
 * We only map fields we actually use.
 */
export type UpstoxInstrument = {
  instrument_key: string;
  exchange: string;
  trading_symbol: string;
  name?: string;
  instrument_type?: string;
  segment?: string;
};
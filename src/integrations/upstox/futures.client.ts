import { env } from "../../config/env";

export type FuturesQuote = {
  instrumentKey: string;
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  prevOi: number | null;
};

export type FuturesCandle = [string, number, number, number, number, number, number];
// [date, open, high, low, close, volume, OI]

/**
 * Search for futures instrument key for a given symbol.
 * Returns the nearest active month futures key (not expired).
 */
export async function fetchFuturesInstrumentKey(
  symbol: string
): Promise<string | null> {
  try {
    const url = `https://api.upstox.com/v2/instruments/search?query=${encodeURIComponent(symbol)}&segment=NSE_FO`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.upstoxAnalyticsToken}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const items: any[] = data?.data ?? [];

    // Filter to FUT only, matching exact underlying symbol
    const futures = items.filter(
      (x) =>
        x.instrument_type === "FUT" &&
        x.underlying_symbol === symbol
    );

    if (futures.length === 0) return null;

    // Sort by expiry ascending, pick nearest non-expired
    const today = new Date().toISOString().split("T")[0];
    const active = futures
      .filter((x) => x.expiry >= today)
      .sort((a, b) => a.expiry.localeCompare(b.expiry));

    // If nearest expiry is within 5 days, use next month
    if (active.length === 0) return null;

    const nearest = active[0];
    const daysToExpiry = Math.floor(
      (new Date(nearest.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    // If expiry within 5 days, roll to next month
    const selected = daysToExpiry <= 5 && active.length > 1 ? active[1] : active[0];

    return selected.instrument_key;
  } catch {
    return null;
  }
}

/**
 * Fetch last 3 days of futures candles (includes OI as 7th element).
 */
export async function fetchFuturesCandles(
  instrumentKey: string
): Promise<FuturesCandle[]> {
  try {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 7);
    const toDate = today.toISOString().split("T")[0];
    const fromDate = from.toISOString().split("T")[0];

    const url = `https://api.upstox.com/v3/historical-candle/${encodeURIComponent(instrumentKey)}/days/1/${toDate}/${fromDate}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const candles: FuturesCandle[] = data?.data?.candles ?? [];

    return [...candles].sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  } catch {
    return [];
  }
}
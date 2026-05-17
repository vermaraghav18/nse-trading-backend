import { UpstoxHistoricalCandlesResponse } from "./candles.types";

/**
 * Fetches daily historical candles from Upstox V3.
 * We request a date range and later take the latest candle from the response.
 */
export async function fetchUpstoxDailyCandles(
  instrumentKey: string,
  toDate: string,
  fromDate: string
): Promise<UpstoxHistoricalCandlesResponse> {
  const encodedInstrumentKey = encodeURIComponent(instrumentKey);
  const url = `https://api.upstox.com/v3/historical-candle/${encodedInstrumentKey}/days/1/${toDate}/${fromDate}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Upstox candles for ${instrumentKey}: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as UpstoxHistoricalCandlesResponse;
}
import { env } from "../../config/env";

type UpstoxHistorical1HCandleResponse = {
  status: string;
  data?: {
    candles?: [string, number, number, number, number, number, number][];
  };
};

/**
 * Fetches multi-day 1H historical candles from Upstox.
 */
export async function fetchUpstox1HCandles(
  instrumentKey: string,
  toDate: string,
  fromDate: string
): Promise<UpstoxHistorical1HCandleResponse> {
  const encodedInstrumentKey = encodeURIComponent(instrumentKey);
  const url = `https://api.upstox.com/v3/historical-candle/${encodedInstrumentKey}/hours/1/${toDate}/${fromDate}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.upstoxAnalyticsToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to fetch Upstox 1H candles for ${instrumentKey}: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  return (await response.json()) as UpstoxHistorical1HCandleResponse;
}

/**
 * Fetches today's intraday 1H candles from Upstox V3.
 * Returns candles for the current trading day including the incomplete current candle.
 */
export async function fetchUpstoxIntraday1HCandles(
  instrumentKey: string
): Promise<UpstoxHistorical1HCandleResponse> {
  const encodedInstrumentKey = encodeURIComponent(instrumentKey);
  const url = `https://api.upstox.com/v3/historical-candle/intraday/${encodedInstrumentKey}/hours/1`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${env.upstoxAnalyticsToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Failed to fetch Upstox intraday 1H for ${instrumentKey}: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  return (await response.json()) as UpstoxHistorical1HCandleResponse;
}
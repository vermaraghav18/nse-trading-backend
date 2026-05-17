/**
 * Zerodha Historical Data Client
 * Fetches historical candles for stocks
 */

import { getZerodhaClient, isZerodhaAuthenticated } from "./zerodha.client";
import { ZerodhaHistoricalData } from "./zerodha.types";
import { internalKeyToZerodha } from "./candles.mapper";
import { symbolKeyToInstrumentToken } from "./instrumentTokenMapper";

/**
 * Fetch historical candles from Zerodha
 * @param instrumentKey - Internal format (NSE_EQ|INE251B01027)
 * @param symbol - Trading symbol (ZENTEC)
 * @param interval - day, minute, 3minute, 5minute, 10minute, 15minute, 30minute, 60minute
 * @param fromDate - Start date (YYYY-MM-DD)
 * @param toDate - End date (YYYY-MM-DD)
 */
export async function fetchHistoricalCandles(
  instrumentKey: string,
  symbol: string,
  interval: string,
  fromDate: string,
  toDate: string
): Promise<ZerodhaHistoricalData> {
  if (!isZerodhaAuthenticated()) {
    throw new Error("Not authenticated - call generateSession first");
  }

  const client = getZerodhaClient();

  try {
    // Convert to Zerodha symbol format (NSE:RELIANCE)
    const zerodhaSymbolKey = internalKeyToZerodha(instrumentKey, symbol);
    
    // Get instrument token (numerical ID required by Zerodha)
    const instrumentToken = await symbolKeyToInstrumentToken(zerodhaSymbolKey);
    
    console.log(`[zerodha-historical] Fetching ${interval} data for ${zerodhaSymbolKey} (token: ${instrumentToken})`);
    
    const data = await client.getHistoricalData(
      instrumentToken,
      interval,
      fromDate,
      toDate,
      false // continuous = false
    );

    return {
      status: "success",
      data: {
        candles: data,
      },
    };
  } catch (error) {
    console.error(`[zerodha-historical] Failed to fetch data:`, error);
    throw error;
  }
}

/**
 * Fetch daily candles (convenience method)
 */
export async function fetchDailyCandles(
  instrumentKey: string,
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<ZerodhaHistoricalData> {
  return fetchHistoricalCandles(instrumentKey, symbol, "day", fromDate, toDate);
}

/**
 * Fetch hourly candles (convenience method)
 */
export async function fetchHourlyCandles(
  instrumentKey: string,
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<ZerodhaHistoricalData> {
  return fetchHistoricalCandles(instrumentKey, symbol, "60minute", fromDate, toDate);
}
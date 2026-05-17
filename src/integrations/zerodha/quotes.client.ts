/**
 * Zerodha Quotes Client
 * Fetches real-time market quotes
 */

import { getZerodhaClient, isZerodhaAuthenticated } from "./zerodha.client";
import { ZerodhaQuote } from "./zerodha.types";

/**
 * Fetch quotes for multiple instruments
 * @param instruments - Array of instrument identifiers (e.g., ["NSE:INFY", "NSE:TCS"])
 */
export async function fetchQuotes(instruments: string[]): Promise<Record<string, ZerodhaQuote>> {
  if (!isZerodhaAuthenticated()) {
    throw new Error("Not authenticated - call generateSession first");
  }

  if (instruments.length === 0) {
    return {};
  }

  const client = getZerodhaClient();

  try {
    console.log(`[zerodha-quotes] Fetching quotes for ${instruments.length} instruments`);
    
    const quotes = await client.getQuote(instruments);
    
    return quotes as Record<string, ZerodhaQuote>;
  } catch (error) {
    console.error(`[zerodha-quotes] Failed to fetch quotes:`, error);
    throw error;
  }
}

/**
 * Fetch OHLC data for instruments
 */
export async function fetchOHLC(instruments: string[]): Promise<any> {
  if (!isZerodhaAuthenticated()) {
    throw new Error("Not authenticated");
  }

  const client = getZerodhaClient();

  try {
    const ohlc = await client.getOHLC(instruments);
    return ohlc;
  } catch (error) {
    console.error(`[zerodha-quotes] Failed to fetch OHLC:`, error);
    throw error;
  }
}

/**
 * Fetch LTP (Last Traded Price) for instruments
 */
export async function fetchLTP(instruments: string[]): Promise<any> {
  if (!isZerodhaAuthenticated()) {
    throw new Error("Not authenticated");
  }

  const client = getZerodhaClient();

  try {
    const ltp = await client.getLTP(instruments);
    return ltp;
  } catch (error) {
    console.error(`[zerodha-quotes] Failed to fetch LTP:`, error);
    throw error;
  }
}
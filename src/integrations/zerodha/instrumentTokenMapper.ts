/**
 * Zerodha Instrument Token Mapper
 * Maps trading symbols to instrument tokens
 */

import { getZerodhaClient } from "./zerodha.client";

// Cache for instrument tokens
let instrumentCache: Map<string, number> | null = null;
let cacheExpiry: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get instrument token for a trading symbol
 * @param exchange - Exchange (NSE, BSE, etc)
 * @param symbol - Trading symbol (RELIANCE, TCS, etc)
 * @returns Instrument token number
 */
export async function getInstrumentToken(exchange: string, symbol: string): Promise<number> {
  // Load cache if needed
  if (!instrumentCache || Date.now() > cacheExpiry) {
    await refreshInstrumentCache(exchange);
  }

  const key = `${exchange}:${symbol}`;
  const token = instrumentCache?.get(key);

  if (!token) {
    throw new Error(`Instrument token not found for ${key}`);
  }

  return token;
}

/**
 * Refresh instrument cache from Zerodha
 */
async function refreshInstrumentCache(exchange: string): Promise<void> {
  console.log(`[zerodha-tokens] Refreshing instrument cache for ${exchange}...`);
  
  const client = getZerodhaClient();
  const instruments = await client.getInstruments(exchange);

  instrumentCache = new Map();
  
  for (const instrument of instruments) {
    const key = `${instrument.exchange}:${instrument.tradingsymbol}`;
    instrumentCache.set(key, instrument.instrument_token);
  }

  cacheExpiry = Date.now() + CACHE_DURATION;
  console.log(`[zerodha-tokens] ✅ Cached ${instrumentCache.size} instruments`);
}

/**
 * Convert symbol-based key to instrument token
 * @param zerodhaKey - Format: NSE:RELIANCE
 * @returns Instrument token number
 */
export async function symbolKeyToInstrumentToken(zerodhaKey: string): Promise<number> {
  const parts = zerodhaKey.split(":");
  if (parts.length !== 2) {
    throw new Error(`Invalid Zerodha key format: ${zerodhaKey}`);
  }

  const [exchange, symbol] = parts;
  return await getInstrumentToken(exchange, symbol);
}
import { fetchUpstoxNseInstruments } from "../integrations/upstox/instruments.client";
import { mapUpstoxInstrumentsToStocks } from "../integrations/upstox/instruments.mapper";
import { fetchNifty50Symbols } from "../integrations/upstox/nifty50.client";
import { getCustomStocksAsStockList } from "./custom-stocks.service";
import { Stock } from "../types/stock.types";
import { getOrSetCache, setCacheValue } from "../utils/simple-cache";

const STOCKS_CACHE_KEY = "stocks:nifty50+custom";
const STOCKS_CACHE_TTL_MS = 1000 * 60 * 30;

/**
 * Returns the full stock universe: NIFTY 50 + custom stocks.
 * Custom stocks are merged and deduplicated by symbol.
 */
export async function getAllStocks(): Promise<Stock[]> {
  return getOrSetCache(STOCKS_CACHE_KEY, STOCKS_CACHE_TTL_MS, async () => {
    const [rawInstruments, nifty50Symbols] = await Promise.all([
      fetchUpstoxNseInstruments(),
      fetchNifty50Symbols(),
    ]);

    const mappedStocks = mapUpstoxInstrumentsToStocks(rawInstruments);

    const filteredStocks = mappedStocks.filter((stock) =>
      nifty50Symbols.has(stock.symbol)
    );

    // Merge custom stocks
    const customStocks = getCustomStocksAsStockList();
    const existingSymbols = new Set(filteredStocks.map((s) => s.symbol));

    for (const custom of customStocks) {
      if (!existingSymbols.has(custom.symbol)) {
        filteredStocks.push(custom);
        existingSymbols.add(custom.symbol);
      }
    }

    return filteredStocks;
  });
}

/**
 * Invalidates the stock cache so next call re-fetches with updated custom stocks.
 */
export function invalidateStockCache(): void {
  // Set cache with 0 TTL to force immediate expiry
  setCacheValue(STOCKS_CACHE_KEY, null, 0);
}

// Track which symbols are Nifty 50 (cached for performance)
let nifty50SymbolsCache: Set<string> | null = null;

/**
 * Check if a stock is part of Nifty 50
 * This is used by provider-selector to route stocks correctly
 */
export async function isNifty50Stock(stock: Stock): Promise<boolean> {
  // Refresh cache if needed
  if (!nifty50SymbolsCache) {
    nifty50SymbolsCache = await fetchNifty50Symbols();
  }
  
  return nifty50SymbolsCache.has(stock.symbol);
}

/**
 * Get list of Nifty 50 symbols
 */
export async function getNifty50Symbols(): Promise<Set<string>> {
  if (!nifty50SymbolsCache) {
    nifty50SymbolsCache = await fetchNifty50Symbols();
  }
  return nifty50SymbolsCache;
}

/**
 * Clear Nifty 50 cache (useful when cache needs refresh)
 */
export function clearNifty50Cache(): void {
  nifty50SymbolsCache = null;
}
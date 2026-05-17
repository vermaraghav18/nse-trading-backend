import { readJsonCacheFile, writeJsonCacheFile } from "../utils/file-cache";
import { fetchUpstoxNseInstruments } from "../integrations/upstox/instruments.client";
import { UpstoxInstrument } from "../integrations/upstox/upstox.types";
import { Stock } from "../types/stock.types";

const CUSTOM_STOCKS_FILE = "custom-stocks.json";

type CustomStockEntry = {
  symbol: string;
  instrumentKey: string;
  name: string;
  addedAt: string;
};

let customStocks: CustomStockEntry[] = [];
let instrumentCache: UpstoxInstrument[] = [];

// ─── Persistence ────────────────────────────────────────

export async function loadCustomStocksFromDisk(): Promise<void> {
  const saved = await readJsonCacheFile<CustomStockEntry[]>(CUSTOM_STOCKS_FILE);
  if (saved && Array.isArray(saved)) {
    customStocks = saved;
    console.log(`[custom-stocks] Loaded ${customStocks.length} custom stocks from disk.`);
  }
}

async function saveToDisk(): Promise<void> {
  await writeJsonCacheFile(CUSTOM_STOCKS_FILE, customStocks);
}

// ─── Instrument cache (for search) ─────────────────────

export async function warmInstrumentCache(): Promise<void> {
  try {
    const all = await fetchUpstoxNseInstruments();
    instrumentCache = all.filter(
      (i) =>
        i.exchange === "NSE" &&
        (i.segment === "NSE_EQ" || i.instrument_type === "EQ") &&
        Boolean(i.trading_symbol)
    );
    console.log(`[custom-stocks] Instrument cache warmed: ${instrumentCache.length} NSE equities.`);
  } catch (err) {
    console.error("[custom-stocks] Failed to warm instrument cache:", err);
  }
}

// ─── Search ─────────────────────────────────────────────

/**
 * Lookup instrument key by symbol from the full NSE instrument cache
 */
export function getInstrumentKeyBySymbol(symbol: string): string | null {
  const found = instrumentCache.find(
    (i) => i.trading_symbol.toUpperCase() === symbol.toUpperCase()
  );
  return found ? found.instrument_key : null;
}

export function searchInstruments(query: string, limit = 10): {
  symbol: string;
  name: string;
  instrumentKey: string;
  alreadyAdded: boolean;
}[] {
  if (!query || query.length < 2) return [];

  const q = query.toUpperCase();
  const addedSymbols = new Set(customStocks.map((s) => s.symbol));

  return instrumentCache
    .filter(
      (i) =>
        i.trading_symbol.toUpperCase().includes(q) ||
        (i.name && i.name.toUpperCase().includes(q))
    )
    .slice(0, limit)
    .map((i) => ({
      symbol: i.trading_symbol,
      name: i.name || i.trading_symbol,
      instrumentKey: i.instrument_key,
      alreadyAdded: addedSymbols.has(i.trading_symbol),
    }));
}

// ─── Add / Remove ───────────────────────────────────────

export async function addCustomStock(
  symbol: string,
  instrumentKey: string,
  name: string
): Promise<{ ok: boolean; message: string }> {
  const normalized = symbol.trim().toUpperCase();

  if (customStocks.some((s) => s.symbol === normalized)) {
    return { ok: false, message: `${normalized} is already in your custom list.` };
  }

  customStocks.push({
    symbol: normalized,
    instrumentKey,
    name,
    addedAt: new Date().toISOString(),
  });

  await saveToDisk();
  console.log(`[custom-stocks] Added: ${normalized} (${instrumentKey})`);
  return { ok: true, message: `${normalized} added successfully.` };
}

export async function removeCustomStock(
  symbol: string
): Promise<{ ok: boolean; message: string }> {
  const normalized = symbol.trim().toUpperCase();
  const before = customStocks.length;
  customStocks = customStocks.filter((s) => s.symbol !== normalized);

  if (customStocks.length === before) {
    return { ok: false, message: `${normalized} not found in custom list.` };
  }

  await saveToDisk();
  console.log(`[custom-stocks] Removed: ${normalized}`);
  return { ok: true, message: `${normalized} removed.` };
}

// ─── Get custom stocks as Stock[] for merging ───────────

export function getCustomStocksAsStockList(): Stock[] {
  return customStocks.map((entry, index) => ({
    id: `custom-${index + 1}`,
    instrumentKey: entry.instrumentKey,
    symbol: entry.symbol,
    name: entry.name,
    exchange: "NSE" as const,
    sector: "Custom",
    isActive: true,
  }));
}

export function getCustomStockEntries(): CustomStockEntry[] {
  return [...customStocks];
}

/**
 * Get all custom stock symbols as array
 * Used for smart provider distribution
 */
export function getAllCustomStockSymbols(): string[] {
  return customStocks.map(entry => entry.symbol);
}
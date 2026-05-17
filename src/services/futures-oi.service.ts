import {
  fetchFuturesInstrumentKey,
  fetchFuturesCandles,
} from "../integrations/upstox/futures.client";

export type OiBuildupType =
  | "LONG_BUILDUP"
  | "SHORT_BUILDUP"
  | "LONG_UNWINDING"
  | "SHORT_COVERING"
  | "NO_DATA";

export type FuturesOiData = {
  symbol: string;
  instrumentKey: string | null;
  currentOi: number | null;
  prevOi: number | null;
  oiChangePct: number | null;
  futuresPrice: number | null;
  futurePriceChangePct: number | null;
  buildupType: OiBuildupType;
  isF0Eligible: boolean;
};

// Cache: symbol → futures instrument key
const futuresKeyCache = new Map<string, string | null>();
// Cache: symbol → OI data (refreshed every 60s)
const oiDataCache = new Map<string, FuturesOiData>();

// F&O eligible symbols — matches sector-map stocks
const FO_ELIGIBLE = new Set([
  "RELIANCE","HDFCBANK","ICICIBANK","SBIN","AXISBANK","KOTAKBANK",
  "INDUSINDBK","BAJFINANCE","BAJAJFINSV","HINDUNILVR","ITC",
  "BHARTIARTL","INFY","TCS","HCLTECH","WIPRO","TECHM","LTTS",
  "MPHASIS","PERSISTENT","COFORGE","OFSS","LT","ADANIPORTS",
  "ADANIENT","NTPC","POWERGRID","COALINDIA","ONGC","BPCL","IOC",
  "HINDPETRO","GRASIM","ULTRACEMCO","SUNPHARMA","DRREDDY","CIPLA",
  "DIVISLAB","LUPIN","AUROPHARMA","ZYDUSLIFE","TORNTPHARM",
  "APOLLOHOSP","MAXHEALTH","TITAN","MARUTI","BAJAJ-AUTO","EICHERMOT",
  "M&M","TATAELXSI","HDFCLIFE","SBILIFE","ICICIGI","ICICIPRULI",
  "LICI","MFSL","SBICARD","BAJAJHLDNG","CHOLAFIN","SHRIRAMFIN",
  "MUTHOOTFIN","PFC","RECLTD","JIOFIN","ABCAPITAL","LTF",
  "TRENT","JUBLFOOD","TITAN","VBL","BRITANNIA","NESTLEIND",
  "GODREJCP","HINDUNILVR","TATACONSUM","ASIANPAINT","INDIGO",
  "AUBANK","BANDHANBNK","FEDERALBNK","RBLBANK","PNB","CANBK",
  "BANKBARODA","UNIONBANK","SBIN","IDFCFIRSTB","JSWSTEEL",
  "TATASTEEL","HINDALCO","BEL","ADANIPOWER","TORNTPOWER",
  "INDUSTOWER","IRCTC","IRFC","GODREJPROP","INDHOTEL",
  "DIXON","LAURUSLABS","IPCALAB","DRREDDY","COROMANDEL",
  "LTM","SBILIFE","INFY","HCLTECH","WIPRO",
]);

export function isFoEligible(symbol: string): boolean {
  return FO_ELIGIBLE.has(symbol);
}

function classifyBuildup(
  priceChangePct: number,
  oiChangePct: number
): OiBuildupType {
  const priceUp = priceChangePct > 0;
  const oiUp = oiChangePct > 0;

  if (priceUp && oiUp) return "LONG_BUILDUP";
  if (priceUp && !oiUp) return "SHORT_COVERING";
  if (!priceUp && oiUp) return "SHORT_BUILDUP";
  return "LONG_UNWINDING";
}

export async function fetchOiForSymbol(symbol: string): Promise<FuturesOiData> {
  if (!isFoEligible(symbol)) {
    return {
      symbol,
      instrumentKey: null,
      currentOi: null,
      prevOi: null,
      oiChangePct: null,
      futuresPrice: null,
      futurePriceChangePct: null,
      buildupType: "NO_DATA",
      isF0Eligible: false,
    };
  }

  // Get or fetch futures instrument key
  if (!futuresKeyCache.has(symbol)) {
    const key = await fetchFuturesInstrumentKey(symbol);
    futuresKeyCache.set(symbol, key);
    console.log(`[futures-oi] ${symbol} → ${key ?? "NOT FOUND"}`);
  }

  const instrumentKey = futuresKeyCache.get(symbol) ?? null;

  if (!instrumentKey) {
    return {
      symbol,
      instrumentKey: null,
      currentOi: null,
      prevOi: null,
      oiChangePct: null,
      futuresPrice: null,
      futurePriceChangePct: null,
      buildupType: "NO_DATA",
      isF0Eligible: true,
    };
  }

  // Fetch candles
  const candles = await fetchFuturesCandles(instrumentKey);

  if (candles.length < 2) {
    return {
      symbol,
      instrumentKey,
      currentOi: null,
      prevOi: null,
      oiChangePct: null,
      futuresPrice: null,
      futurePriceChangePct: null,
      buildupType: "NO_DATA",
      isF0Eligible: true,
    };
  }

  const latest = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const currentOi = latest[6];
  const prevOi = prev[6];
  const currentPrice = latest[4]; // close
  const prevPrice = prev[4];

  const oiChangePct =
    prevOi > 0
      ? Number((((currentOi - prevOi) / prevOi) * 100).toFixed(2))
      : null;

  const futurePriceChangePct =
    prevPrice > 0
      ? Number((((currentPrice - prevPrice) / prevPrice) * 100).toFixed(2))
      : null;

  const buildupType =
    oiChangePct !== null && futurePriceChangePct !== null
      ? classifyBuildup(futurePriceChangePct, oiChangePct)
      : "NO_DATA";

  const result: FuturesOiData = {
    symbol,
    instrumentKey,
    currentOi,
    prevOi,
    oiChangePct,
    futuresPrice: currentPrice,
    futurePriceChangePct,
    buildupType,
    isF0Eligible: true,
  };

  oiDataCache.set(symbol, result);
  return result;
}

export function getCachedOiData(symbol: string): FuturesOiData | null {
  return oiDataCache.get(symbol) ?? null;
}
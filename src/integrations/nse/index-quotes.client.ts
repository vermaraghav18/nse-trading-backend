/**
 * NSE Public API Client for Index Data
 * Uses NSE's official public API - no authentication required
 * This is a SEPARATE system from Upstox - works independently
 */

export type NseIndexQuote = {
  symbol: string;
  lastPrice: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  previousClose: number;
  change: number;
  pChange: number;
};

/**
 * Map our internal index symbols to NSE API symbols
 */
const NSE_INDEX_MAP: Record<string, string> = {
  "NIFTY50": "NIFTY 50",
  "NIFTYNEXT50": "NIFTY NEXT 50",
  "NIFTY100": "NIFTY 100",
  "NIFTY200": "NIFTY 200",
  "NIFTY500": "NIFTY 500",
  "NIFTYMIDCAP50": "NIFTY MIDCAP 50",
  "NIFTYMIDCAP100": "NIFTY MIDCAP 100",
  "NIFTYMIDCAP150": "NIFTY MIDCAP 150",
  "NIFTYSMALLCAP50": "NIFTY SMLCAP 50",
  "NIFTYSMALLCAP100": "NIFTY SMLCAP 100",
  "NIFTYSMALLCAP250": "NIFTY SMLCAP 250",
  "NIFTYBANK": "NIFTY BANK",
  "NIFTYAUTO": "NIFTY AUTO",
  "NIFTYFMCG": "NIFTY FMCG",
  "NIFTYIT": "NIFTY IT",
  "NIFTYMEDIA": "NIFTY MEDIA",
  "NIFTYMETAL": "NIFTY METAL",
  "NIFTYPHARMA": "NIFTY PHARMA",
  "NIFTYPSUBANK": "NIFTY PSU BANK",
  "NIFTYPVTBANK": "NIFTY PVT BANK",
  "NIFTYREALTY": "NIFTY REALTY",
  "NIFTYFINSERVICE": "NIFTY FIN SERVICE",
  "NIFTYHEALTHCARE": "NIFTY HEALTHCARE",
  "NIFTYOILGAS": "NIFTY OIL & GAS",
  "NIFTYCOMMODITIES": "NIFTY COMMODITIES",
  "NIFTYCONSUMPTION": "NIFTY CONSUMPTION",
  "NIFTYCPSE": "NIFTY CPSE",
  "NIFTYENERGY": "NIFTY ENERGY",
  "NIFTYINFRA": "NIFTY INFRASTRUCTURE",
  "NIFTYPSE": "NIFTY PSE",
  "NIFTYSERVICES": "NIFTY SERV SECTOR",
  "NIFTYMIDCAPLIQUID": "NIFTY MID LIQ 15",
  "NIFTYMNC": "NIFTY MNC",
};

/**
 * Fetches a single index quote from NSE
 */
async function fetchNseIndexQuote(nseSymbol: string): Promise<NseIndexQuote | null> {
  try {
    // NSE public API endpoint
    const url = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(nseSymbol)}`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
      },
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    
    // NSE returns data in this format - the index itself is in the data array
    if (json.data && json.data.length > 0) {
      const indexData = json.data[0]; // First item is the index itself
      
      // DEBUG: Log the actual fields we're receiving (only for first index to avoid spam)
      if (nseSymbol === "NIFTY 50") {
        console.log("[nse-client] Sample NSE response fields:", Object.keys(indexData));
        console.log("[nse-client] Sample NSE response data:", JSON.stringify(indexData, null, 2));
      }
      
      return {
        symbol: nseSymbol,
        lastPrice: indexData.last || indexData.lastPrice || indexData.ltp || indexData.close || 0,
        open: indexData.open || 0,
        dayHigh: indexData.dayHigh || indexData.high || 0,
        dayLow: indexData.dayLow || indexData.low || 0,
        previousClose: indexData.previousClose || indexData.prevClose || 0,
        change: indexData.change || 0,
        pChange: indexData.pChange || indexData.perChange || 0,
      };
    }

    return null;
  } catch (error) {
    console.warn(`[nse-client] Failed to fetch ${nseSymbol}:`, error);
    return null;
  }
}

/**
 * Fetches all index quotes from NSE
 * Returns data mapped to our internal symbol format
 */
export async function fetchAllNseIndexQuotes(): Promise<Record<string, NseIndexQuote>> {
  console.log("[nse-client] Fetching index data from NSE public API");
  
  const results: Record<string, NseIndexQuote> = {};
  
  for (const [ourSymbol, nseSymbol] of Object.entries(NSE_INDEX_MAP)) {
    const quote = await fetchNseIndexQuote(nseSymbol);
    
    if (quote) {
      results[ourSymbol] = quote;
    }
    
    // Small delay to be respectful to NSE servers
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`[nse-client] Successfully fetched ${Object.keys(results).length}/${Object.keys(NSE_INDEX_MAP).length} indices`);
  
  return results;
}
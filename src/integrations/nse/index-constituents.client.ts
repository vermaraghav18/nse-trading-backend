/**
 * Universal NSE Index Constituents Client
 * Fetches constituent stocks for any NSE index from official NSE CSV files
 */

/**
 * NSE Index CSV URL mapping
 * Format: symbol → CSV URL on NSE's official site
 */
const NSE_INDEX_CSV_URLS: Record<string, string> = {
  // Broad Market Indices
  "NIFTY50": "https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv",
  "NIFTYNEXT50": "https://www.niftyindices.com/IndexConstituent/ind_niftynext50list.csv",
  "NIFTY100": "https://www.niftyindices.com/IndexConstituent/ind_nifty100list.csv",
  "NIFTY200": "https://www.niftyindices.com/IndexConstituent/ind_nifty200list.csv",
  "NIFTY500": "https://www.niftyindices.com/IndexConstituent/ind_nifty500list.csv",
  "NIFTYMIDCAP50": "https://www.niftyindices.com/IndexConstituent/ind_niftymidcap50list.csv",
  "NIFTYMIDCAP100": "https://www.niftyindices.com/IndexConstituent/ind_niftymidcap100list.csv",
  "NIFTYMIDCAP150": "https://www.niftyindices.com/IndexConstituent/ind_niftymidcap150list.csv",
  "NIFTYSMALLCAP50": "https://www.niftyindices.com/IndexConstituent/ind_niftysmallcap50list.csv",
  "NIFTYSMALLCAP100": "https://www.niftyindices.com/IndexConstituent/ind_niftysmallcap100list.csv",
  "NIFTYSMALLCAP250": "https://www.niftyindices.com/IndexConstituent/ind_niftysmallcap250list.csv",
  
  // Sectoral Indices
  "NIFTYBANK": "https://www.niftyindices.com/IndexConstituent/ind_niftybanklist.csv",
  "NIFTYAUTO": "https://www.niftyindices.com/IndexConstituent/ind_niftyautolist.csv",
  "NIFTYFMCG": "https://www.niftyindices.com/IndexConstituent/ind_niftyfmcglist.csv",
  "NIFTYIT": "https://www.niftyindices.com/IndexConstituent/ind_niftyitlist.csv",
  "NIFTYMEDIA": "https://www.niftyindices.com/IndexConstituent/ind_niftymedialist.csv",
  "NIFTYMETAL": "https://www.niftyindices.com/IndexConstituent/ind_niftymetallist.csv",
  "NIFTYPHARMA": "https://www.niftyindices.com/IndexConstituent/ind_niftypharmalist.csv",
  "NIFTYPSUBANK": "https://www.niftyindices.com/IndexConstituent/ind_niftypsubanklist.csv",
  "NIFTYPVTBANK": "https://www.niftyindices.com/IndexConstituent/ind_nifty_privatebanklist.csv",
  "NIFTYREALTY": "https://www.niftyindices.com/IndexConstituent/ind_niftyrealtylist.csv",
  "NIFTYFINSERVICE": "https://www.niftyindices.com/IndexConstituent/ind_niftyfinancelist.csv",
  "NIFTYHEALTHCARE": "https://www.niftyindices.com/IndexConstituent/ind_niftyhealthcarelist.csv",
  "NIFTYOILGAS": "https://www.niftyindices.com/IndexConstituent/ind_niftyoilgaslist.csv",
  
  // Thematic Indices
  "NIFTYCOMMODITIES": "https://www.niftyindices.com/IndexConstituent/ind_niftycommoditieslist.csv",
  "NIFTYCONSUMPTION": "https://www.niftyindices.com/IndexConstituent/ind_niftyconsumptionlist.csv",
  "NIFTYCPSE": "https://www.niftyindices.com/IndexConstituent/ind_niftycpselist.csv",
  "NIFTYENERGY": "https://www.niftyindices.com/IndexConstituent/ind_niftyenergylist.csv",
  "NIFTYINFRA": "https://www.niftyindices.com/IndexConstituent/ind_niftyinfralist.csv",
  "NIFTYPSE": "https://www.niftyindices.com/IndexConstituent/ind_niftypse.csv",
  "NIFTYSERVICES": "https://www.niftyindices.com/IndexConstituent/ind_niftyserviceslist.csv",
  "NIFTYMIDCAPLIQUID": "https://www.niftyindices.com/IndexConstituent/ind_niftymidcapliquid15list.csv",
  "NIFTYMNC": "https://www.niftyindices.com/IndexConstituent/ind_niftymnclist.csv",
};

/**
 * Fallback stock lists for when CSV is unavailable
 * These are approximate - will be replaced by CSV data when available
 */
const FALLBACK_CONSTITUENTS: Record<string, string[]> = {
  "NIFTYREALTY": [
    "DLF", "GODREJPROP", "OBEROIRLTY", "PRESTIGE", "BRIGADE",
    "SOBHA", "PHOENIXLTD", "IBREALEST", "MAHLIFE", "SUNTECK"
  ],
  "NIFTYAUTO": [
    "MARUTI", "M&M", "TATAMOTORS", "BAJAJ-AUTO", "EICHERMOT",
    "HEROMOTOCO", "MOTHERSON", "BOSCHLTD", "BHARATFORG", "TVSMOTOR",
    "EXIDEIND", "MRF", "APOLLOTYRE", "BALKRISIND", "ASHOKLEY"
  ],
  "NIFTYMEDIA": [
    "ZEEL", "PVRINOX", "SUNTV", "DISHTV", "TV18BRDCST",
    "DBCORP", "NAVNETEDUL", "JAGRAN"
  ],
  // Add more fallbacks as needed
};

/**
 * Parse CSV and extract stock symbols with their ISIN codes
 * Returns a map of Symbol → ISIN Code
 */
function parseSymbolsFromCsv(csvText: string): Map<string, string> {
  const lines = csvText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return new Map<string, string>();
  }

  const headers = lines[0].split(",").map((value) => value.trim());
  console.log(`[nse-constituents] CSV headers:`, headers);
  
  // Find Symbol column (column C in Excel)
  const symbolIndex = headers.findIndex((header) => 
    header.toLowerCase() === "symbol"
  );
  
  // Find ISIN Code column (column E in Excel)
  const isinIndex = headers.findIndex((header) => 
    header.toLowerCase().includes("isin")
  );

  if (symbolIndex === -1) {
    console.warn("[nse-constituents] Could not find Symbol column in CSV");
    return new Map<string, string>();
  }
  
  if (isinIndex === -1) {
    console.warn("[nse-constituents] Could not find ISIN column in CSV");
    return new Map<string, string>();
  }
  
  console.log(`[nse-constituents] Using Symbol column index ${symbolIndex}, ISIN column index ${isinIndex}`);

  const symbolToIsin = new Map<string, string>();
  
  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(",").map((value) => value.trim());
    const symbol = columns[symbolIndex];
    const isin = columns[isinIndex];
    
    if (symbol && isin && symbol.length > 0 && isin.length > 0) {
      symbolToIsin.set(symbol.toUpperCase(), isin);
    }
  }
  
  console.log(`[nse-constituents] Sample parsed data:`, 
    Array.from(symbolToIsin.entries()).slice(0, 3));

  return symbolToIsin;
}

/**
 * Fetches constituent stocks for a given index symbol
 * Returns a map of Symbol → ISIN Code
 */
export async function fetchIndexConstituents(indexSymbol: string): Promise<Map<string, string>> {
  const csvUrl = NSE_INDEX_CSV_URLS[indexSymbol];
  
  if (!csvUrl) {
    console.warn(`[nse-constituents] No CSV URL for ${indexSymbol}, using fallback`);
    const fallback = FALLBACK_CONSTITUENTS[indexSymbol] || [];
    // For fallback, we only have symbols, not ISIN codes
    const map = new Map<string, string>();
    fallback.forEach(symbol => map.set(symbol.toUpperCase(), ""));
    return map;
  }

  try {
    console.log(`[nse-constituents] Fetching constituents for ${indexSymbol} from NSE`);
    
    const response = await fetch(csvUrl, {
      headers: {
        "user-agent": "Mozilla/5.0",
        "accept": "text/csv,text/plain,*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch NSE CSV: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    const parsed = parseSymbolsFromCsv(csvText);

    if (parsed.size > 0) {
      console.log(`[nse-constituents] Loaded ${parsed.size} constituents for ${indexSymbol}`);
      return parsed;
    }

    throw new Error(`CSV returned no symbols for ${indexSymbol}`);
  } catch (error) {
    console.warn(
      `[nse-constituents] Failed to fetch CSV for ${indexSymbol}, using fallback:`,
      error
    );

    const fallback = FALLBACK_CONSTITUENTS[indexSymbol] || [];
    
    if (fallback.length === 0) {
      console.error(`[nse-constituents] No fallback available for ${indexSymbol}`);
    }
    
    const map = new Map<string, string>();
    fallback.forEach(symbol => map.set(symbol.toUpperCase(), ""));
    return map;
  }
}

/**
 * Check if an index symbol is supported
 */
export function isIndexSupported(indexSymbol: string): boolean {
  return indexSymbol in NSE_INDEX_CSV_URLS || indexSymbol in FALLBACK_CONSTITUENTS;
}

/**
 * Get all supported index symbols
 */
export function getSupportedIndices(): string[] {
  const csvIndices = Object.keys(NSE_INDEX_CSV_URLS);
  const fallbackIndices = Object.keys(FALLBACK_CONSTITUENTS);
  
  return Array.from(new Set([...csvIndices, ...fallbackIndices]));
}
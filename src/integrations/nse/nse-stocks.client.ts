/**
 * NSE Stock-Level Data Client
 * Fetches live stock prices and weightages for index constituents
 */

export interface NseStockData {
  symbol: string;
  identifier: string;
  open: number;
  dayHigh: number;
  dayLow: number;
  lastPrice: number;
  previousClose: number;
  change: number;
  pChange: number; // Percentage change
  totalTradedVolume: number;
  totalTradedValue: number;
  yearHigh: number;
  yearLow: number;
  // Note: Weightage might not always be present
  weight?: number;
}

export interface NseIndexStocksResponse {
  data: NseStockData[];
  timestamp: string;
}

/**
 * Fetch live stock data for an index from NSE
 * Example: fetchNseIndexStocks("NIFTY BANK")
 */
export async function fetchNseIndexStocks(indexName: string): Promise<NseIndexStocksResponse> {
  try {
    // NSE uses space-separated names like "NIFTY BANK", "NIFTY 50"
    const formattedIndex = indexName.replace(/([A-Z]+)(\d+)/, "$1 $2"); // NIFTY50 -> NIFTY 50
    const encodedIndex = encodeURIComponent(formattedIndex);
    
    console.log(`[nse-stocks-client] Fetching stocks for ${formattedIndex}`);
    
    const url = `https://www.nseindia.com/api/equity-stockIndices?index=${encodedIndex}`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.nseindia.com/",
      },
    });

    if (!response.ok) {
      throw new Error(`NSE API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    
    // NSE returns data in a "data" array
    if (!json.data || !Array.isArray(json.data)) {
      throw new Error("Invalid response format from NSE");
    }

    console.log(`[nse-stocks-client] Fetched ${json.data.length} stocks for ${formattedIndex}`);
    
    return {
      data: json.data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[nse-stocks-client] Error fetching ${indexName}:`, error);
    throw error;
  }
}

/**
 * Map index symbol to NSE API format
 * NIFTYBANK -> "NIFTY BANK"
 * NIFTY50 -> "NIFTY 50"
 */
export function mapIndexSymbolToNseName(symbol: string): string {
  const mapping: Record<string, string> = {
    "NIFTY50": "NIFTY 50",
    "NIFTYNEXT50": "NIFTY NEXT 50",
    "NIFTY100": "NIFTY 100",
    "NIFTY200": "NIFTY 200",
    "NIFTY500": "NIFTY 500",
    "NIFTYBANK": "NIFTY BANK",
    "NIFTYAUTO": "NIFTY AUTO",
    "NIFTYFMCG": "NIFTY FMCG",
    "NIFTYIT": "NIFTY IT",
    "NIFTYMEDIA": "NIFTY MEDIA",
    "NIFTYMETAL": "NIFTY METAL",
    "NIFTYPHARMA": "NIFTY PHARMA",
    "NIFTYPSUBANK": "NIFTY PSU BANK",
    "NIFTYPVTBANK": "NIFTY PRIVATE BANK",
    "NIFTYREALTY": "NIFTY REALTY",
    "NIFTYFINSERVICE": "NIFTY FINANCIAL SERVICES",
    "NIFTYHEALTHCARE": "NIFTY HEALTHCARE",
    "NIFTYOILGAS": "NIFTY OIL & GAS",
    "NIFTYCOMMODITIES": "NIFTY COMMODITIES",
    "NIFTYCONSUMPTION": "NIFTY CONSUMPTION",
    "NIFTYCPSE": "NIFTY CPSE",
    "NIFTYENERGY": "NIFTY ENERGY",
    "NIFTYINFRA": "NIFTY INFRASTRUCTURE",
    "NIFTYMIDCAP50": "NIFTY MIDCAP 50",
    "NIFTYMIDCAP100": "NIFTY MIDCAP 100",
    "NIFTYSMALLCAP50": "NIFTY SMALLCAP 50",
    "NIFTYSMALLCAP100": "NIFTY SMALLCAP 100",
  };

  return mapping[symbol.toUpperCase()] || symbol;
}
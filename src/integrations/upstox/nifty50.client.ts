import { Nifty50Row } from "./nifty50.types";

/**
 * Official NIFTY 50 constituent CSV.
 */
const NIFTY_50_CSV_URL =
  "https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv";

/**
 * Hard fallback list so scanner/cache does not break
 * when the official CSV is temporarily unavailable.
 */
const FALLBACK_NIFTY_50_SYMBOLS = [
  "ADANIENT",
  "ADANIPORTS",
  "APOLLOHOSP",
  "ASIANPAINT",
  "AXISBANK",
  "BAJAJ-AUTO",
  "BAJFINANCE",
  "BAJAJFINSV",
  "BEL",
  "BHARTIARTL",
  "BPCL",
  "BRITANNIA",
  "CIPLA",
  "COALINDIA",
  "DRREDDY",
  "EICHERMOT",
  "ETERNAL",
  "GRASIM",
  "HCLTECH",
  "HDFCBANK",
  "HDFCLIFE",
  "HEROMOTOCO",
  "HINDALCO",
  "HINDUNILVR",
  "ICICIBANK",
  "INDUSINDBK",
  "INFY",
  "ITC",
  "JIOFIN",
  "JSWSTEEL",
  "KOTAKBANK",
  "LT",
  "M&M",
  "MARUTI",
  "NESTLEIND",
  "NTPC",
  "ONGC",
  "POWERGRID",
  "RELIANCE",
  "SBILIFE",
  "SBIN",
  "SHRIRAMFIN",
  "SUNPHARMA",
  "TATACONSUM",
  "TATAMOTORS",
  "TATASTEEL",
  "TCS",
  "TECHM",
  "TITAN",
  "TRENT",
] as const;

/**
 * Basic CSV parsing for simple constituent file.
 */
function parseSymbolsFromCsv(csvText: string): Set<string> {
  const lines = csvText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return new Set<string>();
  }

  const headers = lines[0].split(",").map((value) => value.trim());
  const symbolIndex = headers.findIndex((header) => header === "Symbol");

  if (symbolIndex === -1) {
    throw new Error("NIFTY 50 CSV does not contain a Symbol column.");
  }

  const rows: Nifty50Row[] = lines.slice(1).map((line) => {
    const columns = line.split(",").map((value) => value.trim());
    return {
      Symbol: columns[symbolIndex] || "",
    };
  });

  const symbols = rows
    .map((row) => row.Symbol.trim().toUpperCase())
    .filter(Boolean);

  return new Set(symbols);
}

/**
 * Downloads the official NIFTY 50 constituent CSV and returns the symbol set.
 * Falls back to a built-in static list if the remote source is unavailable.
 */
export async function fetchNifty50Symbols(): Promise<Set<string>> {
  try {
    const response = await fetch(NIFTY_50_CSV_URL, {
      headers: {
        "user-agent": "Mozilla/5.0",
        accept: "text/csv,text/plain,*/*",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch NIFTY 50 CSV: ${response.status} ${response.statusText}`
      );
    }

    const csvText = await response.text();
    const parsed = parseSymbolsFromCsv(csvText);

    if (parsed.size > 0) {
      console.log(
        `[nifty50] Loaded ${parsed.size} symbols from official CSV source.`
      );
      return parsed;
    }

    throw new Error("Official NIFTY 50 CSV returned no symbols.");
  } catch (error) {
    console.warn(
      "[nifty50] Official CSV unavailable. Using fallback NIFTY 50 symbol list.",
      error
    );

    return new Set(
      FALLBACK_NIFTY_50_SYMBOLS.map((symbol) => symbol.trim().toUpperCase())
    );
  }
}
import { Nifty200Row } from "./nifty200.types";

/**
 * Official NIFTY 200 constituent CSV.
 * We use this to define the top-stock universe instead of taking random
 * rows from the full Upstox NSE instruments file.
 */
const NIFTY_200_CSV_URL =
  "https://www.niftyindices.com/IndexConstituent/ind_nifty200list.csv";

/**
 * Downloads the official NIFTY 200 constituent CSV and returns the symbol set.
 */
export async function fetchNifty200Symbols(): Promise<Set<string>> {
  const response = await fetch(NIFTY_200_CSV_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch NIFTY 200 CSV: ${response.status} ${response.statusText}`
    );
  }

  const csvText = await response.text();
  const lines = csvText.split("\n").map((line) => line.trim()).filter(Boolean);

  if (lines.length < 2) {
    return new Set<string>();
  }

  const headers = lines[0].split(",").map((value) => value.trim());
  const symbolIndex = headers.findIndex((header) => header === "Symbol");

  if (symbolIndex === -1) {
    throw new Error("NIFTY 200 CSV does not contain a Symbol column.");
  }

  const rows: Nifty200Row[] = lines.slice(1).map((line) => {
    const columns = line.split(",").map((value) => value.trim());
    return {
      Symbol: columns[symbolIndex] || "",
    };
  });

  const symbols = rows
    .map((row) => row.Symbol)
    .filter(Boolean);

  return new Set(symbols);
}
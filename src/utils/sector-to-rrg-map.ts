import { STOCK_SECTOR_MAP } from "../integrations/upstox/sector-map";

/**
 * Maps business sectors to Nifty sectoral indices used in RRG
 */
const SECTOR_TO_RRG_INDEX: Record<string, string> = {
  "Banking": "NIFTYBANK",
  "Financial Services": "NIFTYBANK", // Close enough to banking
  "Information Technology": "NIFTYIT",
  "Pharmaceuticals": "NIFTYPHARMA",
  "Healthcare": "NIFTYPHARMA", // Pharma/Healthcare combined
  "Consumer Goods": "NIFTYFMCG",
  "Automobile": "NIFTYAUTO",
  "Automobile Components": "NIFTYAUTO",
  "Metals & Mining": "NIFTYMETAL",
  "Steel": "NIFTYMETAL",
  "Real Estate": "NIFTYREALTY",
  "Energy": "NIFTYENERGY",
  "Oil & Gas": "NIFTYENERGY",
  "Power": "NIFTYENERGY",
};

/**
 * Get RRG index symbol for a stock
 */
export function getRrgIndexForStock(stockSymbol: string): string | null {
  const sector = STOCK_SECTOR_MAP[stockSymbol];
  if (!sector) {
    return null;
  }

  return SECTOR_TO_RRG_INDEX[sector] || null;
}
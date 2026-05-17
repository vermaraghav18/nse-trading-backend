export type MarketIndexDef = {
  symbol: string;
  name: string;
  instrumentKey: string;
};

export const MARKET_INDICES: MarketIndexDef[] = [
  {
    symbol: "NIFTY50",
    name: "Nifty 50",
    instrumentKey: "NSE_INDEX|Nifty 50",
  },
  {
    symbol: "NIFTYBANK",
    name: "Nifty Bank",
    instrumentKey: "NSE_INDEX|Nifty Bank",
  },
  {
    symbol: "NIFTYIT",
    name: "Nifty IT",
    instrumentKey: "NSE_INDEX|Nifty IT",
  },
  {
    symbol: "NIFTYPHARMA",
    name: "Nifty Pharma",
    instrumentKey: "NSE_INDEX|Nifty Pharma",
  },
  {
    symbol: "NIFTYFMCG",
    name: "Nifty FMCG",
    instrumentKey: "NSE_INDEX|Nifty FMCG",
  },
  {
    symbol: "NIFTYAUTO",
    name: "Nifty Auto",
    instrumentKey: "NSE_INDEX|Nifty Auto",
  },
  {
    symbol: "NIFTYMETAL",
    name: "Nifty Metal",
    instrumentKey: "NSE_INDEX|Nifty Metal",
  },
  {
    symbol: "NIFTYPSUBANK",
    name: "Nifty PSU Bank",
    instrumentKey: "NSE_INDEX|Nifty PSU Bank",
  },
  {
    symbol: "NIFTYREALTY",
    name: "Nifty Realty",
    instrumentKey: "NSE_INDEX|Nifty Realty",
  },
  {
    symbol: "NIFTYFINSERVICE",
    name: "Nifty Financial Services",
    instrumentKey: "NSE_INDEX|Nifty Fin Service",
  },
];
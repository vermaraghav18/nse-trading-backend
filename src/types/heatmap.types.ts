export type HeatmapCell = {
  symbol: string;
  name: string;
  value: number;
  percentChange: number;
  previousClose: number;
  volume?: number; // Trading volume
  weightage?: number; // Stock weightage in index (if available)
  color: "green" | "red" | "gray";
  intensity: number; // 0-1 for color intensity based on % change
  
  // Futures Open Interest data (only for F&O eligible stocks)
  buildupType?: "LONG_BUILDUP" | "SHORT_BUILDUP" | "LONG_UNWINDING" | "SHORT_COVERING" | "NO_DATA";
  oiChangePct?: number | null;
  currentOi?: number | null;
  prevOi?: number | null;
  isFoEligible?: boolean;
};

export type HeatmapResponse = {
  ok: boolean;
  data: HeatmapCell[];
  timestamp: string;
  category: "indices" | "stocks";
};

export type HeatmapIndex = {
  symbol: string;
  name: string;
  category: string;
};
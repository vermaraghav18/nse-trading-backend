import { buildWeeklyScreener, WeeklyScreenerResponse } from "./weekly-screener.service";

const REFRESH_INTERVAL_MS = 60_000;

let cachedScreener: WeeklyScreenerResponse = { rows: [], updatedAt: "", stockCount: 0 };
let isRefreshing = false;

async function refresh(): Promise<void> {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    cachedScreener = await buildWeeklyScreener();
    console.log(`[weekly-screener-cache] Refreshed: ${cachedScreener.stockCount} stocks`);
  } catch (err) {
    console.error("[weekly-screener-cache] Refresh failed:", err);
  } finally {
    isRefreshing = false;
  }
}

export function getCachedWeeklyScreener(): WeeklyScreenerResponse {
  return cachedScreener;
}

export async function startWeeklyScreenerCache(): Promise<void> {
  await refresh();
  setInterval(() => { refresh().catch(console.error); }, REFRESH_INTERVAL_MS);
}
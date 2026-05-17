import { getCachedHistoricalSeries } from "./market-history-cache.service";
import { getCachedLiveCandles } from "./live-market-cache.service";
import { getCachedLiveBollinger } from "./live-bollinger-cache.service";
import { getLatestLtpcMap } from "./upstox-market-ws.service";
import { STOCK_SECTOR_MAP } from "../integrations/upstox/sector-map";
import { fetchUpstoxDailyCandles } from "../integrations/upstox/candles.client";
import { fetchOiForSymbol, FuturesOiData, isFoEligible } from "./futures-oi.service";

const NIFTY_INSTRUMENT_KEY = "NSE_INDEX|Nifty 50";

let cachedNiftyWeeklyReturn: number | null = null;
let niftyReturnFetchedAt: number = 0;
const NIFTY_CACHE_TTL_MS = 1000 * 60; // 60 seconds

type CandleRow = [string, number, number, number, number, number, number];

/**
 * Returns YYYY-MM-DD string for a Date in IST
 */
function toISTDateStr(date: Date): string {
  const ist = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, "0");
  const d = String(ist.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Find the close price for "same day last week" logic:
 * - Target = exactly 7 calendar days ago
 * - If that day has no candle (holiday/weekend), walk backwards
 *   to find nearest previous trading day
 */
function getSameWeekLastWeekClose(sorted: CandleRow[]): number | null {
  const todayStr = toISTDateStr(new Date());

  // Target date = 7 days ago
  const target = new Date();
  target.setDate(target.getDate() - 7);
  const targetStr = toISTDateStr(target);

  console.log(`[weekly-screener] Looking for base candle on or before: ${targetStr}`);

  // Find exact match first
  const exactMatch = sorted.find(c => {
    const d = toISTDateStr(new Date(c[0]));
    return d === targetStr;
  });

  if (exactMatch) {
    console.log(`[weekly-screener] Exact match found: ${targetStr} close=${exactMatch[4]}`);
    return exactMatch[4];
  }

  // No exact match (holiday) — find nearest trading day BEFORE target
  // Walk backwards through sorted candles
  const before = sorted
    .filter(c => toISTDateStr(new Date(c[0])) < targetStr)
    .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

  if (before.length > 0) {
    const nearest = before[0];
    console.log(`[weekly-screener] Holiday fallback: ${toISTDateStr(new Date(nearest[0]))} close=${nearest[4]}`);
    return nearest[4];
  }

  return null;
}

async function getNiftyWeeklyReturn(): Promise<number | null> {
  const now = Date.now();
  if (cachedNiftyWeeklyReturn !== null && now - niftyReturnFetchedAt < NIFTY_CACHE_TTL_MS) {
    return cachedNiftyWeeklyReturn;
  }

  try {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - 14); // 14 days back to safely cover last week
    const toDate = toISTDateStr(today);
    const fromDate = toISTDateStr(from);

    const response = await fetchUpstoxDailyCandles(NIFTY_INSTRUMENT_KEY, toDate, fromDate);
    const candles = response.data?.candles ?? [];

    if (candles.length < 2) return null;

    const sorted = [...candles].sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    ) as CandleRow[];

    console.log(`[weekly-screener] Nifty candles:`, sorted.map(c =>
      `${toISTDateStr(new Date(c[0]))}(${c[4]})`
    ).join(" | "));

    const baseClose = getSameWeekLastWeekClose(sorted);
    if (!baseClose || baseClose <= 0) return null;

    // Latest close = last candle in sorted
    const latestClose = sorted[sorted.length - 1][4];

    cachedNiftyWeeklyReturn = Number(
      (((latestClose - baseClose) / baseClose) * 100).toFixed(2)
    );
    niftyReturnFetchedAt = now;

    console.log(`[weekly-screener] Nifty base: ${baseClose}, latest: ${latestClose}, 1W return: ${cachedNiftyWeeklyReturn}%`);
    return cachedNiftyWeeklyReturn;
  } catch (err) {
    console.error("[weekly-screener] Failed to fetch Nifty weekly return:", err);
    return null;
  }
}

export type ScreenerSignalGrade = "WATCHING" | "COILING" | "BREAKOUT" | "NEUTRAL";

export type WeeklyScreenerRow = {
  symbol: string;
  sector: string;
  livePrice: number;
  weeklyReturnPct: number;
  dailyReturnPct: number;
  volumeSurgeRatio: number;
  avgWeeklyVolume: number;
  todayVolume: number;
  bbSqueeze: boolean;
  bbBandWidthPct: number;
  rsVsNifty: number | null;
 signalGrade: ScreenerSignalGrade;
  futuresOi: FuturesOiData | null;
  updatedAt: string;
};

export type WeeklyScreenerResponse = {
  rows: WeeklyScreenerRow[];
  updatedAt: string;
  stockCount: number;
};

const VOLUME_AVG_LOOKBACK = 10;
const BB_SQUEEZE_THRESHOLD = 4.0;

function resolveSignalGrade(
  weeklyReturnPct: number,
  volumeSurgeRatio: number,
  bbSqueeze: boolean,
  rsVsNifty: number | null,
  dailyReturnPct: number
): ScreenerSignalGrade {
  let score = 0;

  if (volumeSurgeRatio >= 3) score += 3;
  else if (volumeSurgeRatio >= 2) score += 2;
  else if (volumeSurgeRatio >= 1.5) score += 1;

  if (weeklyReturnPct >= 5) score += 2;
  else if (weeklyReturnPct >= 2) score += 1;

  if (bbSqueeze) score += 2;

  if (rsVsNifty !== null && rsVsNifty > 2) score += 2;
  else if (rsVsNifty !== null && rsVsNifty > 0) score += 1;

  const todayIsGreen = dailyReturnPct > 0;
  const volumeConfirmsDirection = volumeSurgeRatio >= 1.5 && todayIsGreen;

  if (score >= 5 && volumeConfirmsDirection) return "BREAKOUT";
  if (score >= 3) return "COILING";
  if (score >= 1) return "WATCHING";
  return "NEUTRAL";
}

export async function buildWeeklyScreener(): Promise<WeeklyScreenerResponse> {
  const historicalSeries = getCachedHistoricalSeries();
  const liveCandles = getCachedLiveCandles();
  const bollingerRows = getCachedLiveBollinger();
  const ltpcMap = getLatestLtpcMap();

  const now = new Date().toISOString();

  const liveCandleMap = new Map(liveCandles.map((c) => [c.symbol, c]));
  const bollingerMap = new Map(bollingerRows.map((b) => [b.symbol, b]));

  const niftyWeeklyReturn = await getNiftyWeeklyReturn();

  // Pre-calculate target date string (same for all stocks)
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - 7);
  const targetDateStr = toISTDateStr(targetDate);

  const rows: WeeklyScreenerRow[] = [];

  for (const series of historicalSeries) {
    const { symbol, instrumentKey, candles } = series;

    if (!candles || candles.length < VOLUME_AVG_LOOKBACK + 1) continue;

    const sorted = [...candles].sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
    ) as CandleRow[];

    // Weekly return: same day last week close → live price
    // Find exact match for targetDateStr, else nearest previous trading day
    let closeWeekAgo: number | null = null;

    const exactMatch = sorted.find(c => toISTDateStr(new Date(c[0])) === targetDateStr);
    if (exactMatch) {
      closeWeekAgo = exactMatch[4];
    } else {
      // Holiday fallback — nearest trading day before target
      const before = sorted
        .filter(c => toISTDateStr(new Date(c[0])) < targetDateStr)
        .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
      if (before.length > 0) closeWeekAgo = before[0][4];
    }

    if (!closeWeekAgo || closeWeekAgo <= 0) continue;

    const ltpcEntry = Array.from(ltpcMap.values()).find(
      (e) => e.instrumentKey === instrumentKey
    );
    const liveCandle = liveCandleMap.get(symbol);
    const livePrice = ltpcEntry?.ltp ?? liveCandle?.close ?? sorted[sorted.length - 1][4];

    if (!livePrice || livePrice <= 0) continue;

    const weeklyReturnPct = Number(
      (((livePrice - closeWeekAgo) / closeWeekAgo) * 100).toFixed(2)
    );

    // Daily return: live price vs yesterday's close
    const prevClose = liveCandle
      ? sorted[sorted.length - 1]?.[4] ?? 0
      : sorted[sorted.length - 2]?.[4] ?? 0;
    const dailyReturnPct = prevClose > 0
      ? Number((((livePrice - prevClose) / prevClose) * 100).toFixed(2))
      : 0;

    const historicalVolumes = sorted
      .slice(-(VOLUME_AVG_LOOKBACK + 1), -1)
      .map((c) => c[5] as number)
      .filter((v) => v > 0);

    const avgVolume =
      historicalVolumes.length > 0
        ? historicalVolumes.reduce((s, v) => s + v, 0) / historicalVolumes.length
        : 0;

    const todayVolume = liveCandle?.volume ?? (sorted[sorted.length - 1][5] as number) ?? 0;
    const volumeSurgeRatio =
      avgVolume > 0 ? Number((todayVolume / avgVolume).toFixed(2)) : 0;

    const bb = bollingerMap.get(symbol);
    const bbSqueeze = bb ? bb.bandWidthPercent <= BB_SQUEEZE_THRESHOLD : false;
    const bbBandWidthPct = bb?.bandWidthPercent ?? 0;

    const rsVsNifty =
      niftyWeeklyReturn !== null
        ? Number((weeklyReturnPct - niftyWeeklyReturn).toFixed(2))
        : null;

    const signalGrade = resolveSignalGrade(
      weeklyReturnPct,
      volumeSurgeRatio,
      bbSqueeze,
      rsVsNifty,
      dailyReturnPct
    );

    const sector = STOCK_SECTOR_MAP[symbol] ?? "Other";

   rows.push({
      symbol,
      sector,
      livePrice,
      weeklyReturnPct,
      dailyReturnPct,
      volumeSurgeRatio,
      avgWeeklyVolume: Math.round(avgVolume),
      todayVolume,
      bbSqueeze,
      bbBandWidthPct,
      rsVsNifty,
      signalGrade,
      futuresOi: null, // filled below for BREAKOUT stocks only
      updatedAt: now,
    });
  }

  const gradeOrder: Record<ScreenerSignalGrade, number> = {
    BREAKOUT: 0,
    COILING: 1,
    WATCHING: 2,
    NEUTRAL: 3,
  };

  rows.sort((a, b) => {
    if (gradeOrder[a.signalGrade] !== gradeOrder[b.signalGrade]) {
      return gradeOrder[a.signalGrade] - gradeOrder[b.signalGrade];
    }
    return b.weeklyReturnPct - a.weeklyReturnPct;
  });

  // Fetch OI only for BREAKOUT stocks — keeps API calls minimal
  const breakoutRows = rows.filter(r => r.signalGrade === "BREAKOUT");
  await Promise.all(
    breakoutRows.map(async (row) => {
      row.futuresOi = await fetchOiForSymbol(row.symbol);
    })
  );

  console.log(`[weekly-screener] OI fetched for ${breakoutRows.length} BREAKOUT stocks`);

  return { rows, updatedAt: now, stockCount: rows.length };
}
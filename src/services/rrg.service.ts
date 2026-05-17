import { getCachedIndexHistoricalSeries } from "./index-history-cache.service";

type HistoricalSeries = {
  instrumentKey: string;
  candles: [string, number, number, number, number, number, number][];
};

type MarketIndexDef = {
  symbol: string;
  name: string;
  instrumentKey: string;
};

type RrgPoint = {
  date: string;
  rsRatio: number;
  rsMomentum: number;
};

type RrgRow = {
  symbol: string;
  name: string;
  latestClose: number | null;
  tail: RrgPoint[];
  current: RrgPoint | null;
  quadrant: "LEADING" | "WEAKENING" | "LAGGING" | "IMPROVING";
};

type RrgResponse = {
  ok: true;
  benchmark: string;
  timeframe: "1D";
  rows: RrgRow[];
};

/**
 * IMPORTANT:
 * Replace these instrumentKeys with the exact keys you will use
 * for your index history cache.
 */
const MARKET_INDICES: MarketIndexDef[] = [
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
    instrumentKey: "NSE_INDEX|Nifty Financial Services",
  },
];

/**
 * TEMP:
 * You MUST replace this with your real index history cache source.
 * Example:
 * import { getCachedIndexHistoricalSeries } from "./index-history-cache.service";
 *
 * and then:
 * const historical = getCachedIndexHistoricalSeries();
 */
function roundTo2(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeAround100(values: number[]): number[] {
  if (values.length === 0) return [];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (!Number.isFinite(mean) || mean === 0) return values.map(() => 100);
  return values.map((value) => roundTo2((value / mean) * 100));
}

function classifyQuadrant(
  rsRatio: number,
  rsMomentum: number
): RrgRow["quadrant"] {
  if (rsRatio >= 100 && rsMomentum >= 100) return "LEADING";
  if (rsRatio >= 100 && rsMomentum < 100) return "WEAKENING";
  if (rsRatio < 100 && rsMomentum < 100) return "LAGGING";
  return "IMPROVING";
}

function getCloseSeries(series: HistoricalSeries): { date: string; close: number }[] {
  return [...series.candles]
    .reverse()
    .map((row) => ({
      date: row[0],
      close: row[4],
    }));
}

function tail<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}

export async function getIndexRrg1D(
  benchmark = "NIFTY50"
): Promise<RrgResponse> {
  const historical = getCachedIndexHistoricalSeries();

  if (historical.length === 0) {
    throw new Error(
      "Index historical cache is empty. Build index history ingestion first."
    );
  }

  const benchmarkIndex = MARKET_INDICES.find(
    (item) => item.symbol.trim().toUpperCase() === benchmark.trim().toUpperCase()
  );

  if (!benchmarkIndex) {
    throw new Error(
      `RRG benchmark '${benchmark}' was not found in MARKET_INDICES.`
    );
  }

  const benchmarkSeries = historical.find(
    (item) => item.instrumentKey === benchmarkIndex.instrumentKey
  );

  if (!benchmarkSeries) {
    throw new Error(
      `Historical series for benchmark '${benchmark}' was not found in index cache.`
    );
  }

  const benchmarkCloses = getCloseSeries(benchmarkSeries);
  const benchmarkMap = new Map(benchmarkCloses.map((row) => [row.date, row.close]));

  const rows: RrgRow[] = [];

  for (const index of MARKET_INDICES) {
    if (index.symbol.trim().toUpperCase() === benchmark.trim().toUpperCase()) {
      continue;
    }

    const series = historical.find(
      (item) => item.instrumentKey === index.instrumentKey
    );

    if (!series) continue;

    const closes = getCloseSeries(series);

    const rsRaw = closes
      .filter((row) => benchmarkMap.has(row.date))
      .map((row) => ({
        date: row.date,
        rs: row.close / (benchmarkMap.get(row.date) || row.close),
        close: row.close,
      }));

    if (rsRaw.length < 8) continue;

    const rsRatioSeries = normalizeAround100(rsRaw.map((r) => r.rs));

    const rsMomentumRaw = rsRatioSeries.map((value, index, arr) => {
      if (index === 0) return 100;
      return roundTo2(100 + (value - arr[index - 1]));
    });

    const rsMomentumSeries = normalizeAround100(rsMomentumRaw);

    const combined: RrgPoint[] = rsRaw.map((row, index) => ({
      date: row.date,
      rsRatio: rsRatioSeries[index],
      rsMomentum: rsMomentumSeries[index],
    }));

    const tailPoints = tail(combined, 60); // 60 trading days ≈ 12 weeks
    const current = tailPoints[tailPoints.length - 1] ?? null;

    if (!current) continue;

    rows.push({
      symbol: index.symbol,
      name: index.name,
      latestClose: rsRaw[rsRaw.length - 1]?.close ?? null,
      tail: tailPoints,
      current,
      quadrant: classifyQuadrant(current.rsRatio, current.rsMomentum),
    });
  }

  return {
    ok: true,
    benchmark,
    timeframe: "1D",
    rows,
  };
}
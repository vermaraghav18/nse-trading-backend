import path from "path";
import WebSocket from "ws";
import protobuf from "protobufjs";
import { env } from "../config/env";
import { getAllStocks } from "./stock.service";
import { rebuildLiveUniverse } from "./live-universe.service";
import { fetchUpstox1HCandles } from "../integrations/upstox/intraday-1h.client";

type WsConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

type UpstoxWsStatus = {
  state: WsConnectionState;
  authorizedUrlFetchedAt: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  lastMessageAt: string | null;
  lastMessageBytes: number;
  rawMessageCount: number;
  decodedMessageCount: number;
  reconnectCount: number;
  lastError: string | null;
  subscribedInstrumentKeys: string[];
  protoLoaded: boolean;
};

type DecodedFeedSnapshot = {
  receivedAt: string;
  messageType: string | null;
  currentTs: string | null;
  feeds: Record<string, unknown>;
  raw: unknown;
} | null;

type LiveLtpcData = {
  instrumentKey: string;
  ltp: number;
  ltt: string | null;
  ltq: number | null;
  cp: number | null;
  currentTs: string | null;
  receivedAt: string;
};

type LiveLtpcMap = Map<string, LiveLtpcData>;

type Upstox1HCandleRow = [string, number, number, number, number, number, number];

type Historical1HCacheEntry = {
  instrumentKey: string;
  candles: AggregatedCandle[];
  fetchedAt: string;
};

export type LiveMinuteCandle = {
  instrumentKey: string;
  minuteStart: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  lastTradeTime: string | null;
  updatedAt: string;
};

export type AggregatedCandle = {
  instrumentKey: string;
  bucketStart: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  lastTradeTime: string | null;
  updatedAt: string;
};

type LiveMinuteCandleMap = Map<string, LiveMinuteCandle[]>;

const WS_MODE = "ltpc";
const MAX_MINUTE_CANDLES_PER_INSTRUMENT = 4000;
const HISTORICAL_LOOKBACK_DAYS = 90;
const HISTORICAL_1H_WARM_BATCH_SIZE = 3;
const HISTORICAL_1H_WARM_BATCH_DELAY_MS = 1200;
const MAX_WS_INSTRUMENTS = 60;

let subscribedInstrumentKeys: string[] = [];

let socket: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let manuallyStopped = false;

let protoRoot: protobuf.Root | null = null;
let feedResponseType: protobuf.Type | null = null;

let latestDecodedFeed: DecodedFeedSnapshot = null;
let latestLtpcMap: LiveLtpcMap = new Map();
let latestMinuteCandleMap: LiveMinuteCandleMap = new Map();
let historical1HCache: Map<string, Historical1HCacheEntry> = new Map();
let historical1HInflight: Map<string, Promise<AggregatedCandle[]>> = new Map();

const status: UpstoxWsStatus = {
  state: "idle",
  authorizedUrlFetchedAt: null,
  connectedAt: null,
  disconnectedAt: null,
  lastMessageAt: null,
  lastMessageBytes: 0,
  rawMessageCount: 0,
  decodedMessageCount: 0,
  reconnectCount: 0,
  lastError: null,
  subscribedInstrumentKeys: [],
  protoLoaded: false,
};

function nowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildSubscriptionPayload(instrumentKeys: string[]) {
  return {
    guid: `ws-${Date.now()}`,
    method: "sub",
    data: {
      mode: WS_MODE,
      instrumentKeys,
    },
  };
}

async function loadAllInstrumentKeys(): Promise<string[]> {
  const stocks = await getAllStocks();

  const keys = stocks
    .map((stock) => String(stock.instrumentKey || "").trim())
    .filter(Boolean);

  return Array.from(new Set(keys));
}

async function mapSymbolsToInstrumentKeys(symbols: string[]): Promise<string[]> {
  const symbolSet = new Set(symbols.map((symbol) => symbol.trim().toUpperCase()));
  const stocks = await getAllStocks();

  const keys = stocks
    .filter((stock) => symbolSet.has(String(stock.symbol || "").trim().toUpperCase()))
    .map((stock) => String(stock.instrumentKey || "").trim())
    .filter(Boolean);

  return Array.from(new Set(keys)).slice(0, MAX_WS_INSTRUMENTS);
}

async function loadInstrumentKeysForWebsocket(): Promise<string[]> {
  const liveSymbols = rebuildLiveUniverse();

  if (liveSymbols.length === 0) {
    const allKeys = await loadAllInstrumentKeys();
    return allKeys.slice(0, MAX_WS_INSTRUMENTS);
  }

  return mapSymbolsToInstrumentKeys(liveSymbols);
}

async function getAuthorizedRedirectUri(): Promise<string> {
  const response = await fetch(
    "https://api.upstox.com/v3/feed/market-data-feed/authorize",
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.upstoxAnalyticsToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to authorize Upstox market websocket: ${response.status} ${response.statusText} ${errorText}`
    );
  }

  const json = (await response.json()) as {
    status?: string;
    data?: {
      authorized_redirect_uri?: string;
    };
  };

  const uri = json?.data?.authorized_redirect_uri;

  if (!uri) {
    throw new Error(
      "Upstox websocket authorize response did not return authorized_redirect_uri."
    );
  }

  status.authorizedUrlFetchedAt = nowIso();
  return uri;
}

async function ensureProtoLoaded(): Promise<void> {
  if (protoRoot && feedResponseType) {
    return;
  }

  const protoPath = path.join(
    process.cwd(),
    "src",
    "proto",
    "MarketDataFeedV3.proto"
  );

  protoRoot = await protobuf.load(protoPath);

  const availableTypes = Object.keys(protoRoot.nested ?? {});
  console.log("[upstox-market-ws] Proto top-level namespaces:", availableTypes);

  const tryTypeNames = [
    "com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse",
  ];

  for (const typeName of tryTypeNames) {
    try {
      const resolvedType = protoRoot.lookupType(typeName);

      if (resolvedType instanceof protobuf.Type) {
        feedResponseType = resolvedType;
        status.protoLoaded = true;
        console.log("[upstox-market-ws] Using protobuf type:", typeName);
        return;
      }
    } catch {
      // ignore
    }
  }

  throw new Error(
    "Could not find a valid protobuf message type in MarketDataFeedV3.proto."
  );
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (manuallyStopped) return;

  clearReconnectTimer();

  reconnectTimer = setTimeout(() => {
    startUpstoxMarketWs().catch((error) => {
      status.state = "error";
      status.lastError =
        error instanceof Error ? error.message : "Unknown reconnect error";
      scheduleReconnect();
    });
  }, 5000);
}

function normalizeDecodedMessage(decoded: unknown): DecodedFeedSnapshot {
  const raw = decoded as Record<string, unknown> | null;

  if (!raw || typeof raw !== "object") {
    return {
      receivedAt: nowIso(),
      messageType: null,
      currentTs: null,
      feeds: {},
      raw: decoded,
    };
  }

  const messageType = typeof raw.type === "string" ? raw.type : null;

  const currentTs =
    typeof raw.currentTs === "string" || typeof raw.currentTs === "number"
      ? String(raw.currentTs)
      : null;

  const feeds =
    raw.feeds && typeof raw.feeds === "object"
      ? (raw.feeds as Record<string, unknown>)
      : {};

  return {
    receivedAt: nowIso(),
    messageType,
    currentTs,
    feeds,
    raw,
  };
}

function toIsoFromEpochMillis(
  value: string | number | null | undefined
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  return new Date(numericValue).toISOString();
}

function getMinuteStartIso(isoString: string): string {
  const d = new Date(isoString);
  d.setSeconds(0, 0);
  return d.toISOString();
}

function getHourBucketStartIso(
  isoString: string,
  bucketHours: 1 | 2
): string {
  const source = new Date(isoString);

  if (Number.isNaN(source.getTime())) {
    return isoString;
  }

  const IST_OFFSET_MINUTES = 330;
  const bucketMinutes = bucketHours * 60;
  const marketStartMinutes = 9 * 60 + 15; // 09:15 IST

  // shift into IST clock space
  const istMs = source.getTime() + IST_OFFSET_MINUTES * 60 * 1000;
  const istDate = new Date(istMs);

  const istHour = istDate.getUTCHours();
  const istMinute = istDate.getUTCMinutes();
  const totalIstMinutes = istHour * 60 + istMinute;

  let bucketStartMinutes = marketStartMinutes;

  if (totalIstMinutes > marketStartMinutes) {
    const elapsed = totalIstMinutes - marketStartMinutes;
    bucketStartMinutes =
      marketStartMinutes + Math.floor(elapsed / bucketMinutes) * bucketMinutes;
  }

  const bucketIst = new Date(
    Date.UTC(
      istDate.getUTCFullYear(),
      istDate.getUTCMonth(),
      istDate.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );

  bucketIst.setUTCMinutes(bucketStartMinutes, 0, 0);

  // shift back from IST clock space to real UTC timestamp
  return new Date(
    bucketIst.getTime() - IST_OFFSET_MINUTES * 60 * 1000
  ).toISOString();
}

function toDateStringIst(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dedupeAndSortAggregatedCandles(
  candles: AggregatedCandle[]
): AggregatedCandle[] {
  const latestByBucket = new Map<string, AggregatedCandle>();

  for (const candle of candles) {
    latestByBucket.set(candle.bucketStart, candle);
  }

  return Array.from(latestByBucket.values()).sort((a, b) =>
    a.bucketStart < b.bucketStart ? -1 : a.bucketStart > b.bucketStart ? 1 : 0
  );
}

function mapRowsTo1HCandles(
  instrumentKey: string,
  rows: Upstox1HCandleRow[]
): AggregatedCandle[] {
  const reversed = [...rows].reverse();

  const mapped = reversed.map((row) => ({
    instrumentKey,
    bucketStart: getHourBucketStartIso(row[0], 1),
    open: row[1],
    high: row[2],
    low: row[3],
    close: row[4],
    volume: row[5],
    lastTradeTime: row[0],
    updatedAt: nowIso(),
  }));

  return dedupeAndSortAggregatedCandles(mapped);
}

function updateMinuteCandleFromLtpc(data: LiveLtpcData): void {
  const referenceIso =
    toIsoFromEpochMillis(data.ltt) ||
    toIsoFromEpochMillis(data.currentTs) ||
    data.receivedAt;

  if (!referenceIso) {
    return;
  }

  const minuteStart = getMinuteStartIso(referenceIso);
  const existing = latestMinuteCandleMap.get(data.instrumentKey) ?? [];
  const last = existing[existing.length - 1];

  if (!last || last.minuteStart !== minuteStart) {
    const nextCandle: LiveMinuteCandle = {
      instrumentKey: data.instrumentKey,
      minuteStart,
      open: data.ltp,
      high: data.ltp,
      low: data.ltp,
      close: data.ltp,
      volume: data.ltq ?? 0,
      lastTradeTime: toIsoFromEpochMillis(data.ltt),
      updatedAt: data.receivedAt,
    };

    latestMinuteCandleMap.set(
      data.instrumentKey,
      [...existing, nextCandle].slice(-MAX_MINUTE_CANDLES_PER_INSTRUMENT)
    );
    return;
  }

  last.high = Math.max(last.high, data.ltp);
  last.low = Math.min(last.low, data.ltp);
  last.close = data.ltp;
  last.volume += data.ltq ?? 0;
  last.lastTradeTime = toIsoFromEpochMillis(data.ltt);
  last.updatedAt = data.receivedAt;
}

function updateLatestLtpcMap(snapshot: DecodedFeedSnapshot): void {
  if (!snapshot || !snapshot.feeds) {
    return;
  }

  for (const [instrumentKey, feedValue] of Object.entries(snapshot.feeds)) {
    if (!feedValue || typeof feedValue !== "object") {
      continue;
    }

    const feedObject = feedValue as Record<string, unknown>;
    const ltpcValue = feedObject.ltpc;

    if (!ltpcValue || typeof ltpcValue !== "object") {
      continue;
    }

    const ltpcObject = ltpcValue as Record<string, unknown>;

    const ltp =
      typeof ltpcObject.ltp === "number" ? ltpcObject.ltp : null;

    if (ltp === null) {
      continue;
    }

    const ltt =
      typeof ltpcObject.ltt === "string" || typeof ltpcObject.ltt === "number"
        ? String(ltpcObject.ltt)
        : null;

    const ltq =
      typeof ltpcObject.ltq === "number" ? ltpcObject.ltq : null;

    const cp =
      typeof ltpcObject.cp === "number" ? ltpcObject.cp : null;

    const liveData: LiveLtpcData = {
      instrumentKey,
      ltp,
      ltt,
      ltq,
      cp,
      currentTs: snapshot.currentTs,
      receivedAt: snapshot.receivedAt,
    };

    latestLtpcMap.set(instrumentKey, liveData);
    updateMinuteCandleFromLtpc(liveData);
  }
}

function decodeFeedBuffer(buffer: Buffer): DecodedFeedSnapshot {
  if (!feedResponseType) {
    throw new Error("FeedResponse protobuf type is not loaded.");
  }

  const message = feedResponseType.decode(buffer);
  const object = feedResponseType.toObject(message, {
    longs: String,
    enums: String,
    defaults: false,
    arrays: true,
    objects: true,
  });

  status.decodedMessageCount += 1;
  return normalizeDecodedMessage(object);
}

function aggregateMinuteCandlesToBuckets(
  instrumentKey: string,
  bucketHours: 1 | 2
): AggregatedCandle[] {
  const minuteCandles = latestMinuteCandleMap.get(instrumentKey) ?? [];

  if (minuteCandles.length === 0) {
    return [];
  }

  const grouped = new Map<string, AggregatedCandle>();

  for (const candle of minuteCandles) {
    const bucketStart = getHourBucketStartIso(candle.minuteStart, bucketHours);
    const existing = grouped.get(bucketStart);

    if (!existing) {
      grouped.set(bucketStart, {
        instrumentKey,
        bucketStart,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        lastTradeTime: candle.lastTradeTime,
        updatedAt: candle.updatedAt,
      });
      continue;
    }

    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
    existing.lastTradeTime = candle.lastTradeTime;
    existing.updatedAt = candle.updatedAt;
  }

  return dedupeAndSortAggregatedCandles(Array.from(grouped.values()));
}

function aggregate1HTo2H(candles1H: AggregatedCandle[]): AggregatedCandle[] {
  return dedupeAndSortAggregatedCandles(
    candles1H.map((candle) => ({
      ...candle,
      bucketStart: getHourBucketStartIso(candle.bucketStart, 2),
    }))
  ).map((bucket) => {
    const sourceCandles = candles1H.filter(
      (c) => getHourBucketStartIso(c.bucketStart, 2) === bucket.bucketStart
    );

    const first = sourceCandles[0];
    const last = sourceCandles[sourceCandles.length - 1];

    return {
      instrumentKey: bucket.instrumentKey,
      bucketStart: bucket.bucketStart,
      open: first.open,
      high: Math.max(...sourceCandles.map((c) => c.high)),
      low: Math.min(...sourceCandles.map((c) => c.low)),
      close: last.close,
      volume: sourceCandles.reduce((sum, c) => sum + c.volume, 0),
      lastTradeTime: last.lastTradeTime,
      updatedAt: last.updatedAt,
    };
  });
}

async function ensureHistorical1HBackfill(
  instrumentKey: string
): Promise<AggregatedCandle[]> {
  const cached = historical1HCache.get(instrumentKey);
  if (cached) {
    return cached.candles;
  }

  const inflight = historical1HInflight.get(instrumentKey);
  if (inflight) {
    return inflight;
  }

  const requestPromise = (async (): Promise<AggregatedCandle[]> => {
    const today = new Date();
    const toDate = toDateStringIst(today);
    const fromDate = toDateStringIst(addDays(today, -HISTORICAL_LOOKBACK_DAYS));

    const historicalResponse = await fetchUpstox1HCandles(
      instrumentKey,
      toDate,
      fromDate
    );

    const historicalRows = historicalResponse.data?.candles ?? [];
    const combined = mapRowsTo1HCandles(instrumentKey, historicalRows);

    if (combined.length === 0) {
      throw new Error(
        `Failed to build 1H backfill for ${instrumentKey}: no historical 1H candles available.`
      );
    }

    historical1HCache.set(instrumentKey, {
      instrumentKey,
      candles: combined,
      fetchedAt: nowIso(),
    });

    return combined;
  })();

  historical1HInflight.set(instrumentKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    historical1HInflight.delete(instrumentKey);
  }
}

function mergeHistoricalAndLive1H(
  historicalCandles: AggregatedCandle[],
  liveCandles: AggregatedCandle[]
): AggregatedCandle[] {
  return dedupeAndSortAggregatedCandles([
    ...historicalCandles,
    ...liveCandles,
  ]);
}

export async function warmHistorical1HCache(): Promise<void> {
    const instrumentKeys = await loadAllInstrumentKeys();

  console.log(
    `[upstox-market-ws] Starting 1H historical warmup for ${instrumentKeys.length} instruments.`
  );

  for (
    let index = 0;
    index < instrumentKeys.length;
    index += HISTORICAL_1H_WARM_BATCH_SIZE
  ) {
    const batch = instrumentKeys.slice(
      index,
      index + HISTORICAL_1H_WARM_BATCH_SIZE
    );

    await Promise.allSettled(
      batch.map((instrumentKey) => ensureHistorical1HBackfill(instrumentKey))
    );

    if (index + HISTORICAL_1H_WARM_BATCH_SIZE < instrumentKeys.length) {
      await sleep(HISTORICAL_1H_WARM_BATCH_DELAY_MS);
    }
  }

  console.log(
    `[upstox-market-ws] Completed 1H historical warmup. Cached instruments: ${historical1HCache.size}`
  );
}

export async function startUpstoxMarketWs(): Promise<void> {
  await ensureProtoLoaded();

  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  manuallyStopped = false;
  status.state = "connecting";
  status.lastError = null;

  subscribedInstrumentKeys = await loadInstrumentKeysForWebsocket();
  status.subscribedInstrumentKeys = [...subscribedInstrumentKeys];

  const wsUrl = await getAuthorizedRedirectUri();
  socket = new WebSocket(wsUrl);

  socket.on("open", () => {
    status.state = "connected";
    status.connectedAt = nowIso();
    status.lastError = null;

    const payload = buildSubscriptionPayload(subscribedInstrumentKeys);
    socket?.send(Buffer.from(JSON.stringify(payload)));

    console.log("[upstox-market-ws] Connected.");
         console.log(
      `[upstox-market-ws] Subscribed ${payload.data.instrumentKeys.length} live instruments (dynamic cap ${MAX_WS_INSTRUMENTS}).`
    );
  });

  socket.on("message", (data) => {
    const buffer =
      typeof data === "string"
        ? Buffer.from(data)
        : Buffer.isBuffer(data)
          ? data
          : data instanceof ArrayBuffer
            ? Buffer.from(data)
            : Array.isArray(data)
              ? Buffer.concat(data)
              : Buffer.alloc(0);

    status.lastMessageAt = nowIso();
    status.lastMessageBytes = buffer.length;
    status.rawMessageCount += 1;

    if (buffer.length === 0) {
      return;
    }

    try {
      latestDecodedFeed = decodeFeedBuffer(buffer);
      updateLatestLtpcMap(latestDecodedFeed);
      status.lastError = null;
    } catch (error) {
      status.lastError =
        error instanceof Error ? error.message : "Unknown decode error";
    }
  });

  socket.on("close", () => {
    status.state = "disconnected";
    status.disconnectedAt = nowIso();
    console.warn("[upstox-market-ws] Disconnected.");
    socket = null;
    scheduleReconnect();
  });

  socket.on("error", (error) => {
    status.state = "error";
    status.lastError = error.message;
    console.error("[upstox-market-ws] Error:", error.message);
  });
}

export async function stopUpstoxMarketWs(): Promise<void> {
  manuallyStopped = true;
  clearReconnectTimer();

  if (!socket) return;

  await new Promise<void>((resolve) => {
    socket?.once("close", () => resolve());
    socket?.close();
  });

  socket = null;
  status.state = "disconnected";
  status.disconnectedAt = nowIso();
}

export function getUpstoxMarketWsStatus(): UpstoxWsStatus {
  return {
    ...status,
    subscribedInstrumentKeys: [...status.subscribedInstrumentKeys],
  };
}

export function getLatestDecodedFeed(): DecodedFeedSnapshot {
  return latestDecodedFeed;
}

export function getLatestDecodedInstrumentFeed(
  instrumentKey: string
): unknown | null {
  if (!latestDecodedFeed) return null;
  return latestDecodedFeed.feeds?.[instrumentKey] ?? null;
}

export function getLatestLtpcMap(): LiveLtpcMap {
  return new Map(latestLtpcMap);
}

export function getLatestLtpcByInstrument(
  instrumentKey: string
): LiveLtpcData | null {
  return latestLtpcMap.get(instrumentKey) ?? null;
}

export function getLatestMinuteCandleMap(): LiveMinuteCandleMap {
  const copy: LiveMinuteCandleMap = new Map();

  for (const [instrumentKey, candles] of latestMinuteCandleMap.entries()) {
    copy.set(instrumentKey, candles.map((candle) => ({ ...candle })));
  }

  return copy;
}

export function getLatestMinuteCandlesByInstrument(
  instrumentKey: string
): LiveMinuteCandle[] {
  const candles = latestMinuteCandleMap.get(instrumentKey) ?? [];
  return candles.map((candle) => ({ ...candle }));
}

export async function getMerged1HCandlesByInstrument(
  instrumentKey: string
): Promise<AggregatedCandle[]> {
  const historical = await ensureHistorical1HBackfill(instrumentKey);
  const live = aggregateMinuteCandlesToBuckets(instrumentKey, 1);
  return mergeHistoricalAndLive1H(historical, live);
}

export async function getMerged2HCandlesByInstrument(
  instrumentKey: string
): Promise<AggregatedCandle[]> {
  const merged1H = await getMerged1HCandlesByInstrument(instrumentKey);
  return aggregate1HTo2H(merged1H);
}

export function forceReconnectUpstoxMarketWs(): void {
  status.reconnectCount += 1;
  void stopUpstoxMarketWs().finally(() => {
    void startUpstoxMarketWs();
  });
}
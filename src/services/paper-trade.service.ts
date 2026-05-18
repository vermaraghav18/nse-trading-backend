import {
  PaperTrade,
  PaperTradeSignalSource,
  PaperTradeExitReason,
  PaperTradeSummary,
} from "../types/paper-trade.types";
import { buildDetailedExitReason } from "./exit-reason-builder.service";
import { getCachedLiveCandles } from "./live-market-cache.service";
import { getDatabase } from "../lib/mongodb";

const COLLECTION_NAME = "paper-trades";
let paperTrades: PaperTrade[] = [];

// ─── Persistence ────────────────────────────────────────

export async function loadTradesFromDisk(): Promise<void> {
  try {
    const db = await getDatabase();
    const saved = await db.collection(COLLECTION_NAME)
      .find({})
      .toArray() as any[];
    
    if (saved && Array.isArray(saved)) {
      // Migrate old trades that don't have new MTF fields
      paperTrades = saved.map((t) => ({
        ...t,
        peakPrice: t.peakPrice ?? t.currentPrice ?? t.entryPrice,
        consecutive1HBelowMiddle: t.consecutive1HBelowMiddle ?? 0,
      }));
      console.log(`[paper-trade] Loaded ${paperTrades.length} trades from MongoDB.`);
    }
  } catch (error) {
    console.error('[paper-trade] Failed to load trades from MongoDB:', error);
    paperTrades = [];
  }
}

async function saveTradesToDisk(): Promise<void> {
  try {
    const db = await getDatabase();
    // Clear existing trades and insert all
    await db.collection(COLLECTION_NAME).deleteMany({});
    if (paperTrades.length > 0) {
      await db.collection(COLLECTION_NAME).insertMany(paperTrades as any[]);
    }
  } catch (error) {
    console.error('[paper-trade] Failed to save trades to MongoDB:', error);
  }
}

// ─── Create trade ───────────────────────────────────────

export async function createPaperTrade(input: {
  symbol: string;
  entryPrice: number;
  signalSource: PaperTradeSignalSource;
  reason: string;
  stopLossLevel: number | null;
  targetResistance: number | null;
}): Promise<PaperTrade> {
  const trade: PaperTrade = {
    id: `PT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    symbol: input.symbol.trim().toUpperCase(),
    side: "BUY",
    quantity: 1,
    entryPrice: input.entryPrice,
    entryDate: new Date().toISOString(),
    entrySignalSource: input.signalSource,
    entryReason: input.reason,
    currentPrice: input.entryPrice,
    unrealizedPnL: 0,
    unrealizedPnLPercent: 0,
    exitPrice: null,
    exitDate: null,
    exitReason: null,
    exitReasonDetailed: null,
    realizedPnL: null,
    realizedPnLPercent: null,
    status: "OPEN",
    holdingDays: 0,
    stopLossLevel: input.stopLossLevel,
    targetResistance: input.targetResistance,
    peakPrice: input.entryPrice,
    consecutive1HBelowMiddle: 0,
  };
  paperTrades.push(trade);
  await saveTradesToDisk();
  console.log(`[paper-trade] OPENED: ${trade.symbol} @ ₹${trade.entryPrice} | Signal: ${trade.entrySignalSource}`);
  return trade;
}

// ─── Close trade ────────────────────────────────────────

export async function closePaperTrade(
  id: string,
  exitPrice: number,
  exitReason: PaperTradeExitReason
): Promise<PaperTrade | null> {
  const trade = paperTrades.find((t) => t.id === id);
  if (!trade || trade.status === "CLOSED") return null;

  trade.status = "CLOSED";
  trade.exitPrice = exitPrice;
  trade.exitDate = new Date().toISOString();
  trade.exitReason = exitReason;
  trade.exitReasonDetailed = buildDetailedExitReason(trade, exitPrice, exitReason);
  trade.currentPrice = exitPrice;

  const pnl = exitPrice - trade.entryPrice;
  trade.realizedPnL = Math.round(pnl * 100) / 100;
  trade.realizedPnLPercent =
    trade.entryPrice === 0
      ? 0
      : Math.round(((pnl / trade.entryPrice) * 100) * 100) / 100;
  trade.unrealizedPnL = 0;
  trade.unrealizedPnLPercent = 0;

  await saveTradesToDisk();
  console.log(
    `[paper-trade] CLOSED: ${trade.symbol} @ ₹${exitPrice} | P&L: ${trade.realizedPnLPercent}% | Reason: ${exitReason}`
  );
  console.log(`[paper-trade] Detail: ${trade.exitReasonDetailed}`);
  return trade;
}

// ─── Check if open trade exists ─────────────────────────

export function hasOpenTrade(symbol: string): boolean {
  const normalized = symbol.trim().toUpperCase();
  return paperTrades.some(
    (t) => t.symbol === normalized && t.status === "OPEN"
  );
}

export function getOpenTrade(symbol: string): PaperTrade | null {
  const normalized = symbol.trim().toUpperCase();
  return (
    paperTrades.find(
      (t) => t.symbol === normalized && t.status === "OPEN"
    ) ?? null
  );
}

export function wasRecentlyClosed(symbol: string): boolean {
  const normalized = symbol.trim().toUpperCase();
  const recentlyClosed = paperTrades.find(
    (t) =>
      t.symbol === normalized &&
      t.status === "CLOSED" &&
      t.exitDate !== null &&
      Date.now() - new Date(t.exitDate).getTime() < 24 * 60 * 60 * 1000
  );
  return !!recentlyClosed;
}

// ─── Sync live prices ───────────────────────────────────

export function syncPaperTradesWithMarket(): void {
  const candles = getCachedLiveCandles();

  for (const trade of paperTrades) {
    if (trade.status !== "OPEN") continue;

    const candle = candles.find((c) => c.symbol === trade.symbol);
    if (!candle) continue;

    trade.currentPrice = candle.close;

    // Track peak price for trailing stop
    if (candle.close > trade.peakPrice) {
      trade.peakPrice = candle.close;
    }

    const pnl = candle.close - trade.entryPrice;
    trade.unrealizedPnL = Math.round(pnl * 100) / 100;
    trade.unrealizedPnLPercent =
      trade.entryPrice === 0
        ? 0
        : Math.round(((pnl / trade.entryPrice) * 100) * 100) / 100;

    // Calculate holding days
    const entryMs = new Date(trade.entryDate).getTime();
    const nowMs = Date.now();
    trade.holdingDays = Math.floor((nowMs - entryMs) / (1000 * 60 * 60 * 24));
  }
}

// ─── Portfolio summary ──────────────────────────────────

export function computeSummary(): PaperTradeSummary {
  const closed = paperTrades.filter((t) => t.status === "CLOSED");
  const open = paperTrades.filter((t) => t.status === "OPEN");

  const totalInvested = closed.reduce((sum, t) => sum + t.entryPrice, 0);
  const totalReturns = closed.reduce((sum, t) => sum + (t.realizedPnL ?? 0), 0);

  const winCount = closed.filter((t) => (t.realizedPnL ?? 0) > 0).length;
  const lossCount = closed.filter((t) => (t.realizedPnL ?? 0) < 0).length;

  const totalProfitPercent = totalInvested === 0 ? 0 : Math.round(((totalReturns / totalInvested) * 100) * 100) / 100;

  const openUnrealized = open.reduce((sum, t) => sum + t.unrealizedPnL, 0);
  const netPnL = Math.round((totalReturns + openUnrealized) * 100) / 100;

  // Portfolio-style metrics
  const currentInvested = open.reduce((sum, t) => sum + t.entryPrice, 0);
  const currentValue = open.reduce((sum, t) => sum + t.currentPrice, 0);
  const overallInvested = currentInvested + totalInvested;
  const overallValue = currentValue + totalInvested + totalReturns;

  return {
    totalTrades: paperTrades.length,
    openTrades: open.length,
    closedTrades: closed.length,
    totalInvested: Math.round(totalInvested * 100) / 100,
    totalReturns: Math.round(totalReturns * 100) / 100,
    totalProfitPercent,
    winCount,
    lossCount,
    winRate: closed.length === 0 ? 0 : Math.round((winCount / closed.length) * 100 * 100) / 100,
    netPnL,
    currentInvested: Math.round(currentInvested * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    overallInvested: Math.round(overallInvested * 100) / 100,
    overallValue: Math.round(overallValue * 100) / 100,
    todaysPnL: Math.round(openUnrealized * 100) / 100,
  };
}

// ─── Get all trades ─────────────────────────────────────

export function getPaperTrades(): {
  trades: PaperTrade[];
  summary: PaperTradeSummary;
} {
  syncPaperTradesWithMarket();
  return {
    trades: [...paperTrades].sort((a, b) => {
      // Open first, then by date descending
      if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
      return new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime();
    }),
    summary: computeSummary(),
  };
}

// ─── Update 1H consecutive below middle band count ───

export function update1HConsecutiveCount(
  symbol: string,
  is1HBelowMiddle: boolean
): void {
  const normalized = symbol.trim().toUpperCase();
  const trade = paperTrades.find(
    (t) => t.symbol === normalized && t.status === "OPEN"
  );
  if (!trade) return;

  if (is1HBelowMiddle) {
    trade.consecutive1HBelowMiddle += 1;
  } else {
    trade.consecutive1HBelowMiddle = 0;
  }
}
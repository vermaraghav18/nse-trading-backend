import {
  EnhancedTradeJournal,
  EntrySnapshot,
  ExitSnapshot,
} from "./market-context-snapshot.service";
import {
  readJsonCacheFile,
  writeJsonCacheFile,
} from "../utils/file-cache";

const JOURNAL_FILE = "enhanced-trade-journal.json";
let enhancedJournal: EnhancedTradeJournal[] = [];

/**
 * Load enhanced journal from disk
 */
export async function loadEnhancedJournalFromDisk(): Promise<void> {
  const saved = await readJsonCacheFile<EnhancedTradeJournal[]>(JOURNAL_FILE);
  if (saved && Array.isArray(saved)) {
    enhancedJournal = saved;
    console.log(`[enhanced-journal] Loaded ${enhancedJournal.length} enhanced trades from disk.`);
  }
}

/**
 * Save enhanced journal to disk
 */
async function saveEnhancedJournalToDisk(): Promise<void> {
  await writeJsonCacheFile(JOURNAL_FILE, enhancedJournal);
}

/**
 * Create new enhanced trade entry
 */
export function createEnhancedTradeEntry(
  tradeId: string,
  symbol: string,
  entrySnapshot: EntrySnapshot
): void {
  const enhancedTrade: EnhancedTradeJournal = {
    id: tradeId,
    symbol,
    status: "OPEN",
    entry: entrySnapshot,
    tracking: {
      peakPrice: entrySnapshot.price,
      peakPriceTime: null,
      lowestPrice: entrySnapshot.price,
      lowestPriceTime: null,
      consecutive1HBelowMiddle: 0,
      holdingDays: 0,
    },
    exit: null,
    metrics: null,
    tags: [],
  };

  enhancedJournal.push(enhancedTrade);
  saveEnhancedJournalToDisk();
  
  console.log(`[enhanced-journal] Created entry for ${symbol} (${tradeId})`);
}

/**
 * Update tracking data for an open trade
 */
export function updateEnhancedTradeTracking(
  tradeId: string,
  currentPrice: number,
  consecutive1HBelowMiddle: number,
  holdingDays: number
): void {
  const trade = enhancedJournal.find((t) => t.id === tradeId);
  if (!trade || trade.status === "CLOSED") return;

  const now = new Date().toISOString();

  // Track peak
  if (currentPrice > trade.tracking.peakPrice) {
    trade.tracking.peakPrice = currentPrice;
    trade.tracking.peakPriceTime = now;
  }

  // Track lowest
  if (currentPrice < trade.tracking.lowestPrice) {
    trade.tracking.lowestPrice = currentPrice;
    trade.tracking.lowestPriceTime = now;
  }

  trade.tracking.consecutive1HBelowMiddle = consecutive1HBelowMiddle;
  trade.tracking.holdingDays = holdingDays;

  saveEnhancedJournalToDisk();
}

/**
 * Close enhanced trade with exit snapshot
 */
export function closeEnhancedTrade(
  tradeId: string,
  exitSnapshot: ExitSnapshot
): void {
  const trade = enhancedJournal.find((t) => t.id === tradeId);
  if (!trade || trade.status === "CLOSED") return;

  trade.status = "CLOSED";
  trade.exit = exitSnapshot;

  // Calculate performance metrics
  const holdEfficiency = 
    trade.tracking.peakPrice > trade.entry.price
      ? ((exitSnapshot.price - trade.entry.price) / (trade.tracking.peakPrice - trade.entry.price)) * 100
      : 0;

  const exitAccuracy = calculateExitAccuracy(holdEfficiency);
  const riskManagement = calculateRiskManagement(
    exitSnapshot.realizedPnLPercent,
    trade.entry.stopLoss,
    trade.entry.price,
    exitSnapshot.price
  );

  trade.metrics = {
    entryAccuracy: "GOOD", // Can be enhanced later with more logic
    exitAccuracy,
    holdEfficiency: Math.round(holdEfficiency * 100) / 100,
    riskManagement,
    setupFollowThrough: exitSnapshot.realizedPnLPercent > 0,
  };

  // Auto-tag based on characteristics
  const tags: string[] = [];
  tags.push(exitSnapshot.realizedPnLPercent > 0 ? "profitable" : "loss");
  tags.push(exitSnapshot.triggerDetails.triggerType.toLowerCase().replace(/_/g, "-"));
  tags.push(`hold-${trade.tracking.holdingDays}d`);
  if (holdEfficiency >= 80) tags.push("excellent-exit");
  if (holdEfficiency < 50) tags.push("gave-back-profit");
  
  trade.tags = tags;

  saveEnhancedJournalToDisk();
  
  console.log(`[enhanced-journal] Closed ${trade.symbol} (${tradeId}) | Efficiency: ${holdEfficiency.toFixed(1)}%`);
}

/**
 * Calculate exit accuracy based on hold efficiency
 */
function calculateExitAccuracy(holdEfficiency: number): "EXCELLENT" | "GOOD" | "FAIR" | "POOR" {
  if (holdEfficiency >= 80) return "EXCELLENT";
  if (holdEfficiency >= 60) return "GOOD";
  if (holdEfficiency >= 40) return "FAIR";
  return "POOR";
}

/**
 * Calculate risk management quality
 */
function calculateRiskManagement(
  pnlPercent: number,
  stopLoss: number | null,
  entryPrice: number,
  exitPrice: number
): "PROTECTED" | "STOP_HIT" | "RUNAWAY_LOSS" {
  if (!stopLoss) return "PROTECTED";
  
  const stopLossPercent = ((stopLoss - entryPrice) / entryPrice) * 100;
  
  // If loss is worse than 1.5x the stop loss, it's a runaway
  if (pnlPercent < stopLossPercent * 1.5) return "RUNAWAY_LOSS";
  
  // If we hit near the stop loss
  if (pnlPercent < 0 && Math.abs(pnlPercent - stopLossPercent) < 0.5) return "STOP_HIT";
  
  return "PROTECTED";
}

/**
 * Get all enhanced trades
 */
export function getEnhancedJournal(): EnhancedTradeJournal[] {
  return [...enhancedJournal].sort((a, b) => {
    // Open first, then by entry date descending
    if (a.status !== b.status) return a.status === "OPEN" ? -1 : 1;
    return new Date(b.entry.timestamp).getTime() - new Date(a.entry.timestamp).getTime();
  });
}

/**
 * Get enhanced trade by ID
 */
export function getEnhancedTradeById(tradeId: string): EnhancedTradeJournal | null {
  return enhancedJournal.find((t) => t.id === tradeId) ?? null;
}

/**
 * Export journal as JSON (for analysis)
 */
export function exportEnhancedJournalAsJson(): string {
  return JSON.stringify(enhancedJournal, null, 2);
}
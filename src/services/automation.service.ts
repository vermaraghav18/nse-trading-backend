import { getStrategyDecisions } from "./strategy.service";
import { AutomationAction } from "../types/automation.types";
import { getStockScanner1D } from "./chart.service";
import { runAutoTradeEngine } from "./auto-trade-engine.service";
import { getPaperTrades } from "./paper-trade.service";

/**
 * Converts strategy decisions into automation-ready actions.
 */
export async function getAutomationActions(): Promise<AutomationAction[]> {
  const decisions = await getStrategyDecisions();

  return decisions.map((decision) => {
    if (decision.decision === "BUY") {
      return {
        id: decision.id,
        symbol: decision.symbol,
        timeframe: decision.timeframe,
        strategyName: decision.strategyName,
        signalState: decision.signalState,
        decision: decision.decision,
        automationStatus: "READY",
        shouldCreatePaperTrade: true,
        reason:
          "Automation marks this stock as READY because the strategy decision is BUY.",
      };
    }

    if (decision.decision === "SELL") {
      return {
        id: decision.id,
        symbol: decision.symbol,
        timeframe: decision.timeframe,
        strategyName: decision.strategyName,
        signalState: decision.signalState,
        decision: decision.decision,
        automationStatus: "READY",
        shouldCreatePaperTrade: true,
        reason:
          "Automation marks this stock as READY because the strategy decision is SELL.",
      };
    }

    return {
      id: decision.id,
      symbol: decision.symbol,
      timeframe: decision.timeframe,
      strategyName: decision.strategyName,
      signalState: decision.signalState,
      decision: decision.decision,
      automationStatus: "WAITING",
      shouldCreatePaperTrade: false,
      reason:
        "Automation keeps this stock in WAITING because the strategy decision is HOLD.",
    };
  });
}

/**
 * Runs one real paper-trading cycle manually via API.
 * Useful for testing from the automation controller.
 */
export async function executeAutomationPaperTrades(): Promise<{
  created: number;
  closed: number;
  skipped: number;
  details: string[];
  capital: {
    total: number;
    used: number;
    remaining: number;
    maxPerTrade: number;
    maxOpenTrades: number;
    openTrades: number;
  };
}> {
  const before = getPaperTrades().summary;

  const scanner = await getStockScanner1D();
  runAutoTradeEngine(scanner.rows);

  const after = getPaperTrades().summary;

  const created = Math.max(0, after.totalTrades - before.totalTrades);
  const closed = Math.max(0, after.closedTrades - before.closedTrades);

  return {
    created,
    closed,
    skipped: Math.max(0, scanner.rows.length - created - closed),
    details: [
      `Manual automation cycle completed on ${scanner.rows.length} scanner rows.`,
      `Created trades: ${created}.`,
      `Closed trades: ${closed}.`,
    ],
    capital: {
      total: 0,
      used: 0,
      remaining: 0,
      maxPerTrade: 0,
      maxOpenTrades: 0,
      openTrades: after.openTrades,
    },
  };
}
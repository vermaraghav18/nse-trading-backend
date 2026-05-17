import { StockScannerRow } from "../types/chart.types";
import { Bollinger1HResult } from "../types/bollinger-1h.types";
import { Ema1HResult } from "../types/ema-1h.types";

/**
 * Blocker represents a reason why entry was blocked
 */
export type EntryBlocker = {
  category: string;
  blocker: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  explanation: string;
  currentValue?: string | number;
  requiredValue?: string | number;
};

/**
 * Opportunity represents a potential entry that's forming
 */
export type EntryOpportunity = {
  setupType: string;
  status: "READY" | "FORMING" | "NEEDS_CONFIRMATION" | "NOT_ACTIVE";
  progress: number; // 0-100%
  missingRequirements: string[];
  estimatedDaysUntilReady?: number;
};

/**
 * Complete analysis of why entry was blocked
 */
export type EntryBlockerAnalysis = {
  symbol: string;
  timestamp: string;
  canEnter: boolean;
  
  // Universal blockers (applies to all setups)
  universalBlockers: EntryBlocker[];
  
  // Setup-specific analysis
  opportunities: EntryOpportunity[];
  
  // Market context
  marketContext: {
    dailyTrend: string;
    bollingerPosition: string;
    priceVsSupport: string;
    priceVsResistance: string;
    ema7Trend: string;
    ema14Trend: string;
  };
  
  // Summary
  summary: string;
  recommendation: string;
};

/**
 * Analyze why a stock didn't trigger entry
 */
export function analyzeEntryBlockers(
  row: StockScannerRow,
  mtfData: {
    boll1H: Bollinger1HResult | null;
    ema1H: Ema1HResult | null;
    boll2H: Bollinger1HResult | null;
    ema2H: Ema1HResult | null;
  }
): EntryBlockerAnalysis {
  
  const universalBlockers: EntryBlocker[] = [];
  const opportunities: EntryOpportunity[] = [];
  
  // === UNIVERSAL BLOCKERS (Gate 0) ===
  
  if (row.isExhaustionRisk) {
    universalBlockers.push({
      category: "Risk Management",
      blocker: "Exhaustion Risk Detected",
      severity: "CRITICAL",
      explanation: "Stock showing signs of exhaustion. Price has extended too far too fast. High probability of pullback.",
      currentValue: "YES",
      requiredValue: "NO",
    });
  }
  
  if (row.nearHighCaution) {
    universalBlockers.push({
      category: "Risk Management",
      blocker: "Near High Caution",
      severity: "WARNING",
      explanation: "Stock is near recent highs. Risk of rejection at resistance.",
      currentValue: "YES",
      requiredValue: "NO",
    });
  }
  
  if (row.posture === "Near Resistance") {
    universalBlockers.push({
      category: "Risk Management",
      blocker: "Near Resistance Zone",
      severity: "CRITICAL",
      explanation: "Stock is trading near resistance. Entry here has poor risk/reward as price is likely to face selling pressure.",
      currentValue: row.posture,
      requiredValue: "Open Range or Near Support",
    });
  }
  
  if (row.scannerGrade === "D") {
    universalBlockers.push({
      category: "Setup Quality",
      blocker: "Low Scanner Grade",
      severity: "CRITICAL",
      explanation: "Overall setup quality is too low. Multiple technical factors are not aligned.",
      currentValue: "D",
      requiredValue: "A, B, or C",
    });
  }
  
  // === 1H CONFIRMATION CHECK ===
  
  if (mtfData.boll1H && mtfData.boll1H.currentClose < mtfData.boll1H.middleBand) {
    universalBlockers.push({
      category: "Multi-Timeframe Confirmation",
      blocker: "1H Below Middle Band",
      severity: "WARNING",
      explanation: "1H candle is below 1H middle Bollinger Band. Short-term momentum is weak.",
      currentValue: `₹${mtfData.boll1H.currentClose.toFixed(2)}`,
      requiredValue: `Above ₹${mtfData.boll1H.middleBand.toFixed(2)}`,
    });
  }
  
  if (mtfData.ema1H && mtfData.ema1H.ema7dSlant === "DOWNWARD") {
    universalBlockers.push({
      category: "Multi-Timeframe Confirmation",
      blocker: "1H EMA7 Downward",
      severity: "CRITICAL",
      explanation: "1H EMA7 is slanting downward. Short-term trend is bearish. System waits for at least FLAT or UPWARD.",
      currentValue: "DOWNWARD",
      requiredValue: "UPWARD or FLAT",
    });
  }
  
  // === ANALYZE EACH SETUP TYPE ===
  
  // PDF2 Two-Candle Reversal
  if (row.setupType === "TWO_CANDLE_REVERSAL") {
    const blockers: string[] = [];
    let progress = 40; // Base score for having the pattern
    
    if (row.pdf2Signal !== "BUY") {
      blockers.push(`PDF2 signal is ${row.pdf2Signal}, needs BUY`);
    } else {
      progress += 20;
    }
    
    if (mtfData.ema2H && mtfData.ema2H.ema7dSlant === "DOWNWARD" && mtfData.ema2H.ema14dSlant === "DOWNWARD") {
      blockers.push("2H trend not confirmed (both EMA7 and EMA14 downward)");
    } else {
      progress += 20;
    }
    
    if (mtfData.ema1H && mtfData.ema1H.ema7dSlant === "DOWNWARD") {
      blockers.push("1H EMA7 downward");
    } else {
      progress += 20;
    }
    
    opportunities.push({
      setupType: "PDF2 Two-Candle Reversal",
      status: blockers.length === 0 ? "READY" : "NEEDS_CONFIRMATION",
      progress,
      missingRequirements: blockers,
      estimatedDaysUntilReady: blockers.length > 0 ? 1 : 0,
    });
  }
  
  // PDF2 Reversal
  if (row.setupType === "REVERSAL") {
    const blockers: string[] = [];
    let progress = 40;
    
    if (row.pdf2Signal !== "BUY") {
      blockers.push(`PDF2 signal is ${row.pdf2Signal}, needs BUY`);
    } else {
      progress += 20;
    }
    
    if (mtfData.ema2H && mtfData.ema2H.ema7dSlant === "DOWNWARD" && mtfData.ema2H.ema14dSlant === "DOWNWARD") {
      blockers.push("2H trend not confirmed");
    } else {
      progress += 20;
    }
    
    if (mtfData.ema1H && mtfData.ema1H.ema7dSlant === "DOWNWARD") {
      blockers.push("1H EMA7 downward");
    } else {
      progress += 20;
    }
    
    opportunities.push({
      setupType: "PDF2 Reversal",
      status: blockers.length === 0 ? "READY" : "NEEDS_CONFIRMATION",
      progress,
      missingRequirements: blockers,
      estimatedDaysUntilReady: blockers.length > 0 ? 1 : 0,
    });
  }
  
  // PDF3 Breakout Buy
  if (row.entrySignal === "BREAKOUT_BUY" || row.crossoverDetected) {
    const blockers: string[] = [];
    let progress = 0;
    
    if (!row.middleBandHoldConfirmed) {
      blockers.push(`Only ${row.daysAboveMiddleBand}/5 days above middle band`);
      progress = (row.daysAboveMiddleBand / 5) * 60;
    } else {
      progress = 60;
    }
    
    if (!row.crossoverDetected) {
      blockers.push("Crossover not yet detected");
    } else {
      progress += 10;
    }
    
    if (mtfData.boll2H && mtfData.boll2H.currentClose < mtfData.boll2H.middleBand) {
      blockers.push("2H below middle band");
    } else {
      progress += 15;
    }
    
    if (mtfData.ema2H && mtfData.ema2H.ema7dSlant === "DOWNWARD") {
      blockers.push("2H EMA7 downward");
    } else {
      progress += 15;
    }
    
    const daysNeeded = Math.max(0, 5 - row.daysAboveMiddleBand);
    
    opportunities.push({
      setupType: "PDF3 Breakout Buy",
      status: blockers.length === 0 ? "READY" : daysNeeded > 0 ? "FORMING" : "NEEDS_CONFIRMATION",
      progress: Math.min(100, progress),
      missingRequirements: blockers,
      estimatedDaysUntilReady: daysNeeded,
    });
  }
  
  // PDF3 Retest Buy
  if (row.entrySignal === "RETEST_BUY" || row.middleBandSupportHolding) {
    const blockers: string[] = [];
    let progress = 50;
    
    if (!row.middleBandSupportHolding) {
      blockers.push("Middle band not holding as support");
    } else {
      progress += 20;
    }
    
    if (mtfData.boll2H && mtfData.boll2H.currentClose < mtfData.boll2H.middleBand) {
      blockers.push("2H below middle band");
    } else {
      progress += 15;
    }
    
    if (mtfData.ema2H && mtfData.ema2H.ema7dSlant === "DOWNWARD") {
      blockers.push("2H EMA7 downward");
    } else {
      progress += 15;
    }
    
    opportunities.push({
      setupType: "PDF3 Retest Buy",
      status: blockers.length === 0 ? "READY" : "NEEDS_CONFIRMATION",
      progress,
      missingRequirements: blockers,
      estimatedDaysUntilReady: blockers.length > 0 ? 1 : 0,
    });
  }
  
  // PDF3 Lower Hold Buy
  if (row.entrySignal === "LOWER_HOLD_BUY" || row.lowerBandHoldConfirmed) {
    const blockers: string[] = [];
    let progress = 0;
    
    if (!row.lowerBandHoldConfirmed) {
      blockers.push(`Only ${row.daysAboveLowerBand}/5 days above lower band`);
      progress = (row.daysAboveLowerBand / 5) * 60;
    } else {
      progress = 60;
    }
    
    if (mtfData.boll2H && mtfData.boll2H.currentClose < mtfData.boll2H.lowerBand) {
      blockers.push("2H below lower band");
    } else {
      progress += 20;
    }
    
    if (mtfData.ema2H && mtfData.ema2H.ema7dSlant === "DOWNWARD") {
      blockers.push("2H EMA7 downward");
    } else {
      progress += 20;
    }
    
    const daysNeeded = Math.max(0, 5 - row.daysAboveLowerBand);
    
    opportunities.push({
      setupType: "PDF3 Lower Hold Buy",
      status: blockers.length === 0 ? "READY" : daysNeeded > 0 ? "FORMING" : "NEEDS_CONFIRMATION",
      progress: Math.min(100, progress),
      missingRequirements: blockers,
      estimatedDaysUntilReady: daysNeeded,
    });
  }
  
  // PDF2 Pullback
  if (row.setupType === "PULLBACK") {
    const blockers: string[] = [];
    let progress = 40;
    
    if (row.pdf2Signal !== "BUY") {
      blockers.push(`PDF2 signal is ${row.pdf2Signal}, needs BUY`);
    } else {
      progress += 20;
    }
    
    if (!row.bullishResumeTrigger) {
      blockers.push("Bullish resume trigger not active");
    } else {
      progress += 20;
    }
    
    if (mtfData.ema2H && mtfData.ema2H.ema7dSlant === "DOWNWARD") {
      blockers.push("2H EMA7 downward");
    } else {
      progress += 20;
    }
    
    opportunities.push({
      setupType: "PDF2 Pullback",
      status: blockers.length === 0 ? "READY" : "NEEDS_CONFIRMATION",
      progress,
      missingRequirements: blockers,
      estimatedDaysUntilReady: blockers.length > 0 ? 1 : 0,
    });
  }
  
  // PDF1 Bullish Confirmed
  if (row.pdf1Signal === "BULLISH_CONFIRMED") {
    const blockers: string[] = [];
    let progress = 50;
    
    if (row.recentPriceLocation !== "RECENT_LOW") {
      blockers.push(`Price at ${row.recentPriceLocation}, needs RECENT_LOW`);
    } else {
      progress += 20;
    }
    
    if (!row.buyZone) {
      blockers.push("Not in buy zone");
    } else {
      progress += 15;
    }
    
    if (mtfData.ema2H && mtfData.ema2H.ema7dSlant === "DOWNWARD") {
      blockers.push("2H EMA7 downward");
    } else {
      progress += 15;
    }
    
    opportunities.push({
      setupType: "PDF1 Bullish Confirmed",
      status: blockers.length === 0 ? "READY" : "NEEDS_CONFIRMATION",
      progress,
      missingRequirements: blockers,
      estimatedDaysUntilReady: blockers.length > 0 ? 1 : 0,
    });
  }
  
  // === MARKET CONTEXT ===
  
  const marketContext = {
    dailyTrend: row.ema7dSlant || "UNKNOWN",
    bollingerPosition: row.bollingerPosition,
    priceVsSupport: row.supportDistance !== null 
      ? `${row.supportDistance.toFixed(2)}% ${row.supportDistance < 0 ? 'below' : 'above'}`
      : "UNKNOWN",
    priceVsResistance: row.resistanceDistance !== null
      ? `${row.resistanceDistance.toFixed(2)}% ${row.resistanceDistance < 0 ? 'below' : 'above'}`
      : "UNKNOWN",
    ema7Trend: row.ema7dSlant || "UNKNOWN",
    ema14Trend: row.ema14dSlant || "UNKNOWN",
  };
  
  // === GENERATE SUMMARY ===
  
  const canEnter = universalBlockers.filter(b => b.severity === "CRITICAL").length === 0 &&
                   opportunities.some(o => o.status === "READY");
  
  let summary = "";
  let recommendation = "";
  
  if (canEnter) {
    const readySetups = opportunities.filter(o => o.status === "READY");
    summary = `${row.symbol} has ${readySetups.length} setup(s) ready to trigger: ${readySetups.map(s => s.setupType).join(", ")}`;
    recommendation = "System should enter on next scan cycle if market is open.";
  } else if (universalBlockers.length > 0) {
    const criticalBlockers = universalBlockers.filter(b => b.severity === "CRITICAL");
    if (criticalBlockers.length > 0) {
      summary = `${row.symbol} is blocked by ${criticalBlockers.length} critical issue(s): ${criticalBlockers.map(b => b.blocker).join(", ")}`;
      recommendation = "Wait for these issues to resolve before considering entry.";
    } else {
      summary = `${row.symbol} has ${universalBlockers.length} warning(s) but may still form a setup.`;
      recommendation = "Monitor for setup development but be cautious of the warnings.";
    }
  } else {
    const formingSetups = opportunities.filter(o => o.status === "FORMING");
    if (formingSetups.length > 0) {
      const nearestSetup = formingSetups.sort((a, b) => (a.estimatedDaysUntilReady || 999) - (b.estimatedDaysUntilReady || 999))[0];
      summary = `${row.symbol} has setup(s) forming. Nearest: ${nearestSetup.setupType} (~${nearestSetup.estimatedDaysUntilReady} days away)`;
      recommendation = `Watch ${row.symbol}. Entry may trigger in ${nearestSetup.estimatedDaysUntilReady} day(s) if conditions hold.`;
    } else {
      summary = `${row.symbol} needs confirmation on multiple fronts. No clear setup forming yet.`;
      recommendation = "Wait for clearer technical alignment before entry.";
    }
  }
  
  return {
    symbol: row.symbol,
    timestamp: new Date().toISOString(),
    canEnter,
    universalBlockers,
    opportunities,
    marketContext,
    summary,
    recommendation,
  };
}
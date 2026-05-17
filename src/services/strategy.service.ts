import { getSignalSummaries } from "./signal.service";
import { StrategyDecision } from "../types/strategy.types";

export async function getStrategyDecisions(): Promise<StrategyDecision[]> {
  const signals = await getSignalSummaries();

  return signals.map((signal): StrategyDecision => {
    if (signal.state === "BUY_READY") {
      return {
        id: String(signal.id),
        strategyName: "Chapter 5 Bollinger Entry Strategy",
        symbol: signal.symbol,
        timeframe: "1D",
        indicatorSource: "BOLLINGER",
        signalState: signal.state,
        decision: "BUY",
        confidence: "HIGH",
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        targetPrice: signal.targetPrice,
        reason:
          signal.setupSignal === "BREAKOUT_BUY"
            ? "Confirmed middle-band breakout with holding candles in the valid entry window."
            : "Confirmed middle-band support retest with bullish reaction.",
      };
    }

    if (signal.state === "BUY_WATCH") {
      return {
        id: String(signal.id),
        strategyName: "Chapter 5 Bollinger Entry Strategy",
        symbol: signal.symbol,
        timeframe: "1D",
        indicatorSource: "BOLLINGER",
        signalState: signal.state,
        decision: "HOLD",
        confidence: "MEDIUM",
        entryPrice: signal.entryPrice,
        stopLoss: signal.stopLoss,
        targetPrice: signal.targetPrice,
        reason:
          "The stock is in a lower-band watch zone, but the entry still needs cleaner confirmation.",
      };
    }

    if (signal.state === "AVOID") {
      return {
        id: String(signal.id),
        strategyName: "Chapter 5 Bollinger Entry Strategy",
        symbol: signal.symbol,
        timeframe: "1D",
        indicatorSource: "BOLLINGER",
        signalState: signal.state,
        decision: "SELL",
        confidence: "HIGH",
        entryPrice: null,
        stopLoss: null,
        targetPrice: null,
        reason:
          "The middle band has failed as support, so fresh longs should be avoided and existing holders should turn defensive.",
      };
    }

    return {
      id: String(signal.id),
      strategyName: "Chapter 5 Bollinger Entry Strategy",
      symbol: signal.symbol,
      timeframe: "1D",
      indicatorSource: "BOLLINGER",
      signalState: signal.state,
      decision: "HOLD",
      confidence: "LOW",
      entryPrice: null,
      stopLoss: null,
      targetPrice: null,
      reason:
        "No strong Bollinger setup is active, so the correct posture is to wait.",
    };
  });
}
import { PaperTradeExitReason, PaperTrade } from "../types/paper-trade.types";

/**
 * Builds detailed, human-readable exit reasons for paper trades
 */
export function buildDetailedExitReason(
  trade: PaperTrade,
  exitPrice: number,
  exitReason: PaperTradeExitReason
): string {
  const entryPrice = trade.entryPrice;
  const peakPrice = trade.peakPrice;
  const profitPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
  const peakProfitPercent = ((peakPrice - entryPrice) / entryPrice) * 100;

  switch (exitReason) {
    case "TRAILING_STOP_2H":
      return `Price moved from ₹${entryPrice.toFixed(2)} → ₹${peakPrice.toFixed(2)} (+${peakProfitPercent.toFixed(2)}%). 2H trailing stop triggered when price fell below 2H EMA44, locking in profit at ₹${exitPrice.toFixed(2)} (+${profitPercent.toFixed(2)}% final gain).`;

    case "STOP_LOSS_1H_MIDDLE_BAND":
      return `Stop loss triggered at ₹${exitPrice.toFixed(2)} (${profitPercent.toFixed(2)}% ${profitPercent >= 0 ? "gain" : "loss"}). Price closed below 1H middle Bollinger band for 2 consecutive candles, indicating support breakdown. Risk management preserved capital.`;

    case "STOP_LOSS_MIDDLE_BAND":
      return `Stop loss triggered at ₹${exitPrice.toFixed(2)} (${profitPercent.toFixed(2)}% ${profitPercent >= 0 ? "gain" : "loss"}). Price broke below daily middle Bollinger band, invalidating the support-retest setup. Risk management preserved capital.`;

    case "STOP_LOSS_DAILY_LOWER_BAND":
      return `Hard stop loss triggered at ₹${exitPrice.toFixed(2)} (${profitPercent.toFixed(2)}% loss). Price broke below daily lower Bollinger band floor at ₹${(trade.stopLossLevel || 0).toFixed(2)}. Maximum risk limit reached.`;

    case "HIT_RESISTANCE":
      const resistanceGain = profitPercent.toFixed(2);
      return `Target zone reached at ₹${exitPrice.toFixed(2)} (+${resistanceGain}% gain). Price approached resistance with 1H rejection confirmed (close below 1H EMA44). Profit protected before reversal.`;

    case "PROFIT_TARGET_5PCT":
      return `Profit target achieved at ₹${exitPrice.toFixed(2)} (+${profitPercent.toFixed(2)}% gain). Systematic profit-taking at 5% gain level ensures consistent returns while avoiding greed.`;

    case "EXHAUSTION_DETECTED":
      return `Exhaustion exit at ₹${exitPrice.toFixed(2)} (+${profitPercent.toFixed(2)}% gain). Price reached ₹${peakPrice.toFixed(2)} but momentum weakened with bearish signals on 2H timeframe. Exited to protect gains before reversal.`;

    case "BROKEN_BELOW_MIDDLE":
      return `Setup breakdown: Price at ₹${exitPrice.toFixed(2)} (${profitPercent.toFixed(2)}% ${profitPercent >= 0 ? "gain" : "loss"}) fell back below daily middle Bollinger band. Original pullback thesis invalidated. Exited before further deterioration.`;

    case "MAX_HOLD_EXCEEDED":
      const holdDays = trade.holdingDays;
      return `Time stop: Held for ${holdDays} days (maximum 10 days allowed). Setup did not develop as expected. Exited at ₹${exitPrice.toFixed(2)} (${profitPercent.toFixed(2)}% ${profitPercent >= 0 ? "gain" : "loss"}) to free capital for better opportunities.`;

    case "MANUAL":
      return `Manual exit at ₹${exitPrice.toFixed(2)} (${profitPercent.toFixed(2)}% ${profitPercent >= 0 ? "gain" : "loss"}). Trade closed manually by user.`;

    default:
      return `Exited at ₹${exitPrice.toFixed(2)} (${profitPercent.toFixed(2)}% ${profitPercent >= 0 ? "gain" : "loss"}).`;
  }
}
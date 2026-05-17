/**
 * API Cost Calculator Service
 * Estimates daily/monthly costs based on usage
 */

import { getUsageStats } from "./zerodha-rate-limiter.service";

const ZERODHA_MONTHLY_COST = 500; // ₹500/month
const ZERODHA_MONTHLY_LIMIT = 234000; // Conservative estimate

/**
 * Calculate estimated daily cost
 */
export function getEstimatedDailyCost(): {
  upstox: number;
  zerodha: number;
  total: number;
} {
  const stats = getUsageStats();
  
  // Upstox is free
  const upstoxCost = 0;
  
  // Zerodha is fixed ₹500/month regardless of usage
  // But calculate "cost per call" for tracking
  const zerodhaCallsToday = stats.today;
  const zerodhaEstimatedMonthlyCalls = zerodhaCallsToday * 30;
  
  // Cost is fixed, but show utilization
  const zerodhaUtilization = (zerodhaEstimatedMonthlyCalls / ZERODHA_MONTHLY_LIMIT) * 100;
  
  return {
    upstox: upstoxCost,
    zerodha: ZERODHA_MONTHLY_COST, // Fixed cost
    total: ZERODHA_MONTHLY_COST,
  };
}

/**
 * Get cost report
 */
export function getCostReport() {
  const stats = getUsageStats();
  const costs = getEstimatedDailyCost();
  
  return {
    today: {
      calls: stats.today,
      estimatedCost: costs.zerodha / 30, // Daily portion
    },
    month: {
      estimatedCalls: stats.today * 30,
      fixedCost: ZERODHA_MONTHLY_COST,
      utilizationPercent: ((stats.today * 30 / ZERODHA_MONTHLY_LIMIT) * 100).toFixed(1),
    },
    limits: {
      dailySafe: 5000,
      monthlySafe: 150000,
      monthlyMax: ZERODHA_MONTHLY_LIMIT,
    },
  };
}

/**
 * Check if usage is within safe limits
 */
export function isUsageWithinSafeLimits(): {
  safe: boolean;
  message: string;
} {
  const report = getCostReport();
  
  if (report.today.calls > 4500) {
    return {
      safe: false,
      message: `⚠️  Daily usage high: ${report.today.calls} calls (limit: 5000)`,
    };
  }
  
  const monthlyEstimate = report.month.estimatedCalls;
  if (monthlyEstimate > 150000) {
    return {
      safe: false,
      message: `⚠️  Monthly projection high: ${monthlyEstimate} calls (safe limit: 150,000)`,
    };
  }
  
  return {
    safe: true,
    message: `✅ Usage within safe limits: ${report.today.calls} calls today`,
  };
}
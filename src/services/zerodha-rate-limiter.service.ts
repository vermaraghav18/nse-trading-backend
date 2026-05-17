/**
 * Zerodha Rate Limiter Service
 * CRITICAL: Prevents accidental API cost overruns
 * Blocks requests when limits are approached
 */

import { env } from "../config/env";
import { ZERODHA_RATE_LIMITS } from "../config/api-providers";
import { SimpleLogger } from "../utils/simple-logger";

interface RateLimitCounters {
  today: number;
  hour: number;
  minute: number;
  lastResetMinute: Date;
  lastResetHour: Date;
  lastResetDay: Date;
}

const counters: RateLimitCounters = {
  today: 0,
  hour: 0,
  minute: 0,
  lastResetMinute: new Date(),
  lastResetHour: new Date(),
  lastResetDay: new Date(),
};

let callLog: Array<{ timestamp: Date; operation: string }> = [];

/**
 * Reset counters based on time elapsed
 */
function resetCountersIfNeeded(): void {
  const now = new Date();
  
  // Reset minute counter
  const minuteElapsed = (now.getTime() - counters.lastResetMinute.getTime()) / 1000 / 60;
  if (minuteElapsed >= 1) {
    counters.minute = 0;
    counters.lastResetMinute = now;
  }
  
  // Reset hour counter
  const hourElapsed = (now.getTime() - counters.lastResetHour.getTime()) / 1000 / 60 / 60;
  if (hourElapsed >= 1) {
    counters.hour = 0;
    counters.lastResetHour = now;
  }
  
  // Reset day counter (at midnight IST)
  const dayElapsed = (now.getTime() - counters.lastResetDay.getTime()) / 1000 / 60 / 60 / 24;
  if (dayElapsed >= 1) {
    counters.today = 0;
    counters.lastResetDay = now;
  }
}

/**
 * Check if request should be allowed
 * Returns true if allowed, false if blocked
 */
export async function checkRateLimit(operation: string): Promise<boolean> {
  if (!env.zerodha.enabled) {
    // Zerodha disabled, no rate limiting needed
    return true;
  }
  
  resetCountersIfNeeded();
  
  // Check daily limit (CRITICAL - this should never happen)
  if (counters.today >= ZERODHA_RATE_LIMITS.maxCallsPerDay) {
    SimpleLogger.error(`DAILY LIMIT REACHED: ${counters.today}/${ZERODHA_RATE_LIMITS.maxCallsPerDay} calls`);
    return false;
  }
  
  // Check hourly limit (blocks and falls back to Upstox)
  if (counters.hour >= ZERODHA_RATE_LIMITS.maxCallsPerHour) {
    // Silently block - fallback to Upstox will handle this
    return false;
  }
  
  // Check per-minute limit (auto-throttle)
  if (counters.minute >= ZERODHA_RATE_LIMITS.maxCallsPerMinute) {
    // Silently throttle - wait 1 second
    await new Promise(resolve => setTimeout(resolve, 1000));
    resetCountersIfNeeded();
  }
  
  // Warning at 90% of daily limit
  const dailyUsagePercent = (counters.today / ZERODHA_RATE_LIMITS.maxCallsPerDay) * 100;
  if (dailyUsagePercent >= 90 && counters.today % 100 === 0) {
    SimpleLogger.warning(`Zerodha API usage: ${dailyUsagePercent.toFixed(0)}% of daily limit`);
  }
  
  return true;
}

/**
 * Record an API call (called after successful request)
 */
export function recordAPICall(operation: string): void {
  if (!env.zerodha.enabled) {
    return;
  }
  
  resetCountersIfNeeded();
  
  counters.today++;
  counters.hour++;
  counters.minute++;
  
  callLog.push({
    timestamp: new Date(),
    operation,
  });
  
  // Keep only last 1000 calls in memory
  if (callLog.length > 1000) {
    callLog = callLog.slice(-1000);
  }
  
  // Suppress all logging - only show warnings/errors via checkRateLimit
}

/**
 * Get current usage statistics
 */
export function getUsageStats() {
  resetCountersIfNeeded();
  
  return {
    today: counters.today,
    hour: counters.hour,
    minute: counters.minute,
    limits: {
      daily: ZERODHA_RATE_LIMITS.maxCallsPerDay,
      hourly: ZERODHA_RATE_LIMITS.maxCallsPerHour,
      minute: ZERODHA_RATE_LIMITS.maxCallsPerMinute,
    },
    percentages: {
      daily: ((counters.today / ZERODHA_RATE_LIMITS.maxCallsPerDay) * 100).toFixed(1),
      hourly: ((counters.hour / ZERODHA_RATE_LIMITS.maxCallsPerHour) * 100).toFixed(1),
      minute: ((counters.minute / ZERODHA_RATE_LIMITS.maxCallsPerMinute) * 100).toFixed(1),
    },
    recentCalls: callLog.slice(-20), // Last 20 calls
  };
}

/**
 * Get usage alert if any
 */
export function getUsageAlert(): string | null {
  resetCountersIfNeeded();
  
  const usage = counters.today / ZERODHA_RATE_LIMITS.maxCallsPerDay;
  
  if (usage >= 0.9) {
    return `🚨 CRITICAL: 90% of daily Zerodha calls used (${counters.today}/${ZERODHA_RATE_LIMITS.maxCallsPerDay})`;
  }
  
  if (usage >= ZERODHA_RATE_LIMITS.alertThreshold) {
    return `⚠️  WARNING: ${(usage * 100).toFixed(1)}% of daily Zerodha calls used (${counters.today}/${ZERODHA_RATE_LIMITS.maxCallsPerDay})`;
  }
  
  return null;
}

/**
 * Reset all counters (for testing)
 */
export function resetCounters(): void {
  counters.today = 0;
  counters.hour = 0;
  counters.minute = 0;
  counters.lastResetMinute = new Date();
  counters.lastResetHour = new Date();
  counters.lastResetDay = new Date();
  callLog = [];
}
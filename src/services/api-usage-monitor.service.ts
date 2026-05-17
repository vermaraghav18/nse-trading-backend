/**
 * API Usage Monitor Service
 * Tracks API calls across both Upstox and Zerodha
 */

interface APICallRecord {
  timestamp: Date;
  provider: 'upstox' | 'zerodha';
  operation: string;
  success: boolean;
  duration?: number;
}

let callHistory: APICallRecord[] = [];

/**
 * Record an API call
 */
export function recordAPICall(
  provider: 'upstox' | 'zerodha',
  operation: string,
  success: boolean,
  duration?: number
): void {
  callHistory.push({
    timestamp: new Date(),
    provider,
    operation,
    success,
    duration,
  });
  
  // Keep only last 24 hours of calls
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  callHistory = callHistory.filter(call => call.timestamp >= oneDayAgo);
}

/**
 * Get usage statistics
 */
export function getUsageStatistics() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const lastHourCalls = callHistory.filter(call => call.timestamp >= oneHourAgo);
  const todayCalls = callHistory.filter(call => call.timestamp >= oneDayAgo);
  
  const upstoxCalls = todayCalls.filter(call => call.provider === 'upstox');
  const zerodhaCalls = todayCalls.filter(call => call.provider === 'zerodha');
  
  return {
    total: {
      lastHour: lastHourCalls.length,
      today: todayCalls.length,
    },
    upstox: {
      lastHour: lastHourCalls.filter(c => c.provider === 'upstox').length,
      today: upstoxCalls.length,
      successRate: upstoxCalls.length > 0 
        ? ((upstoxCalls.filter(c => c.success).length / upstoxCalls.length) * 100).toFixed(1)
        : '0',
    },
    zerodha: {
      lastHour: lastHourCalls.filter(c => c.provider === 'zerodha').length,
      today: zerodhaCalls.length,
      successRate: zerodhaCalls.length > 0
        ? ((zerodhaCalls.filter(c => c.success).length / zerodhaCalls.length) * 100).toFixed(1)
        : '0',
    },
  };
}

/**
 * Get recent API calls
 */
export function getRecentCalls(limit: number = 50): APICallRecord[] {
  return callHistory.slice(-limit);
}

/**
 * Clear history (for testing)
 */
export function clearHistory(): void {
  callHistory = [];
}
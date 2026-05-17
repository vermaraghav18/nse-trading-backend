import { SimpleLogger } from '../utils/simple-logger';

export type BrokerType = 'dhan' | 'upstox' | 'zerodha';
export type Priority = 'high' | 'normal' | 'low';

interface QueuedRequest {
  apiFunction: () => Promise<any>;
  priority: Priority;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
  id: string;
}

interface BrokerStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  lastCallTime: number | null;
  rateLimitHits: number;
}

interface BrokerQueue {
  queue: QueuedRequest[];
  callCount: number;
  lastReset: number;
  processing: boolean;
  stats: BrokerStats;
}

class UnifiedRateLimiter {
  private maxCallsPerSecond: number = 20;
  private brokers: Record<BrokerType, BrokerQueue>;
  private resetInterval: NodeJS.Timeout | null = null;
  private queueProcessors: Record<BrokerType, NodeJS.Timeout> = {} as any;

  constructor(maxCallsPerSecond: number = 20) {
    this.maxCallsPerSecond = maxCallsPerSecond;
    
    this.brokers = {
      dhan: this.createBrokerQueue(),
      upstox: this.createBrokerQueue(),
      zerodha: this.createBrokerQueue()
    };

    this.resetInterval = setInterval(() => this.resetAllCounts(), 1000);
    
    this.queueProcessors = {
      dhan: this.startQueueProcessor('dhan'),
      upstox: this.startQueueProcessor('upstox'),
      zerodha: this.startQueueProcessor('zerodha')
    };

    SimpleLogger.success(`Rate limiter initialized: ${maxCallsPerSecond} calls/second per broker`);
  }

  private createBrokerQueue(): BrokerQueue {
    return {
      queue: [],
      callCount: 0,
      lastReset: Date.now(),
      processing: false,
      stats: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        lastCallTime: null,
        rateLimitHits: 0
      }
    };
  }

  private resetAllCounts(): void {
    const now = Date.now();
    Object.keys(this.brokers).forEach((broker) => {
      const brokerData = this.brokers[broker as BrokerType];
      if (now - brokerData.lastReset >= 1000) {
        brokerData.callCount = 0;
        brokerData.lastReset = now;
      }
    });
  }

  async addToQueue<T>(
    broker: BrokerType,
    apiFunction: () => Promise<T>,
    priority: Priority = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        apiFunction,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
        id: `${broker}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      const brokerData = this.brokers[broker];
      
      if (priority === 'high') {
        brokerData.queue.unshift(request);
      } else {
        brokerData.queue.push(request);
      }
    });
  }

  private startQueueProcessor(broker: BrokerType): NodeJS.Timeout {
    return setInterval(async () => {
      const brokerData = this.brokers[broker];
      
      if (brokerData.processing || brokerData.queue.length === 0) {
        return;
      }

      brokerData.processing = true;

      try {
        const availableCalls = this.maxCallsPerSecond - brokerData.callCount;
        const callsToMake = Math.min(availableCalls, brokerData.queue.length, 5);

        if (callsToMake <= 0) {
          brokerData.stats.rateLimitHits++;
          brokerData.processing = false;
          return;
        }

        const requests = brokerData.queue.splice(0, callsToMake);
        
        for (const request of requests) {
          try {
            const result = await request.apiFunction();
            brokerData.callCount++;
            brokerData.stats.totalCalls++;
            brokerData.stats.successfulCalls++;
            brokerData.stats.lastCallTime = Date.now();
            request.resolve(result);
          } catch (error) {
            brokerData.stats.totalCalls++;
            brokerData.stats.failedCalls++;
            request.reject(error);
          }

          await this.delay(50);
        }
      } catch (error) {
        SimpleLogger.error(`Error processing ${broker} queue`);
      } finally {
        brokerData.processing = false;
      }
    }, 100);
  }

  getStatus(broker: BrokerType): any {
    const brokerData = this.brokers[broker];
    return {
      broker,
      queueSize: brokerData.queue.length,
      callsThisSecond: brokerData.callCount,
      maxCallsPerSecond: this.maxCallsPerSecond,
      remainingCalls: this.maxCallsPerSecond - brokerData.callCount,
      utilizationPercent: ((brokerData.callCount / this.maxCallsPerSecond) * 100).toFixed(2),
      stats: { ...brokerData.stats },
      lastReset: new Date(brokerData.lastReset).toISOString()
    };
  }

  getAllStatus(): any[] {
    return Object.keys(this.brokers).map(broker => this.getStatus(broker as BrokerType));
  }

  getAnalytics(): Record<BrokerType, any> {
    const analytics: Record<string, any> = {};
    
    Object.keys(this.brokers).forEach((broker) => {
      const brokerType = broker as BrokerType;
      const brokerData = this.brokers[brokerType];
      const stats = brokerData.stats;
      
      analytics[broker] = {
        ...this.getStatus(brokerType),
        successRate: stats.totalCalls > 0 
          ? ((stats.successfulCalls / stats.totalCalls) * 100).toFixed(2) + '%'
          : 'N/A',
        failureRate: stats.totalCalls > 0 
          ? ((stats.failedCalls / stats.totalCalls) * 100).toFixed(2) + '%'
          : 'N/A',
        health: this.calculateHealth(brokerType)
      };
    });
    
    return analytics as Record<BrokerType, any>;
  }

  private calculateHealth(broker: BrokerType): string {
    const brokerData = this.brokers[broker];
    const stats = brokerData.stats;
    
    if (stats.totalCalls === 0) return 'unknown';
    
    const successRate = (stats.successfulCalls / stats.totalCalls) * 100;
    const queueSize = brokerData.queue.length;
    const utilization = (brokerData.callCount / this.maxCallsPerSecond) * 100;
    
    if (successRate > 95 && queueSize < 10 && utilization < 80) {
      return 'excellent';
    } else if (successRate > 85 && queueSize < 50 && utilization < 90) {
      return 'good';
    } else if (successRate > 70 && queueSize < 100) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  clearQueue(broker: BrokerType): number {
    const queueSize = this.brokers[broker].queue.length;
    this.brokers[broker].queue = [];
    SimpleLogger.info(`Cleared ${queueSize} requests from ${broker} queue`);
    return queueSize;
  }

  resetStats(broker: BrokerType): void {
    this.brokers[broker].stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastCallTime: null,
      rateLimitHits: 0
    };
    SimpleLogger.info(`Reset stats for ${broker}`);
  }

  resetAllStats(): void {
    Object.keys(this.brokers).forEach((broker) => {
      this.resetStats(broker as BrokerType);
    });
    SimpleLogger.info('Reset all broker stats');
  }

  setMaxCallsPerSecond(maxCalls: number): void {
    this.maxCallsPerSecond = maxCalls;
    SimpleLogger.info(`Updated max calls to ${maxCalls}/second`);
  }

  getQueueSize(broker: BrokerType): number {
    return this.brokers[broker].queue.length;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  shutdown(): void {
    if (this.resetInterval) {
      clearInterval(this.resetInterval);
    }
    Object.values(this.queueProcessors).forEach(processor => {
      clearInterval(processor);
    });
    SimpleLogger.info('Rate limiter shutdown complete');
  }
}

let rateLimiterInstance: UnifiedRateLimiter | null = null;

export function getRateLimiter(maxCallsPerSecond: number = 20): UnifiedRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new UnifiedRateLimiter(maxCallsPerSecond);
  }
  return rateLimiterInstance;
}

export { UnifiedRateLimiter };
import { getRateLimiter, BrokerType } from './unified-rate-limiter.service';
import { SimpleLogger } from '../utils/simple-logger';

export type LogLevel = 'info' | 'warning' | 'error' | 'success';
export type LogCategory = 'api' | 'websocket' | 'rate-limit' | 'system' | 'data-fetch';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
}

export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'warning' | 'error' | 'critical';
  category: LogCategory;
  message: string;
  data?: any;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}

class AdminMonitoringService {
  private logs: LogEntry[] = [];
  private alerts: Alert[] = [];
  private maxLogs: number = 1000;
  private maxAlerts: number = 100;
  
  private metrics = {
    apiCalls: {
      total: 0,
      successful: 0,
      failed: 0,
      byBroker: {
        dhan: { total: 0, successful: 0, failed: 0 },
        upstox: { total: 0, successful: 0, failed: 0 },
        zerodha: { total: 0, successful: 0, failed: 0 }
      }
    },
    system: {
      uptime: Date.now(),
      lastRestart: new Date()
    }
  };

  private thresholds = {
    queueSize: 100,
    failureRate: 10,
    rateLimitUtilization: 90
  };

  constructor() {
    this.startMonitoring();
    SimpleLogger.success('Admin monitoring service initialized');
  }

  private startMonitoring(): void {
    setInterval(() => this.checkThresholds(), 10000);
    setInterval(() => this.collectMetrics(), 5000);
  }

  log(level: LogLevel, category: LogCategory, message: string, data?: any): void {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data
    };

    this.logs.unshift(logEntry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    if (level === 'error' || level === 'warning') {
      this.createAlert(level === 'error' ? 'error' : 'warning', category, message, data);
    }
  }

  private createAlert(severity: Alert['severity'], category: LogCategory, message: string, data?: any): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity,
      category,
      message,
      data,
      acknowledged: false
    };

    this.alerts.unshift(alert);

    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
    }
  }

  private checkThresholds(): void {
    const rateLimiter = getRateLimiter();
    const analytics = rateLimiter.getAnalytics();

    Object.keys(analytics).forEach((broker) => {
      const data = analytics[broker as BrokerType];

      if (data.queueSize > this.thresholds.queueSize) {
        this.log('warning', 'rate-limit', 
          `High queue size for ${broker}: ${data.queueSize} requests`,
          { broker, queueSize: data.queueSize }
        );
      }

      const failureRate = parseFloat(data.failureRate);
      if (!isNaN(failureRate) && failureRate > this.thresholds.failureRate) {
        this.log('error', 'api', 
          `High failure rate for ${broker}: ${data.failureRate}`,
          { broker, failureRate: data.failureRate }
        );
      }

      const utilization = parseFloat(data.utilizationPercent);
      if (utilization > this.thresholds.rateLimitUtilization) {
        this.log('warning', 'rate-limit', 
          `High rate limit utilization for ${broker}: ${data.utilizationPercent}%`,
          { broker, utilization: data.utilizationPercent }
        );
      }

      if (data.health === 'poor') {
        this.log('error', 'system', 
          `Poor health status for ${broker}`,
          { broker, health: data.health }
        );
      }
    });
  }

  private collectMetrics(): void {
    const rateLimiter = getRateLimiter();
    const analytics = rateLimiter.getAnalytics();
    
    Object.keys(analytics).forEach((broker) => {
      const stats = analytics[broker as BrokerType].stats;
      this.metrics.apiCalls.byBroker[broker as BrokerType] = {
        total: stats.totalCalls,
        successful: stats.successfulCalls,
        failed: stats.failedCalls
      };
    });

    this.metrics.apiCalls.total = Object.values(this.metrics.apiCalls.byBroker)
      .reduce((sum, broker) => sum + broker.total, 0);
    this.metrics.apiCalls.successful = Object.values(this.metrics.apiCalls.byBroker)
      .reduce((sum, broker) => sum + broker.successful, 0);
    this.metrics.apiCalls.failed = Object.values(this.metrics.apiCalls.byBroker)
      .reduce((sum, broker) => sum + broker.failed, 0);
  }

  getDashboardData(): any {
    const rateLimiter = getRateLimiter();
    
    return {
      timestamp: new Date(),
      uptime: Date.now() - this.metrics.system.uptime,
      rateLimits: rateLimiter.getAllStatus(),
      analytics: rateLimiter.getAnalytics(),
      metrics: this.metrics,
      alerts: this.alerts.filter(a => !a.acknowledged).slice(0, 10),
      recentLogs: this.logs.slice(0, 50),
      health: this.calculateOverallHealth()
    };
  }

  private calculateOverallHealth(): any {
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    const rateLimiter = getRateLimiter();
    const analytics = rateLimiter.getAnalytics();

    Object.keys(analytics).forEach((broker) => {
      const health = analytics[broker as BrokerType].health;
      if (health === 'poor') {
        issues.push(`${broker} rate limiter health is poor`);
        status = 'degraded';
      } else if (health === 'fair' && status === 'healthy') {
        status = 'degraded';
      }
    });

    const recentErrors = this.logs.filter(log => 
      log.level === 'error' && 
      Date.now() - new Date(log.timestamp).getTime() < 60000
    );

    if (recentErrors.length > 5) {
      issues.push(`${recentErrors.length} errors in last minute`);
      status = 'unhealthy';
    }

    return {
      status,
      issues,
      score: this.calculateHealthScore(issues.length, status)
    };
  }

  private calculateHealthScore(issueCount: number, status: string): number {
    let score = 100;
    score -= issueCount * 10;
    if (status === 'unhealthy') score = Math.min(score, 30);
    else if (status === 'degraded') score = Math.min(score, 60);
    return Math.max(0, score);
  }

  getLogs(filters: any = {}): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filters.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level);
    }

    if (filters.category) {
      filteredLogs = filteredLogs.filter(log => log.category === filters.category);
    }

    return filteredLogs.slice(0, filters.limit || 100);
  }

  getAlerts(filters: any = {}): Alert[] {
    let filteredAlerts = [...this.alerts];

    if (filters.severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === filters.severity);
    }

    if (filters.acknowledged !== undefined) {
      filteredAlerts = filteredAlerts.filter(alert => 
        alert.acknowledged === filters.acknowledged
      );
    }

    return filteredAlerts.slice(0, filters.limit || 50);
  }

  getStatistics(): any {
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);

    const logsLast24h = this.logs.filter(log => 
      new Date(log.timestamp).getTime() > last24h
    );

    return {
      totalLogs: this.logs.length,
      logsLast24h: logsLast24h.length,
      errorCount: this.logs.filter(log => log.level === 'error').length,
      warningCount: this.logs.filter(log => log.level === 'warning').length,
      activeAlerts: this.alerts.filter(a => !a.acknowledged).length,
      totalAlerts: this.alerts.length,
      apiCalls: this.metrics.apiCalls,
      uptime: Date.now() - this.metrics.system.uptime
    };
  }

  clearOldLogs(olderThanHours: number = 24): number {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    const originalLength = this.logs.length;
    
    this.logs = this.logs.filter(log => 
      new Date(log.timestamp).getTime() > cutoffTime
    );

    const removed = originalLength - this.logs.length;
    SimpleLogger.info(`Cleared ${removed} old logs`);
    return removed;
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

let monitoringServiceInstance: AdminMonitoringService | null = null;

export function getMonitoringService(): AdminMonitoringService {
  if (!monitoringServiceInstance) {
    monitoringServiceInstance = new AdminMonitoringService();
  }
  return monitoringServiceInstance;
}

export { AdminMonitoringService };
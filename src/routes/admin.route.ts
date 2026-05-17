import { Router, Request, Response } from 'express';
import { getRateLimiter, BrokerType } from '../services/unified-rate-limiter.service';
import { getMonitoringService } from '../services/admin-monitoring.service';
import { getUsageStats as getZerodhaUsage } from '../services/zerodha-rate-limiter.service';

const router = Router();
const monitoringService = getMonitoringService();

router.get('/dashboard', (req: Request, res: Response) => {
  try {
    const dashboardData = monitoringService.getDashboardData();
    res.json({
      success: true,
      data: dashboardData
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/health', (req: Request, res: Response) => {
  try {
    const rateLimiter = getRateLimiter();
    const analytics = rateLimiter.getAnalytics();
    
    const health = {
      status: 'healthy' as 'healthy' | 'degraded',
      timestamp: new Date(),
      brokers: {
        dhan: { connected: true },
        upstox: { connected: true },
        zerodha: { connected: true, usage: getZerodhaUsage() }
      },
      rateLimits: analytics,
      issues: [] as string[]
    };

    const brokerKeys: BrokerType[] = ['dhan', 'upstox', 'zerodha'];
    brokerKeys.forEach((broker) => {
      const data = analytics[broker];
      if (data && data.health === 'poor') {
        health.issues.push(`${broker} rate limiter health is poor`);
        health.status = 'degraded';
      }
    });

    res.json(health);
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

router.get('/rate-limits', (req: Request, res: Response) => {
  try {
    const rateLimiter = getRateLimiter();
    const status = rateLimiter.getAllStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/rate-limits/:broker', (req: Request, res: Response) => {
  try {
    const { broker } = req.params;
    const rateLimiter = getRateLimiter();
    const status = rateLimiter.getStatus(broker as BrokerType);
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/analytics', (req: Request, res: Response) => {
  try {
    const rateLimiter = getRateLimiter();
    const analytics = rateLimiter.getAnalytics();
    res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/logs', (req: Request, res: Response) => {
  try {
    const filters = {
      level: req.query.level as any,
      category: req.query.category as any,
      limit: parseInt(req.query.limit as string) || 100
    };

    const logs = monitoringService.getLogs(filters);
    res.json({
      success: true,
      data: logs,
      total: logs.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/alerts', (req: Request, res: Response) => {
  try {
    const filters = {
      severity: req.query.severity as any,
      acknowledged: req.query.acknowledged === 'true',
      limit: parseInt(req.query.limit as string) || 50
    };

    const alerts = monitoringService.getAlerts(filters);
    res.json({
      success: true,
      data: alerts,
      total: alerts.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/alerts/:alertId/acknowledge', (req: Request, res: Response) => {
  try {
    const alertId = req.params.alertId as string;
    monitoringService.acknowledgeAlert(alertId);
    res.json({
      success: true,
      message: 'Alert acknowledged'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/statistics', (req: Request, res: Response) => {
  try {
    const stats = monitoringService.getStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/rate-limits/reset-stats', (req: Request, res: Response) => {
  try {
    const { broker } = req.body;
    const rateLimiter = getRateLimiter();
    
    if (broker) {
      rateLimiter.resetStats(broker as BrokerType);
    } else {
      rateLimiter.resetAllStats();
    }

    res.json({
      success: true,
      message: broker ? `Stats reset for ${broker}` : 'All stats reset'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/rate-limits/clear-queue', (req: Request, res: Response) => {
  try {
    const { broker } = req.body;
    
    if (!broker) {
      return res.status(400).json({
        success: false,
        error: 'Broker name required'
      });
    }

    const rateLimiter = getRateLimiter();
    const cleared = rateLimiter.clearQueue(broker as BrokerType);
    
    res.json({
      success: true,
      message: `Cleared ${cleared} requests from ${broker} queue`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/logs/clear', (req: Request, res: Response) => {
  try {
    const { olderThanHours } = req.body;
    const removed = monitoringService.clearOldLogs(olderThanHours || 24);
    
    res.json({
      success: true,
      message: `Cleared ${removed} old logs`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/logs/export', (req: Request, res: Response) => {
  try {
    const data = monitoringService.exportLogs();
    const filename = `logs_${Date.now()}.json`;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/rate-limits/config', (req: Request, res: Response) => {
  try {
    const { maxCallsPerSecond } = req.body;
    
    if (!maxCallsPerSecond || maxCallsPerSecond < 1 || maxCallsPerSecond > 100) {
      return res.status(400).json({
        success: false,
        error: 'maxCallsPerSecond must be between 1 and 100'
      });
    }

    const rateLimiter = getRateLimiter();
    rateLimiter.setMaxCallsPerSecond(maxCallsPerSecond);
    
    res.json({
      success: true,
      message: `Rate limit updated to ${maxCallsPerSecond} calls/second`
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/zerodha-usage', (req: Request, res: Response) => {
  try {
    const usage = getZerodhaUsage();
    res.json({
      success: true,
      data: usage
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
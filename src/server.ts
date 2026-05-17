import app from "./app";
import { env } from "./config/env";
import { startLiveMarketCache } from "./services/live-market-cache.service";
import { loadTradesFromDisk } from "./services/paper-trade.service";
import { loadEnhancedJournalFromDisk } from "./services/enhanced-trade-journal.service";
import { startAutoTradeRunner } from "./services/auto-trade-runner.service";
import { loadCustomStocksFromDisk, warmInstrumentCache, getAllCustomStockSymbols } from "./services/custom-stocks.service";
import { startHotListScheduler } from "./services/hot-list-scheduler.service";
import { 
  initializeProfessionalCache, 
  buildMissingCachesInBackground,
  getCacheStats 
} from "./services/professional-cache-manager.service";
import { refreshIndexHistoricalCache } from "./services/index-history-cache.service";
import { startUpstoxMarketWs } from "./services/upstox-market-ws.service";
import { startLive1HCache } from "./services/live-1h-cache.service";
import { SimpleLogger } from "./utils/simple-logger";

// Suppress all debug/verbose environment logs
process.env.DEBUG = '';

app.listen(env.port, async () => {
  // Clear screen and show header
  console.clear();
  SimpleLogger.header('🚀 STOCK TRADING SYSTEM');
  SimpleLogger.row('Port', env.port.toString());
  SimpleLogger.row('Environment', env.nodeEnv);
  SimpleLogger.row('Dashboard', `http://localhost:${env.port}`);

  try {
    // PHASE 1: Load Stock Metadata
    SimpleLogger.line();
    SimpleLogger.info('Loading stock database...');
    await loadCustomStocksFromDisk();
    await warmInstrumentCache();
    
    // Share stock list with market-data-provider for smart distribution
    const { setCustomStocksList } = await import("./services/market-data-provider.service");
    const customStockSymbols = getAllCustomStockSymbols();
    setCustomStocksList(customStockSymbols);
    
    SimpleLogger.success('Stock metadata loaded');

    // PHASE 2: Zerodha API Connection
    if (env.zerodha.enabled) {
      SimpleLogger.line();
      SimpleLogger.info('Connecting to Zerodha API...');
      try {
        const { initializeZerodhaClient } = await import("./integrations/zerodha/zerodha.client");
        await initializeZerodhaClient();
        SimpleLogger.success('Zerodha authenticated');
      } catch (error) {
        SimpleLogger.warning('Zerodha connection failed - using Upstox only');
      }
    }

    // PHASE 2.5: Dhan API Connection
if (env.dhan.enabled) {
  SimpleLogger.line();
  SimpleLogger.info('Connecting to Dhan API...');
  try {
    const dhanModule = await import("./integrations/dhan/dhan.service");
    await dhanModule.authenticateDhan();
    
    // Share Dhan token with market-data-provider
    const marketDataProvider = await import("./services/market-data-provider.service");
    const token = dhanModule.getDhanAccessToken();
    if (token) {
      marketDataProvider.setDhanAccessToken(token);
    }
    
    SimpleLogger.success('Dhan authenticated');
  } catch (error) {
    SimpleLogger.warning('Dhan connection failed');
  }
}
    // PHASE 3: Build Historical Cache
    SimpleLogger.line();
    SimpleLogger.info('Building historical data cache...');
    SimpleLogger.info('This may take 5-10 minutes on first run');
    
    await initializeProfessionalCache();
    
    const stats = getCacheStats();
    
    if (stats.cache1D === 0) {
      SimpleLogger.error('CRITICAL: Cache initialization failed!');
      SimpleLogger.error('System cannot start without historical data');
      return;
    }

    SimpleLogger.success(`Cache ready: ${stats.cache1D} stocks (Daily) + ${stats.cache1H} stocks (Hourly)`);

    // PHASE 4: Load Index Data
    SimpleLogger.line();
    SimpleLogger.info('Loading index data for RRG charts...');
    await refreshIndexHistoricalCache();
    SimpleLogger.success('Index data loaded');

    // PHASE 5: Start Trading Services
    SimpleLogger.line();
    SimpleLogger.info('Starting trading services...');
    
    await startLiveMarketCache();
    await startLive1HCache();
    await loadTradesFromDisk();
    await loadEnhancedJournalFromDisk();
    await startHotListScheduler();
    await startAutoTradeRunner();
    
    // Start WebSocket AFTER hot list scan completes
    SimpleLogger.line();
    SimpleLogger.info('Starting live market WebSocket...');
    await startUpstoxMarketWs();
    SimpleLogger.success('WebSocket connected');
    
    SimpleLogger.success('All trading services started');

    // FINAL STATUS
    SimpleLogger.header('✅ SYSTEM READY');
    SimpleLogger.row('Stocks Tracked', stats.cache1D.toString());
    SimpleLogger.row('Auto-Trading', 'ENABLED');
    SimpleLogger.row('WebSocket', 'LIVE DATA STREAMING');
    SimpleLogger.row('Status', 'Monitoring market...');
    console.log('\n');

    // Background cache builder (if needed)
    if (stats.cache1H === 0) {
      SimpleLogger.info('Building hourly cache in background...');
      buildMissingCachesInBackground().catch((error) => {
        SimpleLogger.error('Background cache build failed');
      });
    }

  } catch (error) {
    SimpleLogger.header('❌ STARTUP FAILED');
    SimpleLogger.error('System could not start');
    console.error('Error details:', error);
  }
});
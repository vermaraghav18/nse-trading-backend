import cors from "cors";
import express from "express";
import automationRouter from "./routes/automation.route";
import bollingerRouter from "./routes/bollinger.route";
import candleRouter from "./routes/candle.route";
import chartRouter from "./routes/chart.route";
import dashboardRouter from "./routes/dashboard.route";
import healthRouter from "./routes/health.route";
import paperTradeRouter from "./routes/paper-trade.route";
import enhancedJournalRouter from "./routes/enhanced-journal.route";
import entryAnalysisRouter from "./routes/entry-blocker-analysis.route";
import signalRouter from "./routes/signal.route";
import stockRouter from "./routes/stock.route";
import strategyRouter from "./routes/strategy.route";
import emaRouter from "./routes/ema.route";
import candle1HRouter from "./routes/candle-1h.route";
import ema1HRouter from "./routes/ema-1h.route";
import bollinger1HRouter from "./routes/bollinger-1h.route";
import marketStatusRouter from "./routes/market-status.route";
import customStocksRouter from "./routes/custom-stocks.route";
import debugRoute from "./routes/debug.route";
import upstoxMarketWsRouter from "./routes/upstox-market-ws.route";
import rrgRouter from "./routes/rrg.route";
import weeklyScreenerRouter from "./routes/weekly-screener.route";
import gapScannerRouter from "./routes/gap-scanner.route";
import doubleBollingerRoute from "./routes/double-bollinger.route";
import scannerRouter from "./routes/scanner.route";
import heatmapRouter from "./routes/heatmap.route";
import adminRouter from "./routes/admin.route";
const app = express();

/**
 * Global middleware.
 * We keep middleware setup here so server.ts stays clean.
 */
app.use(cors());
app.use(express.json());

/**
 * Root route for quick browser testing.
 */
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    message: "Welcome to the stock trading system backend",
  });
});

/**
 * Health check route.
 */
app.use("/api/health", healthRouter);
app.use("/api/ema", emaRouter);

/**
 * Admin monitoring routes.
 */
app.use("/api/admin", adminRouter);

/**
 * Dashboard business routes.
 */
app.use("/api/double-bollinger", doubleBollingerRoute);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/candles-1h", candle1HRouter);
app.use("/api/ema-1h", ema1HRouter);
app.use("/api/bollinger-1h", bollinger1HRouter);
app.use("/api/market-status", marketStatusRouter);
app.use("/api/custom-stocks", customStocksRouter);
app.use("/api/scanner", scannerRouter);
app.use("/api", debugRoute);
app.use("/api/rrg", rrgRouter);
app.use("/api/upstox-market-ws", upstoxMarketWsRouter);

app.use("/api/screener/weekly", weeklyScreenerRouter);
app.use("/api/gap-scanner", gapScannerRouter);
app.use("/api/heatmap", heatmapRouter);
/**
 * Stock universe routes.
 */
app.use("/api/stocks", stockRouter);

/**
 * Candle routes.
 */
app.use("/api/candles", candleRouter);

/**
 * Chart routes.
 */
app.use("/api/chart", chartRouter);

/**
 * Bollinger routes.
 */
app.use("/api/bollinger", bollingerRouter);

/**
 * Signal routes.
 */
app.use("/api/signals", signalRouter);

/**
 * Strategy routes.
 */
app.use("/api/strategies", strategyRouter);

/**
 * Paper trade routes.
 */
app.use("/api/paper-trades", paperTradeRouter);

/**
 * Enhanced trade journal routes.
 */
app.use("/api/enhanced-journal", enhancedJournalRouter);

/**
 * Entry blocker analysis routes.
 */
app.use("/api/entry-analysis", entryAnalysisRouter);

/**
 * Automation routes.
 */
app.use("/api/automations", automationRouter);

export default app;
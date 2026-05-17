import { Router, Request, Response } from "express";
import { getStockChart1H, getStockChart2H } from "../services/chart.service";

const router = Router();

router.get("/debug/1h/:symbol", async (req: Request, res: Response) => {
  try {
    const symbol = String(req.params.symbol || "").trim();

    if (!symbol) {
      res.status(400).json({
        ok: false,
        message: "Symbol is required.",
      });
      return;
    }

    const chart = await getStockChart1H(symbol);

    if (!chart) {
      res.status(404).json({
        ok: false,
        message: `No 1H chart data found for ${symbol}.`,
      });
      return;
    }

    const lastCandle = chart.candles[chart.candles.length - 1] ?? null;
    const lastEma = chart.ema44[chart.ema44.length - 1] ?? null;
    const lastBollinger =
      chart.bollinger20[chart.bollinger20.length - 1] ?? null;
    const lastVwap = chart.vwap[chart.vwap.length - 1] ?? null;

    res.json({
      ok: true,
      symbol: chart.symbol,
      instrumentKey: chart.instrumentKey,
      timeframe: chart.timeframe,
      totalCandles: chart.candles.length,
      lastCandle,
      lastEma,
      lastBollinger,
      lastVwap,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    res.status(500).json({
      ok: false,
      message,
    });
  }
});

router.get("/debug/2h/:symbol", async (req: Request, res: Response) => {
  try {
    const symbol = String(req.params.symbol || "").trim();

    if (!symbol) {
      res.status(400).json({
        ok: false,
        message: "Symbol is required.",
      });
      return;
    }

    const chart = await getStockChart2H(symbol);

    if (!chart) {
      res.status(404).json({
        ok: false,
        message: `No 2H chart data found for ${symbol}.`,
      });
      return;
    }

    const lastCandle = chart.candles[chart.candles.length - 1] ?? null;
    const lastEma = chart.ema44[chart.ema44.length - 1] ?? null;
    const lastBollinger =
      chart.bollinger20[chart.bollinger20.length - 1] ?? null;
    const lastVwap = chart.vwap[chart.vwap.length - 1] ?? null;

    res.json({
      ok: true,
      symbol: chart.symbol,
      instrumentKey: chart.instrumentKey,
      timeframe: chart.timeframe,
      totalCandles: chart.candles.length,
      lastCandle,
      lastEma,
      lastBollinger,
      lastVwap,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    res.status(500).json({
      ok: false,
      message,
    });
  }
});

export default router;
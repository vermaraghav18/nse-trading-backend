import { Request, Response } from "express";
import { getLatestEma1H } from "../services/ema-1h.service";
import { getCachedHistorical1HSeries } from "../services/market-history-1h-cache.service";
import { getCachedLive1HCandles } from "../services/live-1h-cache.service";

export const getEma1H = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const results = await getLatestEma1H();

    res.status(200).json({
      ok: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Failed to fetch 1H EMA:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to fetch 1H EMA data.",
    });
  }
};

export const debugEma1H = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const historicalSeries = getCachedHistorical1HSeries();
    const liveCandles = getCachedLive1HCandles();

    const marutiHistory = historicalSeries.find(
      (item) => item.symbol === "MARUTI"
    );
    const marutiLive = liveCandles.find((item) => item.symbol === "MARUTI");

    res.status(200).json({
      ok: true,
      historicalCount: historicalSeries.length,
      liveCount: liveCandles.length,
      marutiHistoryCandleCount: marutiHistory?.candles.length || 0,
      marutiLatestHistoryCandle: marutiHistory?.candles?.[0] || null,
      marutiOldestHistoryCandle:
        marutiHistory?.candles?.[marutiHistory.candles.length - 1] || null,
      marutiLiveCandle: marutiLive || null,
    });
  } catch (error) {
    console.error("Failed to debug 1H EMA:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to debug 1H EMA data.",
    });
  }
};
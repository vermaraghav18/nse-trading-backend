import { Request, Response } from "express";
import { getCachedLive1HCandles } from "../services/live-1h-cache.service";

/**
 * Returns latest cached 1H candle data.
 */
export const getCandles1H = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const candles = getCachedLive1HCandles();

    res.status(200).json({
      ok: true,
      count: candles.length,
      data: candles,
    });
  } catch (error) {
    console.error("Failed to fetch 1H candles:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to fetch 1H candle data.",
    });
  }
};
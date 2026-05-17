import { Request, Response } from "express";
import { getAllCandles } from "../services/candle.service";

/**
 * Returns daily candle data for the current system.
 */
export const getCandles = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const candles = await getAllCandles();

    res.status(200).json({
      ok: true,
      count: candles.length,
      data: candles,
    });
  } catch (error) {
    console.error("Failed to fetch candles:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to fetch candle data from Upstox.",
    });
  }
};
import { Request, Response } from "express";
import { getLatestBollingerBands } from "../services/bollinger.service";

/**
 * Returns the latest Bollinger Band results for all available stocks.
 */
export const getBollingerBands = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const results = await getLatestBollingerBands();

    res.status(200).json({
      ok: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Failed to fetch Bollinger Bands:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to calculate Bollinger Bands from real candles.",
    });
  }
};
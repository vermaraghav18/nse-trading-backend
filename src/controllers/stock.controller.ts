import { Request, Response } from "express";
import { getAllStocks } from "../services/stock.service";

/**
 * Returns the stock universe list for the platform.
 */
export const getStocks = async (_req: Request, res: Response): Promise<void> => {
  try {
    const stocks = await getAllStocks();

    res.status(200).json({
      ok: true,
      count: stocks.length,
      data: stocks,
    });
  } catch (error) {
    console.error("Failed to fetch stocks:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to fetch stock universe from Upstox.",
    });
  }
};
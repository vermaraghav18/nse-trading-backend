import { Request, Response } from "express";
import { getLatestBollinger1H } from "../services/bollinger-1h.service";

export const getBollinger1H = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const results = getLatestBollinger1H();

    res.status(200).json({
      ok: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Failed to fetch 1H Bollinger:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to fetch 1H Bollinger data.",
    });
  }
};
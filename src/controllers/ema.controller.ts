import { Request, Response } from "express";
import { getLatestEma44 } from "../services/ema.service";

export const getEma44 = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const results = getLatestEma44();

    res.status(200).json({
      ok: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Failed to fetch EMA 44:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to fetch EMA 44 data.",
    });
  }
};
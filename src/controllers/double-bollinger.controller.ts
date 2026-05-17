import { Request, Response } from "express";
import { getDoubleBollingerConfirmation } from "../services/double-bollinger.service";

export const getDoubleBollinger = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const results = await getDoubleBollingerConfirmation();

    res.status(200).json({
      ok: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error("Failed to fetch Double Bollinger Confirmation:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to calculate Double Bollinger Confirmation.",
    });
  }
};
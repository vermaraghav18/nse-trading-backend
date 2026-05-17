import { Request, Response } from "express";
import { getStrategyDecisions } from "../services/strategy.service";

/**
 * Returns strategy-level trade decisions.
 */
export const getStrategies = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const decisions = await getStrategyDecisions();

    res.status(200).json({
      ok: true,
      count: decisions.length,
      data: decisions,
    });
  } catch (error) {
    console.error("Failed to fetch strategies:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to build strategy decisions from signals.",
    });
  }
};
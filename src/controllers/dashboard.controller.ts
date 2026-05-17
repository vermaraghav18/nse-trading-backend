import { Request, Response } from "express";

/**
 * Returns the first dashboard summary.
 * Right now this is static project data.
 * Later it will come from database and live system services.
 */
export const getDashboardSummary = (_req: Request, res: Response): void => {
  res.status(200).json({
    ok: true,
    data: {
      stocksTracked: "Nifty 50",
      primaryTimeframe: "1D",
      indicatorEngine: "Bollinger",
      paperTrading: "Mock / Not Live Yet",
      systemPhase: "Foundation",
      liveStatus: "Active",
    },
  });
};
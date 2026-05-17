import { Request, Response } from "express";

/**
 * Simple health check controller.
 * We use this first to verify backend boot is working.
 */
export const getHealth = (_req: Request, res: Response): void => {
  res.status(200).json({
    ok: true,
    message: "Backend is running",
    service: "stock-trading-system-api",
    time: new Date().toISOString(),
  });
};
import { Request, Response } from "express";
import { getNseMarketSessionStatus } from "../services/nse-market-calendar.service";

export function getMarketStatus(_req: Request, res: Response): void {
  const session = getNseMarketSessionStatus();

  res.json({
    ok: true,
    data: session,
  });
}
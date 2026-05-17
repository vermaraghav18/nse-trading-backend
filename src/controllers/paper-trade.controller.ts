import { Request, Response } from "express";
import { getPaperTrades } from "../services/paper-trade.service";

export const getAllPaperTrades = (_req: Request, res: Response): void => {
  const result = getPaperTrades();

  res.status(200).json({
    ok: true,
    data: result,
  });
};
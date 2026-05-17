import { Router, Request, Response } from "express";
import { getCachedWeeklyScreener } from "../services/weekly-screener-cache.service";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const data = getCachedWeeklyScreener();
  res.status(200).json({ ok: true, ...data });
});

export default router;
import { Router, Request, Response } from "express";
import { getGapScanRows } from "../services/gap-scanner.service";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const rows = await getGapScanRows();

    const gapUp   = rows.filter(r => r.direction === "GAP_UP").length;
    const gapDown = rows.filter(r => r.direction === "GAP_DOWN").length;
    const valid   = rows.filter(r => r.isValid).length;

    res.status(200).json({
      ok: true,
      summary: { total: rows.length, gapUp, gapDown, valid },
      rows,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[gap-scanner] Failed:", error);
    res.status(500).json({
      ok: false,
      message: error instanceof Error ? error.message : "Gap scanner failed",
    });
  }
});

export default router;
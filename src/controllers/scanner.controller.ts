import { Request, Response } from "express";
import {
  getCachedScannerSnapshot1D,
  getCachedScannerSnapshot1H,
  getCachedScannerSnapshot2H,
} from "../services/scanner-snapshot-cache.service";

/**
 * GET /api/scanner/snapshot/1D
 * Get cached 1D scanner snapshot
 */
export async function getSnapshot1D(_req: Request, res: Response) {
  try {
    const snapshot = getCachedScannerSnapshot1D();
    res.json(snapshot);
  } catch (error) {
    console.error("Error in getSnapshot1D:", error);
    res.status(500).json({
      error: "Failed to fetch 1D scanner snapshot",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * GET /api/scanner/snapshot/1H
 * Get cached 1H scanner snapshot
 */
export async function getSnapshot1H(_req: Request, res: Response) {
  try {
    const snapshot = getCachedScannerSnapshot1H();
    res.json(snapshot);
  } catch (error) {
    console.error("Error in getSnapshot1H:", error);
    res.status(500).json({
      error: "Failed to fetch 1H scanner snapshot",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * GET /api/scanner/snapshot/2H
 * Get cached 2H scanner snapshot
 */
export async function getSnapshot2H(_req: Request, res: Response) {
  try {
    const snapshot = getCachedScannerSnapshot2H();
    res.json(snapshot);
  } catch (error) {
    console.error("Error in getSnapshot2H:", error);
    res.status(500).json({
      error: "Failed to fetch 2H scanner snapshot",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

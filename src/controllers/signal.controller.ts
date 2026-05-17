import { Request, Response } from "express";
import {
  getSignalSummaries,
  getEnhancedSignalSummaries,
  getIndicatorHealth,
} from "../services/signal.service";

/**
 * GET /api/signals
 * Original signal summaries (Bollinger only) - for backward compatibility
 */
export async function getSignals(_req: Request, res: Response) {
  try {
    const signals = await getSignalSummaries();
    res.json({
      ok: true,
      count: signals.length,
      data: signals
    });
  } catch (error) {
    console.error("Error in getSignals:", error);
    res.status(500).json({
      ok: false,
      count: 0,
      data: [],
      error: "Failed to fetch signals",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * GET /api/signals/enhanced
 * Enhanced signal summaries with multi-indicator confluence
 */
export async function getEnhancedSignals(_req: Request, res: Response) {
  try {
    const signals = await getEnhancedSignalSummaries();
    res.json(signals);
  } catch (error) {
    console.error("Error in getEnhancedSignals:", error);
    res.status(500).json({
      error: "Failed to fetch enhanced signals",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * GET /api/signals/health
 * Get health status of all indicators
 */
export async function getHealth(_req: Request, res: Response) {
  try {
    const health = await getIndicatorHealth();
    res.json(health);
  } catch (error) {
    console.error("Error in getHealth:", error);
    res.status(500).json({
      error: "Failed to fetch indicator health",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
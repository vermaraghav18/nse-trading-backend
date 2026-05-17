import { Router } from "express";
import {
  getSignals,
  getEnhancedSignals,
  getHealth,
} from "../controllers/signal.controller";

const router = Router();

/**
 * GET /api/signals
 * Get signal summaries (original - Bollinger only)
 */
router.get("/", getSignals);

/**
 * GET /api/signals/enhanced
 * Get enhanced signal summaries with multi-indicator confluence
 */
router.get("/enhanced", getEnhancedSignals);

/**
 * GET /api/signals/health
 * Get health status of all indicators
 */
router.get("/health", getHealth);

export default router;
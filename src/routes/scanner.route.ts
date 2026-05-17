import { Router } from "express";
import {
  getSnapshot1D,
  getSnapshot1H,
  getSnapshot2H,
} from "../controllers/scanner.controller";

const router = Router();

/**
 * GET /api/scanner/snapshot/1D
 * Get cached 1D scanner snapshot
 */
router.get("/snapshot/1D", getSnapshot1D);

/**
 * GET /api/scanner/snapshot/1H
 * Get cached 1H scanner snapshot
 */
router.get("/snapshot/1H", getSnapshot1H);

/**
 * GET /api/scanner/snapshot/2H
 * Get cached 2H scanner snapshot
 */
router.get("/snapshot/2H", getSnapshot2H);

export default router;

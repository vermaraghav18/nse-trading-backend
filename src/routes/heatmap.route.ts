import { Router } from "express";
import {
  handleGetIndicesHeatmap,
  handleGetStocksHeatmap,
  handleGetAvailableIndices,
} from "../controllers/heatmap.controller";

const heatmapRouter = Router();

/**
 * GET /api/heatmap/indices
 * Fetch heatmap data for all market indices
 */
heatmapRouter.get("/indices", handleGetIndicesHeatmap);

/**
 * GET /api/heatmap/stocks/:indexSymbol
 * Fetch heatmap data for stocks within a specific index
 * Example: /api/heatmap/stocks/NIFTY50
 */
heatmapRouter.get("/stocks/:indexSymbol", handleGetStocksHeatmap);

/**
 * GET /api/heatmap/indices/list
 * Get list of available indices organized by category
 */
heatmapRouter.get("/indices/list", handleGetAvailableIndices);

export default heatmapRouter;
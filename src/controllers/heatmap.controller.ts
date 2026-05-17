import type { Request, Response } from "express";
import {
  getIndicesHeatmap,
  getStocksHeatmap,
} from "../services/heatmap.service";

/**
 * GET /api/heatmap/indices
 * Returns heatmap data for all market indices
 */
export async function handleGetIndicesHeatmap(req: Request, res: Response): Promise<void> {
  try {
    const data = await getIndicesHeatmap();
    res.json(data);
  } catch (error) {
    console.error("[heatmap-controller] Failed to get indices heatmap:", error);
    
    res.status(500).json({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch indices heatmap",
    });
  }
}

/**
 * GET /api/heatmap/stocks/:indexSymbol
 * Returns heatmap data for stocks in a specific index
 */
export async function handleGetStocksHeatmap(req: Request, res: Response): Promise<void> {
  try {
    const indexSymbolParam = req.params.indexSymbol;
    const indexSymbol = Array.isArray(indexSymbolParam) ? indexSymbolParam[0] : indexSymbolParam;
    
    if (!indexSymbol) {
      res.status(400).json({
        ok: false,
        message: "Index symbol is required",
      });
      return;
    }
    
    const data = await getStocksHeatmap(indexSymbol);
    res.json(data);
  } catch (error) {
    console.error(
      `[heatmap-controller] Failed to get stocks heatmap for ${req.params.indexSymbol}:`,
      error
    );
    
    res.status(500).json({
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch stocks heatmap",
    });
  }
}

/**
 * GET /api/heatmap/indices/list
 * Returns list of available indices organized by category
 */
export async function handleGetAvailableIndices(req: Request, res: Response): Promise<void> {
  try {
    // Hardcoded list of available indices
    const indices = {
      sectoral: [
        { symbol: "NIFTYBANK", name: "Nifty Bank" },
        { symbol: "NIFTYIT", name: "Nifty IT" },
        { symbol: "NIFTYPHARMA", name: "Nifty Pharma" },
        { symbol: "NIFTYFMCG", name: "Nifty FMCG" },
        { symbol: "NIFTYAUTO", name: "Nifty Auto" },
        { symbol: "NIFTYMETAL", name: "Nifty Metal" },
        { symbol: "NIFTYREALTY", name: "Nifty Realty" },
        { symbol: "NIFTYPSUBANK", name: "Nifty PSU Bank" },
        { symbol: "NIFTYENERGY", name: "Nifty Energy" },
      ],
      broad: [
        { symbol: "NIFTY50", name: "Nifty 50" },
        { symbol: "NIFTYNEXT50", name: "Nifty Next 50" },
        { symbol: "NIFTYMIDCAP50", name: "Nifty Midcap 50" },
        { symbol: "NIFTYMIDCAP100", name: "Nifty Midcap 100" },
      ],
    };
    
    res.json({
      ok: true,
      data: indices,
    });
  } catch (error) {
    console.error("[heatmap-controller] Failed to get available indices:", error);
    
    res.status(500).json({
      ok: false,
      message: "Failed to fetch available indices",
    });
  }
}
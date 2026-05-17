import { Router, Request, Response } from "express";
import { analyzeEntryBlockers } from "../services/entry-blocker-analysis.service";
import { getCachedScannerSnapshot1D } from "../services/scanner-snapshot-cache.service";
import { getLatestBollinger1H } from "../services/bollinger-1h.service";
import { getLatestEma1H } from "../services/ema-1h.service";

const router = Router();

/**
 * GET /api/entry-analysis/:symbol
 * 
 * Analyzes why a specific stock didn't trigger a buy signal
 * 
 * Example: GET /api/entry-analysis/SUNPHARMA
 */
router.get("/:symbol", async (req: Request, res: Response) => {
  try {
   const symbol = req.params.symbol;

if (!symbol || typeof symbol !== 'string') {
  return res.status(400).json({
    ok: false,
    error: "Symbol parameter is required",
  });
}

const normalizedSymbol = symbol.trim().toUpperCase();

    // Get scanner snapshot (this has all the daily data)
    const scannerSnapshot = getCachedScannerSnapshot1D();
    
    if (!scannerSnapshot || !scannerSnapshot.rows || scannerSnapshot.rows.length === 0) {
      return res.status(503).json({
        ok: false,
        error: "Scanner data not ready. Please wait for system to initialize.",
      });
    }

    const stockRow = scannerSnapshot.rows.find((r) => r.symbol === normalizedSymbol);

    if (!stockRow) {
      return res.status(404).json({
        ok: false,
        error: `Stock ${normalizedSymbol} not found in scanner data`,
      });
    }

    // Get 1H Bollinger data (returns array)
    const boll1HArray = getLatestBollinger1H();
    const boll1H = boll1HArray.find((b) => b.symbol === normalizedSymbol) || null;

    // Get 1H EMA data (returns array)
    const ema1HArray = await getLatestEma1H();
    const ema1H = ema1HArray.find((e) => e.symbol === normalizedSymbol) || null;

    // For now, use 1H data as proxy for 2H
    // (We can create dedicated 2H endpoints later if needed)
    const boll2H = boll1H;
    const ema2H = ema1H;

    // Run the analysis
    const analysis = analyzeEntryBlockers(stockRow, {
      boll1H,
      ema1H,
      boll2H,
      ema2H,
    });

    res.json({
      ok: true,
      data: analysis,
    });
  } catch (error) {
    console.error("[entry-analysis] Error analyzing stock:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to analyze entry blockers",
    });
  }
});

/**
 * GET /api/entry-analysis
 * 
 * Analyzes all stocks and returns those with blockers
 * 
 * Query params:
 * - showOnlyBlocked: true/false (default: false)
 * - showOnlyReady: true/false (default: false)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const showOnlyBlocked = req.query.showOnlyBlocked === "true";
    const showOnlyReady = req.query.showOnlyReady === "true";

    // Get scanner snapshot
    const scannerSnapshot = getCachedScannerSnapshot1D();
    
    if (!scannerSnapshot || !scannerSnapshot.rows || scannerSnapshot.rows.length === 0) {
      return res.status(503).json({
        ok: false,
        error: "Scanner data not ready. Please wait for system to initialize.",
      });
    }

    // Get 1H data (returns arrays)
    const boll1HArray = getLatestBollinger1H();
    const ema1HArray = await getLatestEma1H();

    const analyses = [];

    for (const stockRow of scannerSnapshot.rows) {
      const boll1H = boll1HArray.find((b) => b.symbol === stockRow.symbol) || null;
      const ema1H = ema1HArray.find((e) => e.symbol === stockRow.symbol) || null;

      const analysis = analyzeEntryBlockers(stockRow, {
        boll1H,
        ema1H,
        boll2H: boll1H, // Using 1H as proxy for 2H
        ema2H: ema1H,
      });

      // Filter based on query params
      if (showOnlyBlocked && analysis.canEnter) continue;
      if (showOnlyReady && !analysis.canEnter) continue;

      analyses.push(analysis);
    }

    // Sort by: Ready first, then by number of opportunities
    analyses.sort((a, b) => {
      if (a.canEnter && !b.canEnter) return -1;
      if (!a.canEnter && b.canEnter) return 1;
      return b.opportunities.length - a.opportunities.length;
    });

    res.json({
      ok: true,
      data: {
        total: analyses.length,
        ready: analyses.filter((a) => a.canEnter).length,
        blocked: analyses.filter((a) => !a.canEnter).length,
        analyses: analyses,
      },
    });
  } catch (error) {
    console.error("[entry-analysis] Error analyzing all stocks:", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to analyze entry blockers",
    });
  }
});

export default router;
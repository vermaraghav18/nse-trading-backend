import { Router } from "express";
import {
  getEnhancedJournal,
  getEnhancedTradeById,
  exportEnhancedJournalAsJson,
} from "../services/enhanced-trade-journal.service";

const router = Router();

/**
 * GET /api/enhanced-journal
 * Returns all enhanced trades with complete context
 */
router.get("/", (_req, res) => {
  try {
    const journal = getEnhancedJournal();
    
    res.json({
      ok: true,
      data: {
        trades: journal,
        count: journal.length,
        openCount: journal.filter((t) => t.status === "OPEN").length,
        closedCount: journal.filter((t) => t.status === "CLOSED").length,
      },
    });
  } catch (error) {
    console.error("[enhanced-journal-route] Error fetching journal:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch enhanced journal",
    });
  }
});

/**
 * GET /api/enhanced-journal/:id
 * Returns a single enhanced trade by ID
 */
router.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const trade = getEnhancedTradeById(id);
    
    if (!trade) {
      return res.status(404).json({
        ok: false,
        error: "Trade not found",
      });
    }
    
    res.json({
      ok: true,
      data: trade,
    });
  } catch (error) {
    console.error("[enhanced-journal-route] Error fetching trade:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch trade",
    });
  }
});

/**
 * GET /api/enhanced-journal/export/json
 * Export entire journal as formatted JSON
 */
router.get("/export/json", (_req, res) => {
  try {
    const json = exportEnhancedJournalAsJson();
    
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="enhanced-trade-journal-${new Date().toISOString().split("T")[0]}.json"`
    );
    res.send(json);
  } catch (error) {
    console.error("[enhanced-journal-route] Error exporting journal:", error);
    res.status(500).json({
      ok: false,
      error: "Failed to export journal",
    });
  }
});

export default router;
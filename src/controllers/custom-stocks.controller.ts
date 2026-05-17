import { Request, Response } from "express";
import {
  searchInstruments,
  addCustomStock,
  removeCustomStock,
  getCustomStockEntries,
} from "../services/custom-stocks.service";

export async function searchStocks(req: Request, res: Response) {
  try {
    const query = (req.query.q as string) || "";
    const results = searchInstruments(query);
    res.json({ ok: true, data: results });
  } catch (error) {
    console.error("[custom-stocks] Search failed:", error);
    res.status(500).json({ ok: false, error: "Search failed." });
  }
}

export async function addStock(req: Request, res: Response) {
  try {
    const { symbol, instrumentKey, name } = req.body;

    if (!symbol || !instrumentKey) {
      res.status(400).json({ ok: false, error: "symbol and instrumentKey are required." });
      return;
    }

    const result = await addCustomStock(symbol, instrumentKey, name || symbol);
    res.json(result);
  } catch (error) {
    console.error("[custom-stocks] Add failed:", error);
    res.status(500).json({ ok: false, error: "Failed to add stock." });
  }
}

export async function removeStock(req: Request<{ symbol: string }>, res: Response) {
  try {
    const { symbol } = req.params;

    const result = await removeCustomStock(symbol);
    res.json(result);
  } catch (error) {
    console.error("[custom-stocks] Remove failed:", error);
    res.status(500).json({ ok: false, error: "Failed to remove stock." });
  }
}


export async function listCustomStocks(_req: Request, res: Response) {
  try {
    const entries = getCustomStockEntries();
    res.json({ ok: true, data: entries });
  } catch (error) {
    console.error("[custom-stocks] List failed:", error);
    res.status(500).json({ ok: false, error: "Failed to list custom stocks." });
  }
}
import { Request, Response } from "express";
import {
  getStockChart1D,
  getStockChart1H,
  getStockChart2H,
} from "../services/chart.service";
import {
  getCachedScannerSnapshot1D,
  getCachedScannerSnapshot1H,
  getCachedScannerSnapshot2H,
} from "../services/scanner-snapshot-cache.service";
export const getChart1DBySymbol = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const symbol = String(req.params.symbol || "").trim();

    if (!symbol) {
      res.status(400).json({
        ok: false,
        message: "Symbol is required.",
      });
      return;
    }

    const chart = await getStockChart1D(symbol);

    if (!chart) {
      res.status(404).json({
        ok: false,
        message: `No 1D chart data found for symbol ${symbol}.`,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      data: chart,
    });
  } catch (error) {
    console.error("Failed to fetch 1D chart data:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch stock chart data.",
    });
  }
};

export const getChart1HBySymbol = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const symbol = String(req.params.symbol || "").trim();

    if (!symbol) {
      res.status(400).json({
        ok: false,
        message: "Symbol is required.",
      });
      return;
    }

    const chart = await getStockChart1H(symbol);

    if (!chart) {
      res.status(404).json({
        ok: false,
        message: `No 1H chart data found for symbol ${symbol}. 1H data may not be cached yet.`,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      data: chart,
    });
  } catch (error) {
    console.error("Failed to fetch 1H chart data:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch 1H chart data.",
    });
  }
};

export const getChart2HBySymbol = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const symbol = String(req.params.symbol || "").trim();

    if (!symbol) {
      res.status(400).json({
        ok: false,
        message: "Symbol is required.",
      });
      return;
    }

    const chart = await getStockChart2H(symbol);

    if (!chart) {
      res.status(404).json({
        ok: false,
        message: `No 2H chart data found for symbol ${symbol}. 2H data is derived from 1H cache.`,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      data: chart,
    });
  } catch (error) {
    console.error("Failed to fetch 2H chart data:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch 2H chart data.",
    });
  }
};

export const getChart1DScanner = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const scanner = getCachedScannerSnapshot1D();

    res.status(200).json({
      ok: true,
      data: scanner,
    });
  } catch (error) {
    console.error("Failed to fetch cached 1D stock scanner:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch 1D stock scanner.",
    });
  }
};

export const getChart1HScanner = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const scanner = getCachedScannerSnapshot1H();

    res.status(200).json({
      ok: true,
      data: scanner,
    });
  } catch (error) {
    console.error("Failed to fetch cached 1H stock scanner:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch 1H stock scanner.",
    });
  }
};
export const getChart2HScanner = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const scanner = getCachedScannerSnapshot2H();

    res.status(200).json({
      ok: true,
      data: scanner,
    });
  } catch (error) {
    console.error("Failed to fetch cached 2H stock scanner:", error);
    res.status(500).json({
      ok: false,
      message: "Failed to fetch 2H stock scanner.",
    });
  }
};
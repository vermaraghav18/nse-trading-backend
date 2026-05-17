import { Router, Request, Response } from "express";
import {
  forceReconnectUpstoxMarketWs,
  getLatestDecodedFeed,
  getLatestDecodedInstrumentFeed,
  getLatestLtpcByInstrument,
  getLatestLtpcMap,
  getLatestMinuteCandlesByInstrument,
  getLatestMinuteCandleMap,
  getMerged1HCandlesByInstrument,
  getMerged2HCandlesByInstrument,
  getUpstoxMarketWsStatus,
} from "../services/upstox-market-ws.service";
import { getAllStocks } from "../services/stock.service";

const router = Router();

async function resolveInstrumentKeyFromParam(
  stockParam: string
): Promise<string | null> {
  const normalized = stockParam.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("NSE_EQ|")) {
    return normalized;
  }

  const stocks = await getAllStocks();
  const matched = stocks.find(
    (stock) => stock.symbol.trim().toUpperCase() === normalized
  );

  return matched?.instrumentKey ?? null;
}

router.get("/status", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    data: getUpstoxMarketWsStatus(),
  });
});

router.get("/live", (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    data: getLatestDecodedFeed(),
  });
});

router.get("/live/:instrumentKey", (req: Request, res: Response) => {
  const instrumentKey = String(req.params.instrumentKey || "").trim();

  if (!instrumentKey) {
    res.status(400).json({
      ok: false,
      message: "instrumentKey is required.",
    });
    return;
  }

  const feed = getLatestDecodedInstrumentFeed(instrumentKey);

  res.status(200).json({
    ok: true,
    instrumentKey,
    data: feed,
  });
});

router.get("/ltpc", (_req: Request, res: Response) => {
  const entries = Array.from(getLatestLtpcMap().values());

  res.status(200).json({
    ok: true,
    count: entries.length,
    data: entries,
  });
});

router.get("/ltpc/:instrumentKey", (req: Request, res: Response) => {
  const instrumentKey = String(req.params.instrumentKey || "").trim();

  if (!instrumentKey) {
    res.status(400).json({
      ok: false,
      message: "instrumentKey is required.",
    });
    return;
  }

  const data = getLatestLtpcByInstrument(instrumentKey);

  res.status(200).json({
    ok: true,
    instrumentKey,
    data,
  });
});

router.get("/minute-candles", (_req: Request, res: Response) => {
  const entries = Array.from(getLatestMinuteCandleMap().entries()).map(
    ([instrumentKey, candles]) => ({
      instrumentKey,
      candles,
    })
  );

  res.status(200).json({
    ok: true,
    count: entries.length,
    data: entries,
  });
});

router.get("/minute-candles/:stock", async (req: Request, res: Response) => {
  const stock = String(req.params.stock || "").trim();

  if (!stock) {
    res.status(400).json({
      ok: false,
      message: "stock is required.",
    });
    return;
  }

  const instrumentKey = await resolveInstrumentKeyFromParam(stock);

  if (!instrumentKey) {
    res.status(404).json({
      ok: false,
      message: `No instrument found for ${stock}.`,
    });
    return;
  }

  const candles = getLatestMinuteCandlesByInstrument(instrumentKey);

  res.status(200).json({
    ok: true,
    stock,
    instrumentKey,
    count: candles.length,
    data: candles,
  });
});

router.get("/candles/1h/:stock", async (req: Request, res: Response) => {
  const stock = String(req.params.stock || "").trim();

  if (!stock) {
    res.status(400).json({
      ok: false,
      message: "stock is required.",
    });
    return;
  }

  const instrumentKey = await resolveInstrumentKeyFromParam(stock);

  if (!instrumentKey) {
    res.status(404).json({
      ok: false,
      message: `No instrument found for ${stock}.`,
    });
    return;
  }

  try {
    const candles = await getMerged1HCandlesByInstrument(instrumentKey);

    res.status(200).json({
      ok: true,
      stock,
      instrumentKey,
      timeframe: "1H",
      count: candles.length,
      data: candles,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build 1H candles.";

    res.status(500).json({
      ok: false,
      message,
    });
  }
});

router.get("/candles/2h/:stock", async (req: Request, res: Response) => {
  const stock = String(req.params.stock || "").trim();

  if (!stock) {
    res.status(400).json({
      ok: false,
      message: "stock is required.",
    });
    return;
  }

  const instrumentKey = await resolveInstrumentKeyFromParam(stock);

  if (!instrumentKey) {
    res.status(404).json({
      ok: false,
      message: `No instrument found for ${stock}.`,
    });
    return;
  }

  try {
    const candles = await getMerged2HCandlesByInstrument(instrumentKey);

    res.status(200).json({
      ok: true,
      stock,
      instrumentKey,
      timeframe: "2H",
      count: candles.length,
      data: candles,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build 2H candles.";

    res.status(500).json({
      ok: false,
      message,
    });
  }
});

router.post("/reconnect", (_req: Request, res: Response) => {
  forceReconnectUpstoxMarketWs();

  res.status(200).json({
    ok: true,
    message: "Reconnect triggered.",
  });
});

export default router;
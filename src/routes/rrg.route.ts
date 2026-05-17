import { Router } from "express";
import { getIndexRrg1D } from "../services/rrg.service";

const rrgRouter = Router();

// Daily RRG
rrgRouter.get("/indices/1d", async (req, res) => {
  try {
    const benchmark =
      typeof req.query.benchmark === "string"
        ? req.query.benchmark
        : "NIFTY50";

    const data = await getIndexRrg1D(benchmark);
    res.json(data);
  } catch (error) {
    console.error("[rrg] Failed to build indices 1D RRG:", error);

    res.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Failed to build indices RRG data",
    });
  }
});

// Weekly RRG
rrgRouter.get("/indices/1w", async (req, res) => {
  try {
    const benchmark =
      typeof req.query.benchmark === "string"
        ? req.query.benchmark
        : "NIFTY50";

    const data = await getIndexRrg1D(benchmark); // Uses same data, frontend will sample weekly points
    res.json(data);
  } catch (error) {
    console.error("[rrg] Failed to build indices 1W RRG:", error);

    res.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Failed to build indices RRG data",
    });
  }
});

// Monthly RRG
rrgRouter.get("/indices/1m", async (req, res) => {
  try {
    const benchmark =
      typeof req.query.benchmark === "string"
        ? req.query.benchmark
        : "NIFTY50";

    const data = await getIndexRrg1D(benchmark); // Uses same data, frontend will sample monthly points
    res.json(data);
  } catch (error) {
    console.error("[rrg] Failed to build indices 1M RRG:", error);

    res.status(500).json({
      ok: false,
      message:
        error instanceof Error ? error.message : "Failed to build indices RRG data",
    });
  }
});

export default rrgRouter;
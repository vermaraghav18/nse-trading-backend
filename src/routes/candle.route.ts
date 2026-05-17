import { Router } from "express";
import { getCandles } from "../controllers/candle.controller";

const candleRouter = Router();

/**
 * Candle routes for stock daily candle data.
 */
candleRouter.get("/", getCandles);

export default candleRouter;
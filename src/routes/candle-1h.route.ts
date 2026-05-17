import { Router } from "express";
import { getCandles1H } from "../controllers/candle-1h.controller";

const candle1HRouter = Router();

/**
 * 1H candle route.
 */
candle1HRouter.get("/", getCandles1H);

export default candle1HRouter;
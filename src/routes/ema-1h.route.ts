import { Router } from "express";
import { debugEma1H, getEma1H } from "../controllers/ema-1h.controller";

const ema1HRouter = Router();

ema1HRouter.get("/", getEma1H);
ema1HRouter.get("/debug", debugEma1H);

export default ema1HRouter;
import { Router } from "express";
import { getMarketStatus } from "../controllers/market-status.controller";

const marketStatusRouter = Router();

marketStatusRouter.get("/", getMarketStatus);

export default marketStatusRouter;
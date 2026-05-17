import { Router } from "express";
import { getAllPaperTrades } from "../controllers/paper-trade.controller";

const paperTradeRouter = Router();

paperTradeRouter.get("/", getAllPaperTrades);

export default paperTradeRouter;
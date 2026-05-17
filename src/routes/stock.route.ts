import { Router } from "express";
import { getStocks } from "../controllers/stock.controller";

const stockRouter = Router();

/**
 * Stock routes for stock universe data.
 */
stockRouter.get("/", getStocks);

export default stockRouter;
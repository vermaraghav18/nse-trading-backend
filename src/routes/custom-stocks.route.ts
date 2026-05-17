import { Router } from "express";
import {
  searchStocks,
  addStock,
  removeStock,
  listCustomStocks,
} from "../controllers/custom-stocks.controller";

const customStocksRouter = Router();

customStocksRouter.get("/search", searchStocks);
customStocksRouter.get("/", listCustomStocks);
customStocksRouter.post("/", addStock);
customStocksRouter.delete("/:symbol", removeStock);

export default customStocksRouter;
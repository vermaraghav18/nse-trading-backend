import { Router } from "express";
import {
  getChart1DBySymbol,
  getChart1HBySymbol,
  getChart2HBySymbol,
  getChart1DScanner,
  getChart1HScanner,
  getChart2HScanner,
} from "../controllers/chart.controller";

const chartRouter = Router();

chartRouter.get("/1d/scanner", getChart1DScanner);
chartRouter.get("/1h/scanner", getChart1HScanner);
chartRouter.get("/2h/scanner", getChart2HScanner);

chartRouter.get("/1d/:symbol", getChart1DBySymbol);
chartRouter.get("/1h/:symbol", getChart1HBySymbol);
chartRouter.get("/2h/:symbol", getChart2HBySymbol);

export default chartRouter;
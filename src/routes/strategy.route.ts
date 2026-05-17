import { Router } from "express";
import { getStrategies } from "../controllers/strategy.controller";

const strategyRouter = Router();

/**
 * Strategy routes.
 */
strategyRouter.get("/", getStrategies);

export default strategyRouter;
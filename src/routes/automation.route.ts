import { Router } from "express";
import {
  getAutomations,
  runAutomationPaperTrades,
} from "../controllers/automation.controller";

const automationRouter = Router();

/**
 * Automation routes.
 */
automationRouter.get("/", getAutomations);
automationRouter.post("/run-paper-trades", runAutomationPaperTrades);

export default automationRouter;
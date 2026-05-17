import { Router } from "express";
import { getDashboardSummary } from "../controllers/dashboard.controller";

const dashboardRouter = Router();

/**
 * Dashboard summary route.
 * This is the first business route after health check.
 */
dashboardRouter.get("/summary", getDashboardSummary);

export default dashboardRouter;
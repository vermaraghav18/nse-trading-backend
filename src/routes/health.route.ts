import { Router } from "express";
import { getHealth } from "../controllers/health.controller";

const healthRouter = Router();

/**
 * Health route used to confirm backend server is alive.
 */
healthRouter.get("/", getHealth);

export default healthRouter;
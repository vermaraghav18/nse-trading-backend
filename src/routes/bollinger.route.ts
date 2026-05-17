import { Router } from "express";
import { getBollingerBands } from "../controllers/bollinger.controller";

const bollingerRouter = Router();

/**
 * Bollinger Band routes.
 */
bollingerRouter.get("/", getBollingerBands);

export default bollingerRouter;
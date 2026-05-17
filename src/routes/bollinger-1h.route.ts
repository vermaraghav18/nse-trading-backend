import { Router } from "express";
import { getBollinger1H } from "../controllers/bollinger-1h.controller";

const bollinger1HRouter = Router();

bollinger1HRouter.get("/", getBollinger1H);

export default bollinger1HRouter;
import { Router } from "express";
import { getDoubleBollinger } from "../controllers/double-bollinger.controller";

const doubleBollingerRouter = Router();

doubleBollingerRouter.get("/", getDoubleBollinger);

export default doubleBollingerRouter;
import { Router } from "express";
import { getEma44 } from "../controllers/ema.controller";

const emaRouter = Router();

emaRouter.get("/", getEma44);

export default emaRouter;
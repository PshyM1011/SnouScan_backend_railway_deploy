import { Router } from "express";
import { requestRouter } from "./requestsVerifications/request.route";
import {healthRouter} from "./healthProfile/health.route";

export const backofficeApiRouter = Router();



backofficeApiRouter.use("/request", requestRouter);
backofficeApiRouter.use("/health-profile", healthRouter);


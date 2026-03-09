import { Router } from "express";
import { healthProfileController } from "./health.controller";
import { requireAuth } from "../../../middlewares/auth.middleware";

export const healthRouter = Router();

healthRouter.get(
  "/extract/:dog_id",
  requireAuth,
  healthProfileController.extractHealthProfile,
);

healthRouter.post(
  "/create/:dog_id",
  requireAuth,
  healthProfileController.createHealthProfile,
);
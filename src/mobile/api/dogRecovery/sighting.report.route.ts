import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware";
import { sightingReportController } from "./sighting.report.controller";

export const sightingReportRouter = Router();

sightingReportRouter.get("/me", requireAuth, sightingReportController.listMine);
sightingReportRouter.get(
  "/for-owner",
  requireAuth,
  sightingReportController.listForOwner,
);

sightingReportRouter.post("/", requireAuth, sightingReportController.create);

sightingReportRouter.get(
  "/:sightingId",
  requireAuth,
  sightingReportController.getById,
);

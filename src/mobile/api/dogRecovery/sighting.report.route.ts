import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../../middlewares/auth.middleware";
import { sightingReportController } from "./sighting.report.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const sightingReportRouter = Router();

sightingReportRouter.get("/me", requireAuth, sightingReportController.listMine);
sightingReportRouter.get(
  "/for-owner",
  requireAuth,
  sightingReportController.listForOwner,
);

sightingReportRouter.post(
  "/",
  requireAuth,
  upload.fields([
    { name: "frontal", maxCount: 1 },
    { name: "lateral", maxCount: 1 },
  ]),
  sightingReportController.create,
);

sightingReportRouter.get(
  "/:sightingId",
  requireAuth,
  sightingReportController.getById,
);

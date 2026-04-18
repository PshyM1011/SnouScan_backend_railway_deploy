import { Router } from "express";
import { authRouter } from "./auth/auth.route";
import { dogRouter } from "./dogs/dog.route";
import { crueltyRouter } from "./cruelty/cruelty.route";
import { matchRouter } from "./matching/match.route";
import {
  dogPhotosImagesRouter,
  dogPhotosRouter,
} from "./dogRecovery/dog.photos.route";
import { foundDogMatchRouter } from "./dogRecovery/found.dog.match.route";
import { lostReportRouter } from "./dogRecovery/lost.report.route";
import { sightingReportRouter } from "./dogRecovery/sighting.report.route";
import { geoNotifyRouter } from "./geoNotify/geoNotify.route";

import { uploadRouter } from "./uploads/upload.route";

export const mobileApiRouter = Router();

mobileApiRouter.use("/auth", authRouter);
// Dog recovery images (PATCH .../dogs/:dogId/images) mounted first so it takes precedence
mobileApiRouter.use("/dogs", dogPhotosImagesRouter);
mobileApiRouter.use("/dogs", dogRouter);
mobileApiRouter.use("/cruelty", crueltyRouter);
// Found-dog match proxy (POST /match) — forwards to FastAPI; mounted first so it takes precedence
mobileApiRouter.use("/match", foundDogMatchRouter);
mobileApiRouter.use("/match", matchRouter);
mobileApiRouter.use("/dog-recovery", dogPhotosRouter);
mobileApiRouter.use("/dog-recovery/lost-reports", lostReportRouter);
mobileApiRouter.use("/dog-recovery/sightings", sightingReportRouter);
// Shorter path for lost reports (e.g. POST /api/mobile/lost-report)
mobileApiRouter.use("/lost-report", lostReportRouter);
mobileApiRouter.use("/geo-notify", geoNotifyRouter);

mobileApiRouter.use("/uploads", uploadRouter);

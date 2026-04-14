import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware";
import { requireGeoNotifyCronSecret } from "./geoNotify.cron.middleware";
import { lostDogGeoNotifyController } from "./lostDogGeoNotify.controller";
import { watchAreaController } from "./watch.area.controller";

export const geoNotifyRouter = Router();

geoNotifyRouter.get("/watch-areas", requireAuth, watchAreaController.list);
geoNotifyRouter.post("/watch-areas", requireAuth, watchAreaController.create);
geoNotifyRouter.patch(
  "/watch-areas/:id",
  requireAuth,
  watchAreaController.update,
);
geoNotifyRouter.delete(
  "/watch-areas/:id",
  requireAuth,
  watchAreaController.delete,
);

/** Call every ~15 minutes from a scheduler (cron, Cloud Scheduler, etc.). */
geoNotifyRouter.post(
  "/process-adaptive",
  requireGeoNotifyCronSecret,
  lostDogGeoNotifyController.run,
);

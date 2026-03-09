import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware";
import { lostReportController } from "./lost.report.controller";

export const lostReportRouter = Router();

lostReportRouter.post("/", requireAuth, lostReportController.create);
lostReportRouter.get("/", requireAuth, lostReportController.getMyReports);
lostReportRouter.get("/:reportId", requireAuth, lostReportController.getById);
lostReportRouter.patch("/:reportId", requireAuth, lostReportController.update);
lostReportRouter.delete("/:reportId", requireAuth, lostReportController.delete);

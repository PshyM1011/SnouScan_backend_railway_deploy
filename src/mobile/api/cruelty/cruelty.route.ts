import { Router } from "express";
import { uploadMultipleImages } from "../../../middlewares/upload.middleware";
import { crueltyController } from "./cruelty.controller";

export const crueltyRouter = Router();

// Endpoint: POST /mobile/api/cruelty/report
// Note: reporter_id is optional to allow anonymous reporting
crueltyRouter.post(
    "/report",
    uploadMultipleImages("images", 5),
    crueltyController.reportCruelty,
);

// Endpoint: GET /mobile/api/cruelty/reports
crueltyRouter.get("/reports", crueltyController.getReports);

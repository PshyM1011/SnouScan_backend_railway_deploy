import { Router } from "express";
import { requestController } from "./request.controller";
import { requireAuth } from "../../../middlewares/auth.middleware";

export const requestRouter = Router();

requestRouter.get("/list", requestController.getRequestsForVerification);

requestRouter.patch(
  "/approve/:request_id",
  requireAuth,
  requestController.approveRequest,
);
requestRouter.patch(
  "/reject/:request_id",
  requireAuth,
  requestController.rejectRequest,
);


requestRouter.get("/:request_id", requestController.getRequestById);
requestRouter.get("/status/list", requestController.getMatchStatusList);



/*
matchRouter.get(
  "/top-matches/:dog_id",
  requireAuth,
  matchController.getTopMatchesModelOutputs,
);


matchRouter.post(
  "/review-request",
  requireAuth,
  matchController.createReviewRequest,
);

matchRouter.get(
  "/review-request",
  requireAuth,
  matchController.getRequestsForUser,
);
 */




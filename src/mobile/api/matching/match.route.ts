import { Router } from "express";
import { matchController } from "./match.controller";
import { requireAuth } from "../../../middlewares/auth.middleware";

export const matchRouter = Router();

matchRouter.get("/owner/pets", requireAuth, matchController.getMatchesForUser);

matchRouter.get(
  "/top-candidated/:dog_id",
  requireAuth,
  matchController.getCandidatesForDog,
);
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





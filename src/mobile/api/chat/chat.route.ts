import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware";
import { chatController } from "./chat.controller";

export const chatRouter = Router();

chatRouter.post(
  "/sighting/:sightingId/open",
  requireAuth,
  chatController.openSightingConversation,
);

import { Request, Response } from "express";
import { openSightingConversation } from "./chat.service";

export const chatController = {
  openSightingConversation: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const sightingId = Number(req.params.sightingId);
      if (!Number.isInteger(sightingId) || sightingId <= 0) {
        return res.status(400).json({ message: "Invalid sightingId" });
      }

      const result = await openSightingConversation({
        sightingId,
        requesterUserId: req.authUserId,
      });
      return res.status(200).json(result);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Failed to open sighting conversation";
      const status =
        msg === "Sighting not found"
          ? 404
          : msg === "Access denied"
            ? 403
            : 400;
      return res.status(status).json({ message: msg });
    }
  },
};

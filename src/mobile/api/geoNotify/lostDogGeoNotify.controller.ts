import { Request, Response } from "express";
import { processAdaptiveLostDogGeoNotifications } from "./lostDogGeoNotify.service";

export const lostDogGeoNotifyController = {
  run: async (_req: Request, res: Response) => {
    try {
      const result = await processAdaptiveLostDogGeoNotifications();
      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Adaptive geo notify failed",
      });
    }
  },
};

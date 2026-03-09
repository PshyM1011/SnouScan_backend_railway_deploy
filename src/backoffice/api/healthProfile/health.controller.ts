import { Request, Response } from "express";
import {
  healthProfileService,
  CreateHealthProfilePayload,
} from "./health.service";

const toInt = (val: unknown, field: string): number => {
  if (typeof val === "number" && Number.isInteger(val)) return val;
  if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val))) {
    return Number(val);
  }
  throw new Error(`Invalid ${field}`);
};

export const healthProfileController = {
  extractHealthProfile: async (req: Request, res: Response) => {
    try {
      const authUserId = req.authUserId;

      if (!authUserId) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }

      const certifiedBy = toInt(authUserId, "authUserId");

      const dogIdParam = req.params.dog_id;
      if (!dogIdParam || Array.isArray(dogIdParam)) {
        return res.status(400).json({
          message: "Invalid dog_id",
        });
      }

      const dogId = toInt(dogIdParam, "dog_id");

      const { notes } = req.body as { notes?: string };

      if (!notes || typeof notes !== "string" || !notes.trim()) {
        return res.status(400).json({
          message: "notes is required",
        });
      }

      const data = await healthProfileService.extractFromNotes({
        dogId,
        certifiedBy,
        notes: notes.trim(),
      });

      return res.status(200).json({
        message: "Health profile extracted successfully",
        data,
      });
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to extract health profile",
      });
    }
  },

  createHealthProfile: async (req: Request, res: Response) => {
    try {
      const authUserId = req.authUserId;

      if (!authUserId) {
        return res.status(401).json({
          message: "Unauthorized",
        });
      }

      const certifiedBy = toInt(authUserId, "authUserId");

      const dogIdParam = req.params.dog_id;
      if (!dogIdParam || Array.isArray(dogIdParam)) {
        return res.status(400).json({
          message: "Invalid dog_id",
        });
      }

      const dogId = toInt(dogIdParam, "dog_id");

      const payload = req.body.extracted_profile as CreateHealthProfilePayload;

      const data = await healthProfileService.createHealthProfile({
        dogId,
        certifiedBy,
        payload,
      });

      return res.status(201).json({
        message: "Health profile created successfully",
        data,
      });
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to create health profile",
      });
    }
  },
};

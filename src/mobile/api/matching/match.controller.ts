import { matchService } from "./match.service";
import { Request, Response } from "express";

const toInt = (val: unknown, field: string): number => {
  if (typeof val === "number" && Number.isInteger(val)) return val;
  if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val)))
    return Number(val);
  throw new Error(`Invalid ${field}`);
};

export const matchController = {
  getMatchesForUser: async (req: Request, res: Response) => {
    try {
      const authUserId = req.authUserId;
      if (!authUserId) {
        return res.status(401).json({
          message: "Unauthorized: User ID not found in request",
        });
      }

      const userId = toInt(authUserId, "authUserId");
      const dogs = await matchService.getDogsForUser(userId);

      return res.status(200).json({
        message: "Dogs retrieved successfully",
        dogs,
      });
    } catch (error) {
      return res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to get dogs",
      });
    }
  },

  getCandidatesForDog: async (req: Request, res: Response) => {
    try {
      const authUserId = req.authUserId;
      if (!authUserId) {
        return res.status(401).json({
          message: "Unauthorized: User ID not found in request",
        });
      }

      const userId = toInt(authUserId, "authUserId");

      const dogIdParam = req.params.dog_id;
      if (!dogIdParam || Array.isArray(dogIdParam)) {
        return res.status(400).json({ message: "Invalid or missing dog_id" });
      }

      const dogProfileId = toInt(dogIdParam, "dog_id");

      const result = await matchService.getCandidatesForSelectedDog({
        userId,
        dogProfileId,
      });

      return res.status(200).json({
        message: "Candidate matches retrieved successfully",
        data: result,
      });
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to retrieve candidate matches",
      });
    }
  },

  getTopMatchesModelOutputs: async (req: Request, res: Response) => {
    try {
      const authUserId = req.authUserId;
      if (!authUserId) return res.status(401).json({ message: "Unauthorized" });

      const userId = toInt(authUserId, "authUserId");

      const dogIdParam = req.params.dog_id;
      if (!dogIdParam || Array.isArray(dogIdParam)) {
        return res.status(400).json({ message: "Invalid dog_id" });
      }

      const dogProfileId = toInt(dogIdParam, "dog_id");

      const limit = req.query.limit ? toInt(req.query.limit, "limit") : 50;
      const concurrency = req.query.concurrency
        ? toInt(req.query.concurrency, "concurrency")
        : 5;

      const data = await matchService.getCandidatesWithModelOutputs({
        userId,
        dogProfileId,
        limit,
        concurrency,
      });

      return res.status(200).json({
        message: "Top matches with model outputs retrieved successfully",
        data,
      });
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error ? error.message : "Failed to get top matches",
      });
    }
  },
  createReviewRequest: async (req: Request, res: Response) => {
    try {
      const authUserId = req.authUserId;
      if (!authUserId) return res.status(401).json({ message: "Unauthorized" });

      const ml_output = req.body.ml_output;

      const requests = await matchService.createReviewRequest({
        userId: toInt(authUserId, "authUserId"),
        ml_output,
      });

      return res.status(201).json({
        message: "Review request created successfully",
        data: requests,
      });
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to create review request",
      });
    }
  },
  getRequestsForUser: async (req: Request, res: Response) => {
    try {
      const authUserId = req.authUserId;
      if (!authUserId) return res.status(401).json({ message: "Unauthorized" });

      const requests = await matchService.getRequestsForUser(authUserId);

      return res.status(200).json({
        message: "Review requests retrieved successfully",
        data: requests,
      });
      
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to get review requests for user",
      }); 
    }
  }
};

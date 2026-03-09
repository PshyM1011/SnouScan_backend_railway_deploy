import { Request, Response } from "express";
import { dogPhotosService } from "./dog.photos.service";

export const dogPhotosController = {
  uploadPhotos: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const dogId = Number(req.body.dog_id ?? req.body.dogId);
      if (!Number.isInteger(dogId)) {
        return res.status(400).json({ message: "Valid dog_id is required" });
      }

      const files = req.files as
        | { frontal?: Express.Multer.File[]; lateral?: Express.Multer.File[] }
        | undefined;

      const result = await dogPhotosService.savePhotos(req.authUserId, dogId, {
        frontal: files?.frontal,
        lateral: files?.lateral,
      });
      return res.status(201).json(result);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Upload failed",
      });
    }
  },

  /** PATCH dog image URLs (frontal_urls, lateral_urls) after Firebase Storage upload. */
  updateImages: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const dogId = Number(req.params.dogId ?? req.params.id);
      if (!Number.isInteger(dogId)) {
        return res.status(400).json({ message: "Invalid dog id" });
      }
      const { frontal_urls, lateral_urls } = req.body ?? {};
      const result = await dogPhotosService.updateImageUrls(req.authUserId, dogId, {
        frontal_urls,
        lateral_urls,
      });
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to update images",
      });
    }
  },

  getPhotos: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const dogId = Number(req.params.dogId);
      if (!Number.isInteger(dogId)) {
        return res.status(400).json({ message: "Invalid dog id" });
      }
      const photos = await dogPhotosService.getByDogId(req.authUserId, dogId);
      if (photos === null) {
        return res.status(404).json({ message: "Dog not found" });
      }
      return res.status(200).json({ photos });
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to fetch photos",
      });
    }
  },
};

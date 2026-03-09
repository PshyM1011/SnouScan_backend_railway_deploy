import { Request, Response } from "express";
import { dogService } from "./dog.service";

export const dogController = {
  getDogBreeds: async (_req: Request, res: Response) => {
    try {
      const breeds = await dogService.getDogBreeds();
      return res.status(200).json({ breeds });
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to retrieve dog breeds",
      });
    }
  },

  registerDog: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const result = await dogService.registerDog(req.authUserId, req.body);
      return res.status(201).json(result);
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error ? error.message : "Dog registration failed",
      });
    }
  },

  registerBiometric: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const dogId = Number(req.params.id);
      if (isNaN(dogId)) {
        return res.status(400).json({ message: "Invalid dog ID" });
      }

      const result = await dogService.registerBiometric(
        req.authUserId,
        dogId,
        req.body,
      );

      return res.status(201).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Dog not found") {
        return res.status(404).json({ message: error.message });
      }

      if (
        error instanceof Error &&
        error.message === "You are not allowed to register biometrics for this dog"
      ) {
        return res.status(403).json({ message: error.message });
      }

      if (
        error instanceof Error &&
        error.message.startsWith("This dog already has a biometric")
      ) {
        return res.status(409).json({ message: error.message });
      }

      return res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Biometric registration failed",
      });
    }
  },

  deleteBiometric: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const embeddingId = Number(req.params.embeddingId);
      if (isNaN(embeddingId)) {
        return res.status(400).json({ message: "Invalid embedding ID" });
      }

      const result = await dogService.deleteBiometric(req.authUserId, embeddingId);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Biometric embedding not found") {
        return res.status(404).json({ message: error.message });
      }

      if (error instanceof Error && error.message === "You are not allowed to delete this embedding") {
        return res.status(403).json({ message: error.message });
      }

      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to delete biometric",
      });
    }
  },

  identifyBiometric: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const result = await dogService.identifyBiometric(req.authUserId, req.body);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error ? error.message : "Biometric identify failed",
      });
    }
  },

  editDog: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const dogId = Number(req.params.id);
      if (isNaN(dogId)) {
        return res.status(400).json({ message: "Invalid dog ID" });
      }

      const result = await dogService.editDog(req.authUserId, dogId, req.body);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error && error.message === "Dog not found") {
        return res.status(404).json({ message: error.message });
      }

      if (
        error instanceof Error &&
        error.message === "You are not allowed to edit this dog"
      ) {
        return res.status(403).json({ message: error.message });
      }

      return res.status(400).json({
        message: error instanceof Error ? error.message : "Dog update failed",
      });
    }
  },

  getDogById: async (req: Request, res: Response) => {
    try {
      const dogId = Number(req.params.id);
      if (isNaN(dogId)) {
        return res.status(400).json({ message: "Invalid dog ID" });
      }

      const dog = await dogService.getDogById(dogId);
      return res.status(200).json({ dog });
    } catch (error) {
      if (error instanceof Error && error.message === "Dog not found") {
        return res.status(404).json({ message: error.message });
      }

      return res.status(400).json({
        message:
          error instanceof Error ? error.message : "Failed to retrieve dog",
      });
    }
  },

  getDogsByOwner: async (req: Request, res: Response) => {
    try {
      const ownerId = Number(req.params.ownerId);

      if (isNaN(ownerId)) {
        return res.status(400).json({ message: "Invalid owner ID" });
      }

      const dogs = await dogService.getDogsByOwnerId(ownerId);
      return res.status(200).json({ dogs });
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to retrieve owner dogs",
      });
    }
  },

  getMyDogs: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const dogs = await dogService.getDogsByOwnerId(req.authUserId);
      return res.status(200).json({ dogs });
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to retrieve your dogs",
      });
    }
  },

  getMatchedDogDetails: async (req: Request, res: Response) => {
    try {
      const dogId = Number(req.params.id);
      if (isNaN(dogId)) {
        return res.status(400).json({ message: "Invalid dog ID" });
      }

      const dog = await dogService.getMatchedDogDetails(dogId);
      if (!dog) {
        return res.status(404).json({ message: "Dog not found" });
      }

      return res.status(200).json({ dog });
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error ? error.message : "Failed to retrieve dog",
      });
    }
  },
};

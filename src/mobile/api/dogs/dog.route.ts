import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware";
import { dogController } from "./dog.controller";

export const dogRouter = Router();

dogRouter.get("/breeds", dogController.getDogBreeds);
dogRouter.post("/", requireAuth, dogController.registerDog);
dogRouter.post("/:id/biometric/register", requireAuth, dogController.registerBiometric);
dogRouter.delete("/biometric/:embeddingId", requireAuth, dogController.deleteBiometric);
dogRouter.post("/biometric/identify", requireAuth, dogController.identifyBiometric);
dogRouter.patch("/:id", requireAuth, dogController.editDog);
dogRouter.get("/me", requireAuth, dogController.getMyDogs);
dogRouter.get("/owner/:ownerId", requireAuth, dogController.getDogsByOwner);
dogRouter.get("/matched/:id", dogController.getMatchedDogDetails);
dogRouter.get("/:id", dogController.getDogById);


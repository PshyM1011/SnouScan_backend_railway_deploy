import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../../middlewares/auth.middleware";
import { dogPhotosController } from "./dog.photos.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG and WebP images are allowed"));
    }
  },
});

export const dogPhotosRouter = Router();

// Mounted at /dogs in mobile API index: /api/mobile/dogs/:dogId/images and /api/mobile/dogs/:dogId/photos
export const dogPhotosImagesRouter = Router();
dogPhotosImagesRouter.patch("/:dogId/images", requireAuth, dogPhotosController.updateImages);
dogPhotosImagesRouter.get("/:dogId/photos/public", dogPhotosController.getPhotosPublic);
dogPhotosImagesRouter.get("/:dogId/photos", requireAuth, dogPhotosController.getPhotos);

// Per dog: min 2 images (1 frontal + 1 lateral), max 8 total (both types combined)
dogPhotosRouter.post(
  "/photos",
  requireAuth,
  upload.fields([
    { name: "frontal", maxCount: 4 },
    { name: "lateral", maxCount: 4 },
  ]),
  dogPhotosController.uploadPhotos,
);

dogPhotosRouter.get(
  "/dogs/:dogId/photos",
  requireAuth,
  dogPhotosController.getPhotos,
);

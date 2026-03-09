import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware";
import {
  uploadSingleFile,
  uploadSingleImage,
} from "../../../middlewares/upload.middleware";
import { uploadController } from "./upload.controller";

export const uploadRouter = Router();

uploadRouter.post(
  "/image",
  requireAuth,
  uploadSingleImage("image"),
  uploadController.uploadImage,
);

uploadRouter.post(
  "/file",
  requireAuth,
  uploadSingleFile("file"),
  uploadController.uploadFile,
);

uploadRouter.delete("/image", requireAuth, uploadController.deleteImage);

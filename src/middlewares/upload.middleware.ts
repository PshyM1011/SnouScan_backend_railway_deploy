import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { env } from "../config/env";

export type UploadType = "image" | "document";

const allowedImageMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

const allowedDocumentMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const isUploadType = (value: string): value is UploadType => {
  return value === "image" || value === "document";
};

const resolveUploadType = (
  req: Request,
  defaultType: UploadType,
): UploadType => {
  const queryType =
    typeof req.query?.type === "string" ? req.query.type.toLowerCase() : "";

  if (isUploadType(queryType)) {
    return queryType;
  }

  return defaultType;
};

const getAllowedMimeTypes = (uploadType: UploadType) => {
  return uploadType === "document"
    ? allowedDocumentMimeTypes
    : allowedImageMimeTypes;
};

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.uploadMaxImageSizeMb * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedImageMimeTypes.includes(file.mimetype.toLowerCase())) {
      cb(new Error("Only image files are allowed"));
      return;
    }

    cb(null, true);
  },
});

export const uploadSingleImage = (fieldName = "image") => {
  return (req: Request, res: Response, next: NextFunction) => {
    imageUpload.single(fieldName)(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: `Image exceeds ${env.uploadMaxImageSizeMb}MB limit`,
        });
      }

      if (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Image upload failed",
        });
      }

      return next();
    });
  };
};

const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.uploadMaxImageSizeMb * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const uploadType = resolveUploadType(req, "image");
    const allowedMimeTypes = getAllowedMimeTypes(uploadType);

    if (!allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      const allowedTypeName = uploadType === "document" ? "document" : "image";
      cb(new Error(`Only ${allowedTypeName} files are allowed`));
      return;
    }

    cb(null, true);
  },
});

export const uploadSingleFile = (fieldName = "file") => {
  return (req: Request, res: Response, next: NextFunction) => {
    fileUpload.single(fieldName)(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: `File exceeds ${env.uploadMaxImageSizeMb}MB limit`,
        });
      }

      if (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "File upload failed",
        });
      }

      return next();
    });
  };
};

export const uploadMultipleImages = (fieldName = "images", maxCount = 5) => {
  return (req: Request, res: Response, next: NextFunction) => {
    imageUpload.array(fieldName, maxCount)(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: `Image exceeds ${env.uploadMaxImageSizeMb}MB limit`,
        });
      }

      if (error) {
        return res.status(400).json({
          message: error instanceof Error ? error.message : "Images upload failed",
        });
      }

      return next();
    });
  };
};

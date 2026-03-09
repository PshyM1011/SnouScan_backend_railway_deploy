import path from "path";
import { randomUUID } from "crypto";
import { getFirebaseStorageBucket } from "../../../lib/firebase";

type UploadImageOptions = {
  folder?: string;
  uploadedByUserId?: number;
};

const sanitizeStoragePath = (storagePath: string) => {
  const cleanedPath = storagePath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");

  if (!cleanedPath) {
    throw new Error("Image path is required");
  }

  if (cleanedPath.includes("..")) {
    throw new Error("Invalid image path");
  }

  return cleanedPath;
};

const sanitizeFolder = (folder?: string) => {
  if (!folder?.trim()) {
    return "uploads/images";
  }

  return folder
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.\./g, "");
};

const extensionFromMimeType = (mimeType: string) => {
  const extensionMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "text/plain": ".txt",
  };

  return extensionMap[mimeType.toLowerCase()] ?? "";
};

export const uploadService = {
  uploadFile: async (
    file: Express.Multer.File,
    options: UploadImageOptions = {},
  ) => {
    const bucket = getFirebaseStorageBucket();
    const folder = sanitizeFolder(options.folder);
    const originalExtension = path.extname(file.originalname).toLowerCase();
    const extension = originalExtension || extensionFromMimeType(file.mimetype);
    const fileName = `${Date.now()}-${randomUUID()}${extension}`;
    const storagePath = `${folder}/${fileName}`;
    const downloadToken = randomUUID();

    const storageFile = bucket.file(storagePath);
    await storageFile.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          uploadedByUserId: options.uploadedByUserId
            ? String(options.uploadedByUserId)
            : undefined,
        },
      },
      resumable: false,
    });

    const encodedPath = encodeURIComponent(storagePath);
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return {
      url,
      path: storagePath,
      bucket: bucket.name,
      contentType: file.mimetype,
      size: file.size,
    };
  },

  uploadImage: async (
    file: Express.Multer.File,
    options: UploadImageOptions = {},
  ) => {
    return uploadService.uploadFile(file, options);
  },

  deleteImage: async (storagePath: string) => {
    const bucket = getFirebaseStorageBucket();
    const cleanedPath = sanitizeStoragePath(storagePath);
    const storageFile = bucket.file(cleanedPath);
    const [exists] = await storageFile.exists();

    if (!exists) {
      throw new Error("Image not found");
    }

    await storageFile.delete();

    return {
      message: "Image deleted successfully",
      path: cleanedPath,
      bucket: bucket.name,
    };
  },
};

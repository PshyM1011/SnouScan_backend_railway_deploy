import { Router } from "express";
import multer from "multer";
import { proxyMatch } from "./found.dog.match.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
});

export const foundDogMatchRouter = Router();

// POST /match — multipart: frontal, lateral (files), top_k (optional). Proxies to FastAPI.
foundDogMatchRouter.post(
  "/",
  upload.fields([
    { name: "frontal", maxCount: 1 },
    { name: "lateral", maxCount: 1 },
  ]),
  proxyMatch
);

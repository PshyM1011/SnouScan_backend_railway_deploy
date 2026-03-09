import { Request, Response } from "express";
import { proxyMatchToFastApi } from "./found.dog.match.service";

/**
 * POST /match — multipart: frontal, lateral (files), top_k (optional).
 * Proxies to FastAPI /match so Flutter only talks to Express (no CORS).
 */
export async function proxyMatch(req: Request, res: Response) {
  try {
    const files = req.files as
      | { frontal?: Express.Multer.File[]; lateral?: Express.Multer.File[] }
      | undefined;
    const frontalFile = files?.frontal?.[0];
    const lateralFile = files?.lateral?.[0];

    if (!frontalFile?.buffer || !lateralFile?.buffer) {
      return res.status(400).json({
        success: false,
        matches: [],
        message: "Missing frontal or lateral image",
      });
    }

    const topK = req.body?.top_k != null ? Number(req.body.top_k) : 5;
    const result = await proxyMatchToFastApi(
      frontalFile.buffer,
      lateralFile.buffer,
      {
        frontalFilename: frontalFile.originalname || "frontal.jpg",
        lateralFilename: lateralFile.originalname || "lateral.jpg",
        topK: Number.isNaN(topK) ? 5 : Math.min(20, Math.max(1, topK)),
      }
    );

    return res.status(200).json(result);
  } catch (err: any) {
    const status = err.response?.status ?? 500;
    const body = err.response?.data ?? { success: false, matches: [], message: err.message };
    return res.status(status).json(body);
  }
}

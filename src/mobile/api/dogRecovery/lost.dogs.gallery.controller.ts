import { Request, Response } from "express";
import { getLostDogsForGallery } from "./lost.dogs.gallery.service";

/**
 * GET /for-gallery
 * Returns lost dogs with frontal/lateral image URLs for FastAPI rebuild-gallery.
 * Consumed by GALLERY_API_URL (e.g. POST /admin/rebuild-gallery on FastAPI).
 */
export async function getForGallery(_req: Request, res: Response) {
  try {
    const dogs = await getLostDogsForGallery();
    return res.status(200).json({ dogs });
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : "Failed to get lost dogs for gallery",
    });
  }
}

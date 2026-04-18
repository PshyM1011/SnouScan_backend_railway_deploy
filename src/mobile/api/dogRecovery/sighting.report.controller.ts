import { Request, Response } from "express";
import { sightingReportService } from "./sighting.report.service";

function parseSightingId(param: string | string[] | undefined): number | null {
  const raw = Array.isArray(param) ? param[0] : param;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const sightingReportController = {
  create: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const files = req.files as
        | { frontal?: Express.Multer.File[]; lateral?: Express.Multer.File[] }
        | undefined;
      const frontal = files?.frontal?.[0];
      const lateral = files?.lateral?.[0];
      if (!frontal?.buffer || !lateral?.buffer) {
        return res.status(400).json({ message: "frontal and lateral image files are required" });
      }

      const topKRaw = req.body?.top_k ?? req.body?.topK;
      const topK = topKRaw != null ? Number(topKRaw) : 3;
      const k = Number.isNaN(topK) ? 3 : Math.min(10, Math.max(1, topK));

      const result = await sightingReportService.create(
        req.authUserId,
        {
          description: req.body?.description,
          sighting_at: req.body?.sighting_at ?? req.body?.sightingAt,
          sighting_lat:
            req.body?.sighting_lat != null ? Number(req.body.sighting_lat) : undefined,
          sighting_lng:
            req.body?.sighting_lng != null ? Number(req.body.sighting_lng) : undefined,
          sighting_location_label:
            req.body?.sighting_location_label ?? req.body?.sightingLocationLabel,
        },
        frontal,
        lateral,
        k,
      );
      return res.status(201).json(result);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to create sighting report",
      });
    }
  },

  listMine: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const rows = await sightingReportService.listMine(req.authUserId);
      return res.status(200).json({ sightings: rows });
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to list sightings",
      });
    }
  },

  listForOwner: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const rows = await sightingReportService.listForRankOneOwner(req.authUserId);
      return res.status(200).json({ sightings: rows });
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to list sightings for owner",
      });
    }
  },

  getById: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const id = parseSightingId(req.params.sightingId);
      if (id === null) {
        return res.status(400).json({ message: "Invalid sighting id" });
      }
      const row = await sightingReportService.getByIdForUser(id, req.authUserId);
      if (!row) {
        return res.status(404).json({ message: "Sighting not found or access denied" });
      }
      return res.status(200).json(row);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to fetch sighting",
      });
    }
  },
};

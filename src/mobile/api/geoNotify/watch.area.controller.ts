import { Request, Response } from "express";
import { watchAreaService } from "./watch.area.service";

function parseId(param: string | string[] | undefined): number | null {
  const raw = Array.isArray(param) ? param[0] : param;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const watchAreaController = {
  list: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const areas = await watchAreaService.listByUser(req.authUserId);
      return res.status(200).json({ watch_areas: areas });
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error ? error.message : "Failed to list watch areas",
      });
    }
  },

  create: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const lat = Number(req.body.lat);
      const lng = Number(req.body.lng);
      const created = await watchAreaService.create(req.authUserId, {
        label: req.body.label,
        lat,
        lng,
        alerts_enabled: req.body.alerts_enabled,
      });
      return res.status(201).json(created);
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error ? error.message : "Failed to create watch area",
      });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const id = parseId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const body = req.body ?? {};
      const updated = await watchAreaService.update(req.authUserId, id, {
        label: body.label,
        lat: body.lat != null ? Number(body.lat) : undefined,
        lng: body.lng != null ? Number(body.lng) : undefined,
        alerts_enabled: body.alerts_enabled,
      });
      return res.status(200).json(updated);
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error ? error.message : "Failed to update watch area",
      });
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const id = parseId(req.params.id);
      if (id === null) {
        return res.status(400).json({ message: "Invalid id" });
      }
      await watchAreaService.delete(req.authUserId, id);
      return res.status(200).json({ message: "Watch area deleted" });
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error ? error.message : "Failed to delete watch area",
      });
    }
  },
};

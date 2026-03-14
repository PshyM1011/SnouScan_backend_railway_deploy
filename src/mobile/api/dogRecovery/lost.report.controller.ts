import { Request, Response } from "express";
import { lostReportService } from "./lost.report.service";

export const lostReportController = {
  create: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const dogId = Number(req.body.dog_id ?? req.body.dogId);
      if (!Number.isInteger(dogId)) {
        return res.status(400).json({ message: "Valid dog_id is required" });
      }
      const report = await lostReportService.create(req.authUserId, {
        dog_id: dogId,
        description: req.body.description,
        last_seen_at: req.body.last_seen_at,
        last_seen_location: req.body.last_seen_location,
        last_seen_lat: req.body.last_seen_lat != null ? Number(req.body.last_seen_lat) : undefined,
        last_seen_lng: req.body.last_seen_lng != null ? Number(req.body.last_seen_lng) : undefined,
      });
      return res.status(201).json(report);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to create report",
      });
    }
  },

  getMyReports: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const reports = await lostReportService.getMyReports(req.authUserId);
      return res.status(200).json({ reports });
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to fetch reports",
      });
    }
  },

  /** Get all lost reports (no owner filter). */
  getAllReports: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const reports = await lostReportService.getAllReports();
      return res.status(200).json({ reports });
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to fetch reports",
      });
    }
  },

  /** Get one lost report by reportId (not restricted to owner). */
  getById: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const reportId = Number(req.params.reportId);
      if (!Number.isInteger(reportId)) {
        return res.status(400).json({ message: "Invalid report id" });
      }
      const report = await lostReportService.getByIdPublic(reportId);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      return res.status(200).json(report);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to fetch report",
      });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const reportId = Number(req.params.reportId);
      if (!Number.isInteger(reportId)) {
        return res.status(400).json({ message: "Invalid report id" });
      }
      const report = await lostReportService.update(req.authUserId, reportId, {
        description: req.body.description,
        last_seen_at: req.body.last_seen_at,
        last_seen_location: req.body.last_seen_location,
        last_seen_lat: req.body.last_seen_lat != null ? Number(req.body.last_seen_lat) : undefined,
        last_seen_lng: req.body.last_seen_lng != null ? Number(req.body.last_seen_lng) : undefined,
      });
      return res.status(200).json(report);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to update report",
      });
    }
  },

  delete: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const reportId = Number(req.params.reportId);
      if (!Number.isInteger(reportId)) {
        return res.status(400).json({ message: "Invalid report id" });
      }
      await lostReportService.delete(req.authUserId, reportId);
      return res.status(200).json({ message: "Report deleted" });
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Failed to delete report",
      });
    }
  },
};

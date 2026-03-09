import { Request, Response } from "express";
import { crueltyService } from "./cruelty.service";

export const crueltyController = {
    reportCruelty: async (req: Request, res: Response) => {
        try {
            const images = (req.files as Express.Multer.File[]) || [];
            const result = await crueltyService.reportCruelty(req.body, images);
            return res.status(201).json(result);
        } catch (error) {
            return res.status(400).json({
                message:
                    error instanceof Error ? error.message : "Cruelty reporting failed",
            });
        }
    },

    getReports: async (_req: Request, res: Response) => {
        try {
            const reports = await crueltyService.getReports();
            return res.status(200).json(reports);
        } catch (error) {
            return res.status(500).json({
                message:
                    error instanceof Error ? error.message : "Failed to fetch reports",
            });
        }
    },
};

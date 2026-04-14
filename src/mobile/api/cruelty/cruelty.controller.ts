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

    getNotifications: async (req: Request, res: Response) => {
        try {
            const userId = Number(req.params.userId);
            if (isNaN(userId)) {
                return res.status(400).json({ message: "Invalid user ID" });
            }
            const notifications = await crueltyService.getNotifications(userId);
            return res.status(200).json(notifications);
        } catch (error) {
            return res.status(500).json({
                message:
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch notifications",
            });
        }
    },

    markNotificationAsRead: async (req: Request, res: Response) => {
        try {
            const notificationId = BigInt(
                req.params.notificationId as string,
            );
            const result =
                await crueltyService.markNotificationAsRead(notificationId);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({
                message:
                    error instanceof Error
                        ? error.message
                        : "Failed to mark notification as read",
            });
        }
    },
};

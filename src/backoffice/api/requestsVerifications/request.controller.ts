import { app } from "firebase-admin";
import { requestService } from "./request.service";
import { Request, Response } from "express";

export const requestController = {
  getRequestsForVerification: async (req: Request, res: Response) => {
    try {
      const { status_id, user_id, keyword } = req.query;

      const filters = {
        userId: user_id ? Number(user_id) : undefined,
        statusId: status_id ? Number(status_id) : undefined,

        keyword: typeof keyword === "string" ? keyword : undefined,
      };

      const requestList =
        await requestService.getRequestsForVerification(filters);

      return res.status(200).json({
        message: "Requests retrieved successfully",
        data: requestList,
      });
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to get requests for verification",
      });
    }
  },

  approveRequest: async (req: Request, res: Response) => {
    try {
      const requestId = parseInt(req.params.request_id as string, 10);
      const { comment } = req.body;
      const userId = req.authUserId as number;

      const data = {
        userId,
        comment,
      };
      const updated = await requestService.approveRequest(
        Number(requestId),
        data,
      );
      return res.status(200).json({
        message: "Request approved successfully",
        data: updated,
      });
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error ? error.message : "Failed to approve request",
      });
    }
  },
  rejectRequest: async (req: Request, res: Response) => {
    try {
      const requestId = parseInt(req.params.request_id as string, 10);
      const { comment } = req.body;
      const userId = req.authUserId as number;

      const data = {
        userId,
        comment,
      };
      const updated = await requestService.rejectRequest(
        Number(requestId),
        data,
      );
      return res.status(200).json({
        message: "Request approved successfully",
        data: updated,
      });
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error ? error.message : "Failed to approve request",
      });
    }
  },
  getRequestById: async (req: Request, res: Response) => {
    try {
      const requestId = parseInt(req.params.request_id as string, 10);
      const requestDetails = await requestService.getRequestById(requestId);
      return res.status(200).json({
        message: "Request details retrieved successfully",
        data: requestDetails,
      });
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to get request details",
      });
    }
  },
  getMatchStatusList: async (req: Request, res: Response) => {
    try {
      const requests = await requestService.getMatchStatusList();
      return res.status(200).json({
        message: "Match status list retrieved successfully",
        data: requests,
      });
    } catch (error) {
      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to get request details",
      });
    }
  },
};
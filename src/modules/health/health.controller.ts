import { Request, Response } from "express";

export const healthController = (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "snoutscan-backend-service",
    timestamp: new Date().toISOString(),
  });
};

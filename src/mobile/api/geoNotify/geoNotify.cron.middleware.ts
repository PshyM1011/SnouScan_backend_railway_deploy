import { NextFunction, Request, Response } from "express";
import { env } from "../../../config/env";

/**
 * Protects the batch geo-notify endpoint so only your scheduler (or ops) can call it.
 * Send header: x-geo-notify-secret: <GEO_NOTIFY_CRON_SECRET>
 */
export function requireGeoNotifyCronSecret(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const configured = env.geoNotifyCronSecret;
  if (!configured) {
    return res.status(503).json({
      message: "Geo notify batch job is not configured (GEO_NOTIFY_CRON_SECRET)",
    });
  }
  const sent = req.headers["x-geo-notify-secret"];
  if (typeof sent !== "string" || sent !== configured) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
}

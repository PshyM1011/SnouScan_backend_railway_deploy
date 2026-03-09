import { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../utils/jwt";

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid auth header" });
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    const payload = verifyAuthToken(token);
    const userId = Number(payload.sub);
     const role = payload.role;

    if (!Number.isInteger(userId)) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.authUserId = userId;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};



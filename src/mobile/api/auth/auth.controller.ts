import { Request, Response } from "express";
import { authService } from "./auth.service";

export const authController = {
  register: async (req: Request, res: Response) => {
    try {
      const result = await authService.register(req.body);
      return res.status(201).json(result);
    } catch (error) {
      return res.status(400).json({
        message: error instanceof Error ? error.message : "Registration failed",
      });
    }
  },

  login: async (req: Request, res: Response) => {
    try {
      const result = await authService.login(req.body);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(401).json({
        message: error instanceof Error ? error.message : "Login failed",
      });
    }
  },

  googleLogin: async (req: Request, res: Response) => {
    try {
      const result = await authService.loginWithGoogle(req.body);
      return res.status(200).json(result);
    } catch (error) {
      return res.status(401).json({
        message: error instanceof Error ? error.message : "Google login failed",
      });
    }
  },

  firebaseToken: async (req: Request, res: Response) => {
    try {
      if (!req.authUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const token = await authService.createFirebaseCustomToken(req.authUserId);
      return res.status(200).json({ token });
    } catch (error) {
      return res.status(400).json({
        message:
          error instanceof Error
            ? error.message
            : "Failed to create firebase custom token",
      });
    }
  },
};

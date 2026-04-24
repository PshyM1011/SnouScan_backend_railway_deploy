import { Router } from "express";
import { authController } from "./auth.controller";
import { requireAuth } from "../../../middlewares/auth.middleware";

export const authRouter = Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.post("/google", authController.googleLogin);
authRouter.post("/firebase-token", requireAuth, authController.firebaseToken);

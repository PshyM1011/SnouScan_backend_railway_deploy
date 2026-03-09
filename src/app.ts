import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { apiRouter } from "./routes";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api", apiRouter);
// Serve uploaded dog front/side photos (e.g. /uploads/dog-front-side-photos/...)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Global Express error handler — catches any error passed to next(err) or thrown
// in async middleware that Express 5 / express-async-errors forwards here
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  console.error("[express] Unhandled route error:", err);
  if (!res.headersSent) {
    res.status(500).json({ message });
  }
});

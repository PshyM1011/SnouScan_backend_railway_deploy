import { app } from "./app";
import { env } from "./config/env";
import dotenv from "dotenv";
dotenv.config();

// Prevent the process from crashing on unhandled promise rejections
process.on("unhandledRejection", (reason: unknown) => {
  console.error("[server] Unhandled promise rejection:", reason);
});

// Prevent the process from crashing on unexpected synchronous exceptions
process.on("uncaughtException", (err: Error) => {
  console.error("[server] Uncaught exception:", err.message, err.stack);
});

app.listen(env.port, () => {
  console.log(`SnoutScan backend running on port ${env.port}`);
});

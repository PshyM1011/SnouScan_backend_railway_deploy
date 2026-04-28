import { app } from "./app";
import { env } from "./config/env";
import dotenv from "dotenv";
import { getStorageFirebaseDebugInfo } from "./lib/firebase";
import { getInAppMessagingFirebaseDebugInfo } from "./lib/firebaseAdminInAppMessaging";
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

  try {
    const storage = getStorageFirebaseDebugInfo();
    console.log(
      `[firebase][storage] app=${storage.appName} project=${storage.projectId} bucket=${storage.bucket} client=${storage.clientEmail}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[firebase][storage] init failed: ${message}`);
  }

  try {
    const inApp = getInAppMessagingFirebaseDebugInfo();
    console.log(
      `[firebase][in-app] app=${inApp.appName} project=${inApp.projectId}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[firebase][in-app] init failed: ${message}`);
  }
});

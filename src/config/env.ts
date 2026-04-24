import "dotenv/config";

const portFromEnv = Number(process.env.PORT ?? "4000");
const dbSslRejectUnauthorizedFromEnv =
  process.env.DB_SSL_REJECT_UNAUTHORIZED ?? "false";
const uploadMaxImageSizeMbFromEnv = Number(
  process.env.UPLOAD_MAX_IMAGE_SIZE_MB ?? "10",
);
const allowAnonymousUploadsFromEnv =
  process.env.ALLOW_ANONYMOUS_UPLOADS ?? "false";
const biometricMatchThresholdFromEnv = Number(
  process.env.BIOMETRIC_MATCH_THRESHOLD ?? "0.8",
);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number.isNaN(portFromEnv) ? 4000 : portFromEnv,
  databaseUrl: process.env.DATABASE_URL ?? "",
  dbSslRejectUnauthorized:
    dbSslRejectUnauthorizedFromEnv.toLowerCase() === "true",
  jwtSecret: process.env.JWT_SECRET ?? "dev-jwt-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY ?? "",
  firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? "",
  biometricMlBaseUrl: process.env.BIOMETRIC_ML_BASE_URL ?? "",
  biometricMatchThreshold: Number.isNaN(biometricMatchThresholdFromEnv)
    ? 0.8
    : biometricMatchThresholdFromEnv,
  allowAnonymousUploads:
    allowAnonymousUploadsFromEnv.toLowerCase() === "true",
  uploadMaxImageSizeMb: Number.isNaN(uploadMaxImageSizeMbFromEnv)
    ? 10
    : uploadMaxImageSizeMbFromEnv,
  /** Dog recovery / matching FastAPI base URL (match proxy + rebuild-gallery). Set DOG_RECOVERY_FASTAPI_URL. */
  dogRecoveryFastApiUrl: process.env.DOG_RECOVERY_FASTAPI_URL ?? "",
  /** Secret for POST /api/mobile/geo-notify/process-adaptive (header x-geo-notify-secret). */
  geoNotifyCronSecret: process.env.GEO_NOTIFY_CRON_SECRET ?? "",
  /**
   * Firebase service account JSON (stringified) for in-app messaging auth/chat.
   * Keep separate from storage credentials to avoid disrupting existing flows.
   */
  firebaseServiceAccountInAppMessagingKey:
    process.env.FIREBASE_SERVICE_ACCOUNT_IN_APP_MESSAGING_KEY ?? "",
};

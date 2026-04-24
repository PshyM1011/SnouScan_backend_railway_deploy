import { App, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { env } from "../config/env";

const APP_NAME = "in-app-messaging";

type ServiceAccountShape = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function parseServiceAccount(): ServiceAccountShape {
  const raw = env.firebaseServiceAccountInAppMessagingKey?.trim();
  if (!raw) {
    throw new Error(
      "Missing FIREBASE_SERVICE_ACCOUNT_IN_APP_MESSAGING_KEY",
    );
  }

  let parsed: ServiceAccountShape | null = null;
  try {
    parsed = JSON.parse(raw) as ServiceAccountShape;
  } catch {
    try {
      const asUtf8 = Buffer.from(raw, "base64").toString("utf8");
      parsed = JSON.parse(asUtf8) as ServiceAccountShape;
    } catch {
      parsed = null;
    }
  }
  if (!parsed?.project_id || !parsed?.client_email || !parsed?.private_key) {
    throw new Error(
      "Invalid FIREBASE_SERVICE_ACCOUNT_IN_APP_MESSAGING_KEY (expected service account JSON string)",
    );
  }
  return parsed;
}

function getOrCreateInAppMessagingApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) {
    return existing;
  }
  const sa = parseServiceAccount();
  return initializeApp(
    {
      credential: cert({
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: sa.private_key.replace(/\\n/g, "\n"),
      }),
    },
    APP_NAME,
  );
}

export function getInAppMessagingAuth() {
  return getAuth(getOrCreateInAppMessagingApp());
}

export function getInAppMessagingFirestore() {
  return getFirestore(getOrCreateInAppMessagingApp());
}

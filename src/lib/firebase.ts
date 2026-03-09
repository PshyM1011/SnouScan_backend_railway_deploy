import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { env } from "../config/env";

const validateFirebaseEnv = () => {
  if (!env.firebaseProjectId) {
    throw new Error("Missing FIREBASE_PROJECT_ID");
  }

  if (!env.firebaseClientEmail) {
    throw new Error("Missing FIREBASE_CLIENT_EMAIL");
  }

  if (!env.firebasePrivateKey) {
    throw new Error("Missing FIREBASE_PRIVATE_KEY");
  }

  if (!env.firebaseStorageBucket) {
    throw new Error("Missing FIREBASE_STORAGE_BUCKET");
  }
};

const getFirebaseApp = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  validateFirebaseEnv();

  return initializeApp({
    credential: cert({
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey.replace(/\\n/g, "\n"),
    }),
    storageBucket: env.firebaseStorageBucket,
  });
};

export const getFirebaseStorageBucket = () => {
  const app = getFirebaseApp();
  return getStorage(app).bucket(env.firebaseStorageBucket);
};

export const uploadFile = async (
  file: Express.Multer.File,
  folder: string,
): Promise<string> => {
  const bucket = getFirebaseStorageBucket();
  const fileName = `${folder}/${Date.now()}_${file.originalname.replace(
    /\s+/g,
    "_",
  )}`;
  const fileUpload = bucket.file(fileName);

  await fileUpload.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
    },
  });

  // Make the file public so we can access it via URL
  await fileUpload.makePublic();

  // Return the public URL
  return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
};

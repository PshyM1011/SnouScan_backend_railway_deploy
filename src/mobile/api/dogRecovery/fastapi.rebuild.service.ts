import axios from "axios";
import { env } from "../../../config/env";

const REBUILD_TIMEOUT_MS = 120_000;

/**
 * Call FastAPI POST /admin/rebuild-gallery so the gallery includes the latest lost dogs.
 * No-op if DOG_RECOVERY_FASTAPI_URL is not set (e.g. before FastAPI is deployed).
 * On failure (e.g. FastAPI down), logs and does not throw — lost dog save still succeeds.
 */
export async function triggerGalleryRebuild(): Promise<void> {
  const baseUrl = env.dogRecoveryFastApiUrl?.trim();
  if (!baseUrl) {
    return;
  }
  const url = `${baseUrl.replace(/\/$/, "")}/admin/rebuild-gallery`;
  try {
    await axios.post(url, {}, { timeout: REBUILD_TIMEOUT_MS });
  } catch (err: any) {
    const msg = err.response?.data?.detail ?? err.message ?? "Unknown error";
    console.warn("[dogRecovery] FastAPI rebuild-gallery failed (lost dog was still saved):", msg);
  }
}

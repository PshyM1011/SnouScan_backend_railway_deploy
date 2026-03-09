import axios from "axios";
import FormData from "form-data";
import { env } from "../../../config/env";

/** Same as DOG_RECOVERY_FASTAPI_URL; required for /match proxy. */
const FASTAPI_BASE = env.dogRecoveryFastApiUrl?.trim();
const MATCH_TIMEOUT_MS = 60_000;

export type MatchResult = {
  success: boolean;
  matches: Array<{
    dog_id: string;
    similarity: number;
    percentage: number;
  }>;
  message?: string;
};

/**
 * Forward frontal + lateral image buffers to FastAPI POST /match and return the result.
 * Used by Express so Flutter only talks to Express (no CORS with FastAPI).
 */
export async function proxyMatchToFastApi(
  frontalBuffer: Buffer,
  lateralBuffer: Buffer,
  options: {
    frontalFilename?: string;
    lateralFilename?: string;
    topK?: number;
  } = {}
): Promise<MatchResult> {
  const { frontalFilename = "frontal.jpg", lateralFilename = "lateral.jpg", topK = 5 } = options;

  const form = new FormData();
  form.append("frontal", frontalBuffer, { filename: frontalFilename });
  form.append("lateral", lateralBuffer, { filename: lateralFilename });
  form.append("top_k", String(topK));

  if (!FASTAPI_BASE) {
    throw new Error(
      "DOG_RECOVERY_FASTAPI_URL is not set. Set it to your FastAPI base URL for match."
    );
  }
  const response = await axios.post<MatchResult>(`${FASTAPI_BASE.replace(/\/$/, "")}/match`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: MATCH_TIMEOUT_MS,
    validateStatus: () => true,
  });

  const data = response.data as MatchResult;
  if (response.status !== 200) {
    const errMsg =
      (data && typeof (data as any).detail === "string" && (data as any).detail) ||
      (data && (data as any).message) ||
      response.statusText;
    throw new Error(errMsg || `FastAPI returned ${response.status}`);
  }
  return data;
}

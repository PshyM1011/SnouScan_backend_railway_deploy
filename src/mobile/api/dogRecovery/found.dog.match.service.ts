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
    /** 0..1 from FastAPI (post re-rank / calibrated score). */
    confidence: number;
  }>;
  message?: string;
};

function extractFastApiErrorMessage(data: unknown, statusText: string): string {
  if (data && typeof (data as any).detail === "string") {
    return (data as any).detail;
  }
  if (data && typeof (data as any).message === "string") {
    return (data as any).message;
  }
  return statusText;
}

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
  } = {},
): Promise<MatchResult> {
  const { frontalFilename = "frontal.jpg", lateralFilename = "lateral.jpg", topK = 5 } = options;

  const form = new FormData();
  form.append("frontal", frontalBuffer, { filename: frontalFilename });
  form.append("lateral", lateralBuffer, { filename: lateralFilename });
  form.append("top_k", String(topK));

  if (!FASTAPI_BASE) {
    throw new Error(
      "DOG_RECOVERY_FASTAPI_URL is not set. Set it to your FastAPI base URL for match.",
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
    const errMsg = extractFastApiErrorMessage(data, response.statusText);
    throw new Error(errMsg || `FastAPI returned ${response.status}`);
  }
  return data;
}

/** Forward image URLs to FastAPI POST /match-by-url and return the result. */
export async function proxyMatchByUrlToFastApi(
  frontalUrl: string,
  lateralUrl: string,
  options: { topK?: number } = {},
): Promise<MatchResult> {
  const { topK = 5 } = options;

  if (!FASTAPI_BASE) {
    throw new Error(
      "DOG_RECOVERY_FASTAPI_URL is not set. Set it to your FastAPI base URL for match.",
    );
  }

  const response = await axios.post<MatchResult>(
    `${FASTAPI_BASE.replace(/\/$/, "")}/match-by-url`,
    {
      frontal_url: frontalUrl,
      lateral_url: lateralUrl,
      top_k: topK,
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: MATCH_TIMEOUT_MS,
      validateStatus: () => true,
    },
  );

  const data = response.data as MatchResult;
  if (response.status !== 200) {
    const errMsg = extractFastApiErrorMessage(data, response.statusText);
    throw new Error(errMsg || `FastAPI returned ${response.status}`);
  }

  return data;
}

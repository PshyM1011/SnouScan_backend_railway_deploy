import { env } from "../config/env";

type QualityGateResponse = {
  accepted?: boolean;
  class?: string;
  feedback?: string;
  confidence?: number;
};

const DEFAULT_TIMEOUT_MS = 20000;

const resolveQualityGateBaseUrl = () => {
  const configured = env.biometricMlBaseUrl?.trim();
  return configured ? configured.replace(/\/+$/, "") : "http://127.0.0.1:8000";
};

const parseQualityGateResponse = async (response: Response) => {
  let payload: QualityGateResponse | null = null;

  try {
    payload = (await response.json()) as QualityGateResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(
      payload?.feedback?.trim() ||
        `Quality gate failed with status ${response.status}`,
    );
  }

  if (!payload || typeof payload.accepted !== "boolean") {
    throw new Error("Quality gate returned an invalid response");
  }

  return {
    accepted: payload.accepted,
    class: payload.class,
    feedback: payload.feedback,
    confidence:
      typeof payload.confidence === "number" ? payload.confidence : undefined,
  };
};

const classifyWithBuffer = async (
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
) => {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error("Image file is empty");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], {
      type: contentType || "application/octet-stream",
    });
    formData.append("file", blob, fileName || "upload-image");

    const response = await fetch(`${resolveQualityGateBaseUrl()}/classify`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    return parseQualityGateResponse(response);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Quality gate request timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const qualityGate = {
  classifyWithBuffer,

  classifyFromImageUrl: async (imageUrl: string) => {
    if (!imageUrl?.trim()) {
      throw new Error("imageUrl is required for quality gate");
    }

    const imageResponse = await fetch(imageUrl.trim());
    if (!imageResponse.ok) {
      throw new Error("Failed to fetch image for quality gate");
    }

    const contentTypeHeader = imageResponse.headers.get("content-type") || "";
    const contentType = contentTypeHeader.split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new Error("Provided URL does not point to an image");
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    return classifyWithBuffer(fileBuffer, "remote-image", contentType);
  },

  assertAcceptedForFile: async (file: Express.Multer.File) => {
    if (!file?.mimetype?.toLowerCase().startsWith("image/")) {
      return;
    }

    const result = await classifyWithBuffer(
      file.buffer,
      file.originalname || "upload-image",
      file.mimetype,
    );

    if (!result.accepted) {
      throw new Error(
        result.feedback?.trim() ||
          `Image rejected by quality gate${
            result.class ? ` (${result.class})` : ""
          }`,
      );
    }
  },

  assertAcceptedForImageUrl: async (imageUrl: string) => {
    const result = await qualityGate.classifyFromImageUrl(imageUrl);

    if (!result.accepted) {
      throw new Error(
        result.feedback?.trim() ||
          `Image rejected by quality gate${
            result.class ? ` (${result.class})` : ""
          }`,
      );
    }

    return result;
  },
};

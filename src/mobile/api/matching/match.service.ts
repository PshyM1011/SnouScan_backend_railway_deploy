import { prisma } from "../../../lib/prisma";
import generateCode from "../../../utils/generateCode";

import axios from "axios";

/**
 * ML model input type
 */
export type MlDog = {
  breed: string;
  age_months: number;
  gender: string;
  weight_kg: number;
  body_size_category: string;
  hip_dysplasia_risk: number;
  elbow_dysplasia_risk: number;
  eye_condition_risk: number;
  heart_condition_risk: number;
  temperament_score: number;
  energy_level: number;
  genetic_diversity_coi: number;
};

export type DogMeta = {
  id: number;
  name: string;
  image_url: string | null; // ✅ added
};

export type MatchCandidatesPayload = {
  base: {
    meta: DogMeta;
    dog: MlDog;
  };
  candidates: Array<{
    meta: DogMeta;
    dog: MlDog;
  }>;
};

// model response type
export type ModelOutput = {
  breeding_recommended: string;
  recommendation_confidence: Record<string, number>;
  compatibility_score: number;
  risk_level: string;
  risk_confidence: Record<string, number>;
  warnings: string[];
  model_features_used: number;
};

// output you want per candidate
export type CandidateModelResult = {
  candidate: { id: number; name: string; image_url: string | null }; // ✅ added
  model_output: ModelOutput;
};

//review create type
export type CreateMatchReviewRequest = {
  userId: number;
  ml_output: Record<string, any>;
};

const normalizeGender = (g?: string | null) => (g ?? "").trim().toLowerCase();

const oppositeGender = (g?: string | null): "male" | "female" | null => {
  const ng = normalizeGender(g);
  if (ng === "male" || ng === "m") return "female";
  if (ng === "female" || ng === "f") return "male";
  return null;
};

const requireField = <T>(val: T | null | undefined, field: string): T => {
  if (val === null || val === undefined) {
    throw new Error(`Missing required field: ${field}`);
  }
  return val;
};

type DogRow = {
  gender: string | null;
  dog_breed: { name: string } | null;
  health_profile: Array<{
    age_months: number | null;
    weight_kg: number | null;
    body_size_category: string | null;
    hip_dysplasia_risk: number | null;
    elbow_dysplasia_risk: number | null;
    eye_condition_risk: number | null;
    heart_condition_risk: number | null;
    temperament_score: number | null;
    energy_level: number | null;
    genetic_diversity_coi: number | null;
    updated_at?: Date | null;
    id?: number;
  }>;
};

const pickHealth = (hpList: DogRow["health_profile"]) => {
  const hp = hpList?.[0];
  if (!hp) throw new Error("Missing required field: health_profile (no rows)");
  return hp;
};

const toMlDog = (row: DogRow): MlDog => {
  const breed = requireField(row.dog_breed?.name, "breed");
  const gender = requireField(row.gender, "gender");
  const hp = pickHealth(row.health_profile);

  return {
    breed,
    age_months: Number(requireField(hp.age_months, "age_months")),
    gender,
    weight_kg: Number(requireField(hp.weight_kg, "weight_kg")),
    body_size_category: requireField(
      hp.body_size_category,
      "body_size_category",
    ),
    hip_dysplasia_risk: Number(
      requireField(hp.hip_dysplasia_risk, "hip_dysplasia_risk"),
    ),
    elbow_dysplasia_risk: Number(
      requireField(hp.elbow_dysplasia_risk, "elbow_dysplasia_risk"),
    ),
    eye_condition_risk: Number(
      requireField(hp.eye_condition_risk, "eye_condition_risk"),
    ),
    heart_condition_risk: Number(
      requireField(hp.heart_condition_risk, "heart_condition_risk"),
    ),
    temperament_score: Number(
      requireField(hp.temperament_score, "temperament_score"),
    ),
    energy_level: Number(requireField(hp.energy_level, "energy_level")),
    genetic_diversity_coi: Number(
      requireField(hp.genetic_diversity_coi, "genetic_diversity_coi"),
    ),
  };
};

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

//pick first image_url from selection
const pickImageUrl = (
  images: Array<{ image_url: string }> | undefined | null,
) => images?.[0]?.image_url ?? null;

export const matchService = {
  getDogsForUser: async (userId: number) => {
    const userDogs = await prisma.dog_profile.findMany({
      where: { owner_id: userId, is_deleted: false },
      select: {
        id: true,
        name: true,
        dog_breed: { select: { name: true } },
        dog_images: {
          where: { is_default: true },
          take: 1,
          select: { image_url: true },
        },
      },
      orderBy: { id: "desc" },
    });

    return userDogs.map((d) => ({
      id: d.id,
      name: d.name,
      breed: d.dog_breed?.name ?? null,
      image_url: pickImageUrl(d.dog_images),
    }));
  },

  getCandidatesForSelectedDog: async (params: {
    userId: number;
    dogProfileId: number;
    limit?: number;
  }): Promise<MatchCandidatesPayload> => {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);

    // Base dog must belong to user
    const base = await prisma.dog_profile.findFirst({
      where: {
        id: params.dogProfileId,
        owner_id: params.userId,
        is_deleted: false,
      },
      select: {
        id: true,
        name: true,
        gender: true,
        breed_id: true,
        dog_breed: { select: { name: true } },
        dog_images: {
          where: { is_default: true },
          take: 1,
          select: { image_url: true },
        },
        health_profile: {
          orderBy: { updated_at: "desc" },
          take: 1,
          select: {
            age_months: true,
            weight_kg: true,
            body_size_category: true,
            hip_dysplasia_risk: true,
            elbow_dysplasia_risk: true,
            eye_condition_risk: true,
            heart_condition_risk: true,
            temperament_score: true,
            energy_level: true,
            genetic_diversity_coi: true,
            updated_at: true,
          },
        },
      },
    });

    if (!base) throw new Error("Dog not found or not owned by this user");
    if (!base.breed_id) throw new Error("Selected dog has no breed_id");
    if (!base.health_profile?.length)
      throw new Error("Selected dog has no health profile");

    const opp = oppositeGender(base.gender);
    if (!opp) throw new Error("Selected dog gender is missing/invalid");

    const baseDog = toMlDog(base);

    // Candidate dogs
    const candidates = await prisma.dog_profile.findMany({
      where: {
        is_deleted: false,
        is_verified: true,
        open_to_breed: true,
        breed_id: base.breed_id,
        owner_id: { not: params.userId },
        id: { not: base.id },
        OR: [
          { gender: opp.toUpperCase() },
          { gender: opp },
          { gender: opp === "male" ? "Male" : "Female" },
          { gender: opp === "male" ? "M" : "F" },
        ],
        health_profile: { some: { breeding_eligible: true } },
      },
      take: limit,
      select: {
        id: true,
        name: true,
        gender: true,
        dog_breed: { select: { name: true } },
        dog_images: {
          where: { is_default: true },
          take: 1,
          select: { image_url: true },
        },
        health_profile: {
          orderBy: { updated_at: "desc" },
          take: 1,
          select: {
            age_months: true,
            weight_kg: true,
            body_size_category: true,
            hip_dysplasia_risk: true,
            elbow_dysplasia_risk: true,
            eye_condition_risk: true,
            heart_condition_risk: true,
            temperament_score: true,
            energy_level: true,
            genetic_diversity_coi: true,
            updated_at: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });

    return {
      base: {
        meta: {
          id: base.id,
          name: base.name,
          image_url: pickImageUrl(base.dog_images),
        },
        dog: baseDog,
      },
      candidates: candidates
        .filter((c) => c.health_profile?.length)
        .map((c) => ({
          meta: {
            id: c.id,
            name: c.name,
            image_url: pickImageUrl(c.dog_images),
          },
          dog: toMlDog(c),
        })),
    };
  },

  /**
   * Get model outputs for each candidate and sort by compatibility_score desc
   * return image_url inside candidate
   */
  getCandidatesWithModelOutputs: async (params: {
    userId: number;
    dogProfileId: number;
    limit?: number;
    concurrency?: number;
  }): Promise<{
    base: { id: number; name: string; image_url: string | null };
    results: CandidateModelResult[];
  }> => {
    const ML_URL = process.env.ML_PREDICT_URL;
    if (!ML_URL) throw new Error("ML_PREDICT_URL is not set in .env");

    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const concurrency = Math.min(Math.max(params.concurrency ?? 5, 1), 20);

    const payload = await matchService.getCandidatesForSelectedDog({
      userId: params.userId,
      dogProfileId: params.dogProfileId,
      limit,
    });

    const results: CandidateModelResult[] = [];
    const batches = chunk(payload.candidates, concurrency);

    for (const batch of batches) {
      const batchOut: CandidateModelResult[] = await Promise.all(
        batch.map(async (c) => {
          const { data } = await axios.post<ModelOutput>(
            ML_URL,
            { dog1: payload.base.dog, dog2: c.dog },
            { timeout: 20000 },
          );

          return {
            candidate: {
              id: c.meta.id,
              name: c.meta.name,
              image_url: c.meta.image_url ?? null,
            },
            model_output: data,
          };
        }),
      );

      results.push(...batchOut);
    }

    // ✅ filter Yes only
    const filtered = results.filter(
      (r) => r.model_output?.breeding_recommended === "Yes",
    );

    // ✅ sort high -> low
    filtered.sort(
      (a, b) =>
        (b.model_output?.compatibility_score ?? 0) -
        (a.model_output?.compatibility_score ?? 0),
    );

    return {
      base: {
        id: payload.base.meta.id,
        name: payload.base.meta.name,
        image_url: payload.base.meta.image_url ?? null,
      },
      results: filtered,
    };
  },

  createReviewRequest: async (params: CreateMatchReviewRequest) => {
    try {
      const pendingStatus = await prisma.status.findFirst({
        where: {
          identifier: "review_req",
          priority: 1,
        },
        select: {
          id: true,
        },
      });

      if (!pendingStatus) {
        throw new Error("Pending status not found in database");
      }

      const partial = await prisma.match_review.create({
        data: {
          requested_user: params.userId,
          ml_output: params.ml_output,
          status: pendingStatus.id,
        },
      });

      const code = generateCode(partial.id, "REQ", 4);
      const updated = await prisma.match_review.update({
        where: { id: partial.id },
        data: { code },
      });

      return updated;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to create match review request",
      );
    }
  },

  getRequestsForUser: async (userId: number) => {
    try {
      const requests = await prisma.match_review.findMany({
        where: { requested_user: userId },
        select: {
          id: true,
          code: true,
          ml_output: true,
          status_match_review_statusTostatus: {
            select: {
              name: true,
            },
          },
          created_at: true,
        },
        orderBy: { created_at: "desc" },
      });

      return requests;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to get match review requests for user",
      );
    }
  },
};

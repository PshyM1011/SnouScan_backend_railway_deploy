import axios from "axios";
import { prisma } from "../../../lib/prisma";

export type CreateHealthProfilePayload = {
  weight_kg?: number | null;
  height_cm?: number | null;
  body_size_category?: string | null;
  bone_structure_score?: number | null;
  hip_dysplasia_risk?: number | null;
  elbow_dysplasia_risk?: number | null;
  eye_condition_risk?: number | null;
  heart_condition_risk?: number | null;
  back_condition_risk?: number | null;
  coat_quality_score?: number | null;
  temperament_score?: number | null;
  energy_level?: number | null;
  genetic_diversity_coi?: number | null;
  previous_litters?: number | null;
  last_breeding_months_ago?: number | null;
  lineage_health_score?: number | null;
  breeding_eligible?: boolean | null;
  notes?: string | null;
  age_months?: number | null;
};

const normalizeBodySize = (
  value?: string | null,
): "Large" | "Medium" | "Small" | null => {
  if (!value) return null;

  const v = value.trim().toLowerCase();

  if (v === "large") return "Large";
  if (v === "medium") return "Medium";
  if (v === "small") return "Small";

  return null;
};

export const healthProfileService = {
  extractFromNotes: async (params: {
    dogId: number;
    certifiedBy: number;
    notes: string;
  }) => {
    const webhookUrl = process.env.N8N_HEALTH_PROFILE_EXTRACT_WEBHOOK_URL;

    if (!webhookUrl) {
      throw new Error(
        "N8N_HEALTH_PROFILE_EXTRACT_WEBHOOK_URL is not configured",
      );
    }

    const dog = await prisma.dog_profile.findUnique({
      where: { id: params.dogId },
      select: {
        id: true,
        name: true,
        gender: true,
        is_verified: true,
        date_of_birth: true,
        dog_breed: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!dog) {
      throw new Error("Dog not found");
    }

    const workflowPayload = {
      dog_id: params.dogId,
      certified_by: params.certifiedBy,
      notes: params.notes,
      dog_context: {
        id: dog.id,
        name: dog.name,
        gender: dog.gender,
        breed: dog.dog_breed?.name ?? null,
        is_verified: dog.is_verified,
        date_of_birth: dog.date_of_birth,
      },
    };

    console.log("Health profile extract payload:", workflowPayload);

    const { data } = await axios.post(webhookUrl, workflowPayload, {
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    return data;
  },

  createHealthProfile: async (params: {
    dogId: number;
    certifiedBy: number;
    payload: CreateHealthProfilePayload;
  }) => {
    const dog = await prisma.dog_profile.findUnique({
      where: { id: params.dogId },
      select: {
        id: true,
        name: true,
        owner_id: true,
        users: {
          select: {
            id: true,
            full_name: true,
            email: true,
          },
        },
        dog_images: {
          where: {
            is_default: true,
          },
          select: {
            image_url: true,
          },
          orderBy: {
            created_at: "desc",
          },
          take: 1,
        },
      },
    });

    if (!dog) {
      throw new Error("Dog not found");
    }

    const createdProfile = await prisma.health_profile.create({
      data: {
        dog_id: params.dogId,
        certified_by: params.certifiedBy,
        vet_certified: true,

        weight_kg: params.payload.weight_kg ?? null,
        height_cm: params.payload.height_cm ?? null,
        body_size_category: normalizeBodySize(
          params.payload.body_size_category,
        ),
        bone_structure_score: params.payload.bone_structure_score ?? null,
        hip_dysplasia_risk: params.payload.hip_dysplasia_risk ?? null,
        elbow_dysplasia_risk: params.payload.elbow_dysplasia_risk ?? null,
        eye_condition_risk: params.payload.eye_condition_risk ?? null,
        heart_condition_risk: params.payload.heart_condition_risk ?? null,
        back_condition_risk: params.payload.back_condition_risk ?? null,
        coat_quality_score: params.payload.coat_quality_score ?? null,
        temperament_score: params.payload.temperament_score ?? null,
        energy_level: params.payload.energy_level ?? null,
        genetic_diversity_coi: params.payload.genetic_diversity_coi ?? null,
        previous_litters: params.payload.previous_litters ?? null,
        last_breeding_months_ago:
          params.payload.last_breeding_months_ago ?? null,
        lineage_health_score: params.payload.lineage_health_score ?? null,
        breeding_eligible: params.payload.breeding_eligible ?? false,
        notes: params.payload.notes ?? null,
        age_months: params.payload.age_months ?? null,
      },
    });

    const emailWebhookUrl = process.env.NOTIFICATION_WORKFLOW_WEBHOOK;
    const logoUrl = process.env.APP_LOGO_URL ?? "";
    const dogImageUrl = dog.dog_images?.[0]?.image_url ?? null;

    if (emailWebhookUrl && dog.users?.email) {
      const emailPayload = {
        event_type: "health_profile_created",
        user_email: dog.users.email,
        user_name: dog.users.full_name ?? "User",
        dog_name: dog.name,
        dog_image_url: dogImageUrl,
        logo_url: logoUrl,
        action_url: "#",
      };

      console.log("Health profile email payload:", emailPayload);

      try {
        await axios.post(emailWebhookUrl, emailPayload, {
          timeout: 20000,
          headers: {
            "Content-Type": "application/json",
          },
        });
      } catch (emailError) {
        console.error("Failed to trigger health profile email:", emailError);
      }
    }

    return createdProfile;
  },
};

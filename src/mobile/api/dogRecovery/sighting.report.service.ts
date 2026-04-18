import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import { uploadService } from "../uploads/upload.service";
import { proxyMatchToFastApi } from "./found.dog.match.service";

export type CreateSightingReportInput = {
  description?: string | null;
  sighting_at: string | Date;
  sighting_lat?: number | null;
  sighting_lng?: number | null;
  sighting_location_label?: string | null;
};

async function resolveLostReportIdForDog(
  tx: Prisma.TransactionClient,
  dogId: number,
): Promise<number | null> {
  const row = await tx.lost_dog_reports.findFirst({
    where: { dog_id: dogId },
    orderBy: { created_at: "desc" },
    select: { report_id: true },
  });
  return row?.report_id ?? null;
}

const dogSelectForMatchCard = {
  id: true,
  name: true,
  gender: true,
  date_of_birth: true,
  dog_breed: { select: { name: true } },
  dog_front_side_photos: {
    where: { img_view_type: { in: ["frontal", "lateral"] as string[] } },
    take: 4,
    select: { img_url: true, img_view_type: true },
  },
};

export const sightingReportService = {
  /**
   * Upload images, run FastAPI match, persist sighting + top 3 match rows.
   */
  create: async (
    reporterUserId: number,
    input: CreateSightingReportInput,
    frontal: Express.Multer.File,
    lateral: Express.Multer.File,
    topK = 3,
  ) => {
    const sightingAt = new Date(input.sighting_at as string);
    if (Number.isNaN(sightingAt.getTime())) {
      throw new Error("Invalid sighting_at");
    }

    const frontalUpload = await uploadService.uploadFile(frontal, {
      folder: "dog-sighting-reports",
      uploadedByUserId: reporterUserId,
    });
    const lateralUpload = await uploadService.uploadFile(lateral, {
      folder: "dog-sighting-reports",
      uploadedByUserId: reporterUserId,
    });

    const match = await proxyMatchToFastApi(frontal.buffer, lateral.buffer, {
      frontalFilename: frontal.originalname || "frontal.jpg",
      lateralFilename: lateral.originalname || "lateral.jpg",
      topK,
    });

    const top = (match.matches ?? []).slice(0, topK);

    const created = await prisma.$transaction(async (tx) => {
      const sighting = await tx.dog_sighting_reports.create({
        data: {
          reporter_user_id: reporterUserId,
          frontal_image_url: frontalUpload.url,
          lateral_image_url: lateralUpload.url,
          description: input.description?.trim() || undefined,
          sighting_at: sightingAt,
          sighting_lat: input.sighting_lat ?? undefined,
          sighting_lng: input.sighting_lng ?? undefined,
          sighting_location_label: input.sighting_location_label?.trim() || undefined,
        },
      });

      for (let i = 0; i < top.length; i++) {
        const m = top[i];
        const matchedDogId = Number(m.dog_id);
        if (!Number.isInteger(matchedDogId)) {
          continue;
        }
        const lostReportId = await resolveLostReportIdForDog(tx, matchedDogId);
        await tx.dog_sighting_report_matches.create({
          data: {
            sighting_id: sighting.sighting_id,
            rank: i + 1,
            matched_dog_id: matchedDogId,
            lost_report_id: lostReportId ?? undefined,
            similarity: m.similarity,
            percentage: m.percentage,
            confidence: m.confidence,
          },
        });
      }

      return tx.dog_sighting_reports.findUniqueOrThrow({
        where: { sighting_id: sighting.sighting_id },
        include: {
          dog_sighting_report_matches: {
            orderBy: { rank: "asc" },
            include: {
              dog_profile: { select: dogSelectForMatchCard },
            },
          },
        },
      });
    });

    return { success: match.success, message: match.message, sighting: created };
  },

  listMine: async (reporterUserId: number) => {
    return prisma.dog_sighting_reports.findMany({
      where: { reporter_user_id: reporterUserId },
      orderBy: { created_at: "desc" },
      include: {
        dog_sighting_report_matches: {
          orderBy: { rank: "asc" },
          include: {
            dog_profile: { select: dogSelectForMatchCard },
          },
        },
      },
    });
  },

  /** Sightings where this user owns the lost report linked to rank-1 match. */
  listForRankOneOwner: async (ownerUserId: number) => {
    const rankOnes = await prisma.dog_sighting_report_matches.findMany({
      where: {
        rank: 1,
        lost_report_id: { not: null },
        lost_dog_reports: { owner_id: ownerUserId },
      },
      select: { sighting_id: true },
    });
    const ids = [...new Set(rankOnes.map((r) => r.sighting_id))];
    if (ids.length === 0) {
      return [];
    }
    return prisma.dog_sighting_reports.findMany({
      where: { sighting_id: { in: ids } },
      orderBy: { created_at: "desc" },
      include: {
        dog_sighting_report_matches: {
          orderBy: { rank: "asc" },
          include: {
            dog_profile: { select: dogSelectForMatchCard },
            lost_dog_reports: {
              select: {
                report_id: true,
                owner_id: true,
                dog_id: true,
              },
            },
          },
        },
      },
    });
  },

  getByIdForUser: async (sightingId: number, userId: number) => {
    const sighting = await prisma.dog_sighting_reports.findUnique({
      where: { sighting_id: sightingId },
      include: {
        dog_sighting_report_matches: {
          orderBy: { rank: "asc" },
          include: {
            dog_profile: {
              select: {
                id: true,
                name: true,
                gender: true,
                date_of_birth: true,
                dog_breed: { select: { name: true } },
                dog_front_side_photos: {
                  where: { img_view_type: { in: ["frontal", "lateral"] as string[] } },
                  take: 4,
                  select: { img_url: true, img_view_type: true },
                },
                users: {
                  select: {
                    id: true,
                    full_name: true,
                    email: true,
                    phone: true,
                    avatar_url: true,
                    username: true,
                  },
                },
              },
            },
            lost_dog_reports: {
              select: {
                report_id: true,
                owner_id: true,
                dog_id: true,
              },
            },
          },
        },
      },
    });
    if (!sighting) {
      return null;
    }
    if (sighting.reporter_user_id === userId) {
      return sighting;
    }
    const allowed = sighting.dog_sighting_report_matches.some(
      (m) => m.lost_dog_reports?.owner_id === userId,
    );
    if (!allowed) {
      return null;
    }
    return sighting;
  },
};

import { prisma } from "../../../lib/prisma";
import { triggerGalleryRebuild } from "./fastapi.rebuild.service";

export type CreateLostReportInput = {
  dog_id: number;
  description?: string | null;
  last_seen_at?: string | Date | null; // Device date+time when last seen (ISO string or Date)
  last_seen_location?: string | null; // Device location address (e.g. plus code, city, country)
  last_seen_lat?: number | null;
  last_seen_lng?: number | null;
};

export const lostReportService = {
  /**
   * Create a lost dog report. Verifies the user owns the dog.
   */
  create: async (userId: number, input: CreateLostReportInput) => {
    const dog = await prisma.dog_profile.findFirst({
      where: { id: input.dog_id, owner_id: userId, is_deleted: { not: true } },
    });
    if (!dog) {
      throw new Error("Dog not found or access denied");
    }

    const lastSeenAt = input.last_seen_at
      ? new Date(input.last_seen_at as string)
      : undefined;

    const report = await prisma.lost_dog_reports.create({
      data: {
        owner_id: userId,
        dog_id: input.dog_id,
        description: input.description ?? undefined,
        last_seen_at: lastSeenAt,
        last_seen_location: input.last_seen_location ?? undefined,
        last_seen_lat: input.last_seen_lat ?? undefined,
        last_seen_lng: input.last_seen_lng ?? undefined,
      },
      include: {
        dog_profile: {
          select: { id: true, name: true },
        },
      },
    });
    triggerGalleryRebuild().catch(() => {});
    return report;
  },

  /**
   * Get all lost reports for the current user (owner).
   */
  getMyReports: async (userId: number) => {
    const reports = await prisma.lost_dog_reports.findMany({
      where: { owner_id: userId },
      orderBy: { created_at: "desc" },
      include: {
        dog_profile: {
          select: { id: true, name: true, dog_front_side_photos: { take: 2 } },
        },
      },
    });
    return reports;
  },

  /**
   * Get all lost reports (no owner filter — for listing/browse).
   */
  getAllReports: async () => {
    const reports = await prisma.lost_dog_reports.findMany({
      orderBy: { created_at: "desc" },
      include: {
        dog_profile: {
          select: { id: true, name: true, dog_front_side_photos: { take: 2 } },
        },
      },
    });
    return reports;
  },

  /**
   * Get one lost report by id. Only the owner can access.
   */
  getById: async (userId: number, reportId: number) => {
    const report = await prisma.lost_dog_reports.findFirst({
      where: { report_id: reportId, owner_id: userId },
      include: {
        dog_profile: {
          select: {
            id: true,
            name: true,
            dog_front_side_photos: true,
            breed_id: true,
            dog_breed: { select: { name: true } },
          },
        },
      },
    });
    return report;
  },

  /**
   * Get one lost report by reportId (no owner check — any user can view).
   */
  getByIdPublic: async (reportId: number) => {
    const report = await prisma.lost_dog_reports.findFirst({
      where: { report_id: reportId },
      include: {
        dog_profile: {
          select: {
            id: true,
            name: true,
            dog_front_side_photos: true,
            breed_id: true,
            dog_breed: { select: { name: true } },
          },
        },
      },
    });
    return report;
  },

  /**
   * Update a lost report. Only the owner can update.
   */
  update: async (
    userId: number,
    reportId: number,
    input: Partial<CreateLostReportInput>,
  ) => {
    const existing = await prisma.lost_dog_reports.findFirst({
      where: { report_id: reportId, owner_id: userId },
    });
    if (!existing) {
      throw new Error("Report not found or access denied");
    }

    const lastSeenAt = input.last_seen_at
      ? new Date(input.last_seen_at as string)
      : undefined;

    const report = await prisma.lost_dog_reports.update({
      where: { report_id: reportId },
      data: {
        ...(input.description !== undefined && { description: input.description }),
        ...(lastSeenAt !== undefined && { last_seen_at: lastSeenAt }),
        ...(input.last_seen_location !== undefined && {
          last_seen_location: input.last_seen_location,
        }),
        ...(input.last_seen_lat !== undefined && { last_seen_lat: input.last_seen_lat }),
        ...(input.last_seen_lng !== undefined && { last_seen_lng: input.last_seen_lng }),
      },
      include: {
        dog_profile: { select: { id: true, name: true } },
      },
    });
    triggerGalleryRebuild().catch(() => {});
    return report;
  },

  /**
   * Delete a lost report. Only the owner can delete.
   */
  delete: async (userId: number, reportId: number) => {
    const existing = await prisma.lost_dog_reports.findFirst({
      where: { report_id: reportId, owner_id: userId },
    });
    if (!existing) {
      throw new Error("Report not found or access denied");
    }
    await prisma.lost_dog_reports.delete({
      where: { report_id: reportId },
    });
    return { deleted: true };
  },
};

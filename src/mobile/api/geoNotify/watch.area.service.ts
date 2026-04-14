import { prisma } from "../../../lib/prisma";
import { isValidLatitude, isValidLongitude } from "./lostDogGeo.tiers";

export type UpsertWatchAreaInput = {
  label?: string | null;
  lat: number;
  lng: number;
  alerts_enabled?: boolean;
};

function assertCoordinates(lat: number, lng: number) {
  if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
    throw new Error("Invalid coordinates: lat must be [-90,90], lng must be [-180,180]");
  }
}

export const watchAreaService = {
  listByUser: async (userId: number) => {
    return prisma.user_lost_dog_watch_area.findMany({
      where: { user_id: userId },
      orderBy: { id: "asc" },
    });
  },

  create: async (userId: number, input: UpsertWatchAreaInput) => {
    assertCoordinates(input.lat, input.lng);
    return prisma.user_lost_dog_watch_area.create({
      data: {
        user_id: userId,
        label: input.label ?? undefined,
        lat: input.lat,
        lng: input.lng,
        alerts_enabled: input.alerts_enabled ?? true,
      },
    });
  },

  update: async (
    userId: number,
    id: number,
    input: Partial<Pick<UpsertWatchAreaInput, "label" | "lat" | "lng" | "alerts_enabled">>,
  ) => {
    const existing = await prisma.user_lost_dog_watch_area.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      throw new Error("Watch area not found");
    }
    const lat = input.lat ?? existing.lat;
    const lng = input.lng ?? existing.lng;
    assertCoordinates(lat, lng);

    return prisma.user_lost_dog_watch_area.update({
      where: { id },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.lat !== undefined && { lat: input.lat }),
        ...(input.lng !== undefined && { lng: input.lng }),
        ...(input.alerts_enabled !== undefined && {
          alerts_enabled: input.alerts_enabled,
        }),
      },
    });
  },

  delete: async (userId: number, id: number) => {
    const existing = await prisma.user_lost_dog_watch_area.findFirst({
      where: { id, user_id: userId },
    });
    if (!existing) {
      throw new Error("Watch area not found");
    }
    await prisma.user_lost_dog_watch_area.delete({ where: { id } });
    return { deleted: true };
  },
};

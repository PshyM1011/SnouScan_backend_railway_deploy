import { prisma } from "../../../lib/prisma";

/**
 * Shape expected by FastAPI _get_front_and_side_urls():
 * - frontalImageUrl / lateralImageUrl, or
 * - frontImageUrl / sideImageUrl, or
 * - images: [{ viewType, url }]
 */
export type DogForGallery = {
  dog_id: number;
  dogId: number; // alias for FastAPI
  frontalImageUrl: string;
  lateralImageUrl: string;
  frontImageUrl: string;
  sideImageUrl: string;
};

/**
 * Get all lost dogs (distinct dog_id from lost_dog_reports) with frontal and lateral
 * image URLs from dog_front_side_photos for FastAPI gallery rebuild.
 * Only includes dogs that have at least one frontal and one lateral photo.
 */
export async function getLostDogsForGallery(): Promise<DogForGallery[]> {
  const reports = await prisma.lost_dog_reports.findMany({
    select: { dog_id: true },
    distinct: ["dog_id"],
    where: {
      dog_profile: { is_deleted: { not: true } },
    },
  });
  const dogIds = reports.map((r) => r.dog_id);
  if (dogIds.length === 0) {
    return [];
  }

  const photos = await prisma.dog_front_side_photos.findMany({
    where: {
      dog_id: { in: dogIds },
      img_view_type: { in: ["frontal", "lateral"] },
    },
    orderBy: [{ dog_id: "asc" }, { img_view_type: "asc" }],
  });

  const byDog = new Map<
    number,
    { frontal?: string; lateral?: string }
  >();
  for (const p of photos) {
    const cur = byDog.get(p.dog_id) ?? {};
    if (p.img_view_type === "frontal" && !cur.frontal) {
      cur.frontal = p.img_url;
    } else if (p.img_view_type === "lateral" && !cur.lateral) {
      cur.lateral = p.img_url;
    }
    byDog.set(p.dog_id, cur);
  }

  const result: DogForGallery[] = [];
  for (const dogId of dogIds) {
    const urls = byDog.get(dogId);
    if (!urls?.frontal || !urls?.lateral) {
      continue;
    }
    result.push({
      dog_id: dogId,
      dogId,
      frontalImageUrl: urls.frontal,
      lateralImageUrl: urls.lateral,
      frontImageUrl: urls.frontal,
      sideImageUrl: urls.lateral,
    });
  }
  return result;
}

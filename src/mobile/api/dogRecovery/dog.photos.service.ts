import { prisma } from "../../../lib/prisma";
import * as fs from "fs";
import * as path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "dog-front-side-photos");
const PUBLIC_PREFIX = "/uploads/dog-front-side-photos";

const VIEW_TYPES = ["frontal", "lateral"] as const;
export type ViewType = (typeof VIEW_TYPES)[number];

const MAX_PHOTOS_PER_DOG = 8; // min 2 (1 frontal + 1 lateral), max 8 total

function isViewType(s: string): s is ViewType {
  return VIEW_TYPES.includes(s as ViewType);
}

function ensureUploadDir(): string {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  return UPLOAD_DIR;
}

function getExtension(mimetype: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };
  return map[mimetype] ?? ".jpg";
}

export const dogPhotosService = {
  /**
   * Save frontal and lateral images for a dog. Verifies the user owns the dog.
   * Min 2 per dog (1 frontal + 1 lateral), max 8 total. Returns created photo records.
   */
  savePhotos: async (
    userId: number,
    dogId: number,
    files: {
      frontal?: Express.Multer.File[];
      lateral?: Express.Multer.File[];
    },
  ) => {
    const dog = await prisma.dog_profile.findFirst({
      where: { id: dogId, owner_id: userId, is_deleted: { not: true } },
    });
    if (!dog) {
      throw new Error("Dog not found or access denied");
    }

    const frontalList = files.frontal?.filter(Boolean) ?? [];
    const lateralList = files.lateral?.filter(Boolean) ?? [];

    if (frontalList.length === 0 && lateralList.length === 0) {
      throw new Error("At least one frontal and one lateral image are required");
    }
    if (frontalList.length === 0) {
      throw new Error("At least one frontal image is required");
    }
    if (lateralList.length === 0) {
      throw new Error("At least one lateral image is required");
    }

    const existingCount = await prisma.dog_front_side_photos.count({
      where: { dog_id: dogId },
    });
    const newCount = frontalList.length + lateralList.length;
    if (existingCount + newCount > MAX_PHOTOS_PER_DOG) {
      throw new Error(
        `This dog can have at most ${MAX_PHOTOS_PER_DOG} photos (currently ${existingCount}); you tried to add ${newCount}.`,
      );
    }

    ensureUploadDir();
    const created: { img_id: number; dog_id: number; img_url: string; img_view_type: string }[] = [];

    const processFiles = (list: Express.Multer.File[], viewType: ViewType) => {
      list.forEach((file, i) => {
        const ext = getExtension(file.mimetype ?? "image/jpeg");
        const filename = `${dogId}_${Date.now()}_${i}_${viewType}${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);
        fs.writeFileSync(filepath, file.buffer);
        const imgUrl = `${PUBLIC_PREFIX}/${filename}`;
        created.push({ img_id: 0, dog_id: dogId, img_url: imgUrl, img_view_type: viewType });
      });
    };
    processFiles(frontalList, "frontal");
    processFiles(lateralList, "lateral");

    for (let i = 0; i < created.length; i++) {
      const row = await prisma.dog_front_side_photos.create({
        data: {
          dog_id: dogId,
          img_url: created[i].img_url,
          img_view_type: created[i].img_view_type,
        },
      });
      created[i].img_id = row.img_id;
    }

    return { photos: created };
  },

  /**
   * Update dog image URLs after Firebase Storage upload (frontal_urls, lateral_urls).
   * Replaces existing photos for the dog. Min 1 frontal + 1 lateral, max 8 total.
   */
  updateImageUrls: async (
    userId: number,
    dogId: number,
    body: { frontal_urls?: string[]; lateral_urls?: string[] },
  ) => {
    const dog = await prisma.dog_profile.findFirst({
      where: { id: dogId, owner_id: userId, is_deleted: { not: true } },
    });
    if (!dog) {
      throw new Error("Dog not found or access denied");
    }

    const frontalUrls = Array.isArray(body.frontal_urls) ? body.frontal_urls.filter(Boolean) : [];
    const lateralUrls = Array.isArray(body.lateral_urls) ? body.lateral_urls.filter(Boolean) : [];

    if (frontalUrls.length === 0) {
      throw new Error("At least one frontal image URL is required");
    }
    if (lateralUrls.length === 0) {
      throw new Error("At least one lateral image URL is required");
    }
    const total = frontalUrls.length + lateralUrls.length;
    if (total > MAX_PHOTOS_PER_DOG) {
      throw new Error(
        `This dog can have at most ${MAX_PHOTOS_PER_DOG} photos; you provided ${total}.`,
      );
    }

    await prisma.dog_front_side_photos.deleteMany({ where: { dog_id: dogId } });

    const toCreate: { dog_id: number; img_url: string; img_view_type: string }[] = [];
    frontalUrls.forEach((url) => toCreate.push({ dog_id: dogId, img_url: url, img_view_type: "frontal" }));
    lateralUrls.forEach((url) => toCreate.push({ dog_id: dogId, img_url: url, img_view_type: "lateral" }));

    await prisma.dog_front_side_photos.createMany({
      data: toCreate,
    });

    const photos = await prisma.dog_front_side_photos.findMany({
      where: { dog_id: dogId },
      orderBy: [{ img_view_type: "asc" }, { img_id: "asc" }],
    });
    return { photos };
  },

  /** Get all front/side photos for a dog (owner only). */
  getByDogId: async (userId: number, dogId: number) => {
    const dog = await prisma.dog_profile.findFirst({
      where: { id: dogId, owner_id: userId, is_deleted: { not: true } },
    });
    if (!dog) return null;

    const photos = await prisma.dog_front_side_photos.findMany({
      where: { dog_id: dogId },
      orderBy: { img_view_type: "asc" },
    });
    return photos;
  },

  /**
   * Get all front/side photos for a dog by id (no owner check — public).
   * Returns photos only if the dog exists and is not deleted.
   */
  getByDogIdPublic: async (dogId: number) => {
    const dog = await prisma.dog_profile.findFirst({
      where: { id: dogId, is_deleted: { not: true } },
    });
    if (!dog) return null;

    const photos = await prisma.dog_front_side_photos.findMany({
      where: { dog_id: dogId },
      orderBy: { img_view_type: "asc" },
    });
    return photos;
  },
};

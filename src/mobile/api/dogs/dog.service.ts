import { prisma } from "../../../lib/prisma";
import { Prisma } from "../../../generated/prisma/client";
import axios from "axios";
import { env } from "../../../config/env";
import { qualityGate } from "../../../lib/quality-gate";

type DogImageInput = {
  imageUrl: string;
  thumbnailUrl?: string;
  isPrimary?: boolean;
  angle?: string;
  captureDate?: string;
  isProcessed?: boolean;
  isDefault?: boolean;
};

type DogAttachmentInput = {
  fileName: string;
  fileUrl: string;
  fileType?: string;
  category?: string;
};

type BiometricImageInput = {
  imageUrl: string;
  thumbnailUrl?: string;
  angle?: string;
  captureDate?: string;
};

type RegisterBiometricInput = {
  images: BiometricImageInput[];
};

type IdentifyBiometricInput = {
  imageUrl: string;
  threshold?: number;
};

type IdentifyLogCreateData = {
  requested_by: number | null;
  probe_image_url: string;
  quality_gate_accepted?: boolean;
  quality_gate_feedback?: string;
  matched?: boolean;
  matched_dog_id?: number;
  matched_embedding_id?: number;
  similarity?: number;
  distance?: number;
  threshold?: number;
  status: string;
  error_message?: string;
};

type RegisterDogInput = {
  name: string;
  breedId?: string | number;
  dateOfBirth?: string;
  gender?: string;
  microchipNumber?: string;
  registrationNumber?: string;
  description?: string;
  openToBreed?: boolean | string;
  isNeuteredSpayed?: boolean | string;
  images?: DogImageInput[];
  attachments?: DogAttachmentInput[];
};

type EditDogInput = {
  name?: string;
  breedId?: string | number | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  microchipNumber?: string | null;
  registrationNumber?: string | null;
  description?: string | null;
  openToBreed?: boolean | string | null;
  isNeuteredSpayed?: boolean | string | null;
  imagesToAdd?: DogImageInput[];
  imageIdsToRemove?: number[];
  defaultImageId?: number;
  attachmentsToAdd?: DogAttachmentInput[];
  attachmentIdsToRemove?: number[];
};

const parseOptionalBoolean = (value: boolean | string | undefined) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new Error("Boolean values must be true or false");
};

const parseNullableBoolean = (value: boolean | string | null | undefined) => {
  if (value === null) {
    return null;
  }

  return parseOptionalBoolean(value);
};

const parseOptionalDate = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date value provided");
  }

  return date;
};

const parseNullableDate = (value?: string | null) => {
  if (value === null) {
    return null;
  }

  return parseOptionalDate(value);
};

const parseOptionalInt = (value: string | number | undefined) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error("breedId must be an integer");
  }

  return parsed;
};

const parseNullableInt = (value: string | number | null | undefined) => {
  if (value === null) {
    return null;
  }

  return parseOptionalInt(value);
};

const normalizeDogImagesForCreate = (images: DogImageInput[]) => {
  if (images.length === 0) {
    return [];
  }

  const defaultCount = images.filter((image) => image.isDefault === true).length;
  if (defaultCount > 1) {
    throw new Error("Only one image can be marked as default");
  }

  if (defaultCount === 0) {
    return images.map((image, index) => ({
      ...image,
      isDefault: index === 0,
    }));
  }

  return images;
};

const validateImagesInput = (images: DogImageInput[]) => {
  for (const image of images) {
    if (!image.imageUrl?.trim()) {
      throw new Error("Each image must include imageUrl");
    }
  }
};

const validateAttachmentsInput = (attachments: DogAttachmentInput[]) => {
  for (const attachment of attachments) {
    if (!attachment.fileName?.trim() || !attachment.fileUrl?.trim()) {
      throw new Error("Each attachment must include fileName and fileUrl");
    }
  }
};

const PROFILE_IMAGE_TYPE_IDENTIFIER = "profile_images";
const REGISTRATION_IMAGE_TYPE_IDENTIFIER = "registration";

const ensureImageType = async (
  tx: Prisma.TransactionClient,
  identifier: string,
  displayName: string,
) => {
  const existing = await tx.image_type.findUnique({
    where: { identifier },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  const created = await tx.image_type.create({
    data: {
      identifier,
      name: displayName,
    },
    select: { id: true },
  });

  return created.id;
};

const ensureProfileImageType = (tx: Prisma.TransactionClient) => {
  return ensureImageType(tx, PROFILE_IMAGE_TYPE_IDENTIFIER, "Profile Images");
};

const ensureRegistrationImageType = (tx: Prisma.TransactionClient) => {
  return ensureImageType(tx, REGISTRATION_IMAGE_TYPE_IDENTIFIER, "Registration");
};

const toVectorLiteral = (values: number[]) => {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("embedding must be a non-empty number array");
  }

  const normalized = values.map((value) => Number(value));
  if (normalized.some((value) => Number.isNaN(value))) {
    throw new Error("embedding must contain valid numbers");
  }

  return `[${normalized.join(",")}]`;
};

const resolveBiometricThreshold = (requestedThreshold?: number) => {
  if (requestedThreshold !== undefined && requestedThreshold !== null) {
    if (Number.isNaN(Number(requestedThreshold))) {
      throw new Error("threshold must be a valid number");
    }

    return Number(requestedThreshold);
  }

  return env.biometricMatchThreshold;
};

const createBiometricIdentifyLog = async (data: IdentifyLogCreateData) => {
  try {
    const identifyLogDelegate = (prisma as unknown as {
      biometric_identify_log?: {
        create?: (args: { data: IdentifyLogCreateData }) => Promise<unknown>;
      };
    }).biometric_identify_log;

    if (!identifyLogDelegate?.create) {
      console.warn(
        "[identifyBiometric] prisma.biometric_identify_log delegate is unavailable; skipping identify log write",
      );
      return;
    }

    await identifyLogDelegate.create({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[identifyBiometric] failed to persist identify log: ${message}`);
  }
};

const extractEmbeddingFromMlResponse = (data: unknown) => {
  const payload = data as
    | {
        embedding?: number[];
        vector?: number[];
        data?: { embedding?: number[]; vector?: number[] };
      }
    | undefined;

  const candidate =
    payload?.embedding ??
    payload?.vector ??
    payload?.data?.embedding ??
    payload?.data?.vector;

  if (!Array.isArray(candidate) || candidate.length === 0) {
    throw new Error("ML service did not return a valid embedding");
  }

  return candidate.map((value) => Number(value));
};

const callRegisterEmbeddingMl = async (imageUrls: string[]) => {
  if (!env.biometricMlBaseUrl?.trim()) {
    throw new Error("BIOMETRIC_ML_BASE_URL is not configured");
  }

  const baseUrl = env.biometricMlBaseUrl.replace(/\/+$/, "");
  const payload = {
    images: imageUrls.map((imageUrl) => ({ imageUrl })),
  };

  const endpoints = [
    `${baseUrl}/biometric/register-embedding`,
    `${baseUrl}/biometric/register-embedding-from-urls`,
  ];

  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      const { data } = await axios.post(endpoint, payload, {
        timeout: 30000,
        headers: { "Content-Type": "application/json" },
      });

      return extractEmbeddingFromMlResponse(data);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Failed to generate registration embedding from ML service: ${
      lastError instanceof Error ? lastError.message : "unknown error"
    }`,
  );
};

const callProbeEmbeddingMl = async (imageUrl: string) => {
  if (!env.biometricMlBaseUrl?.trim()) {
    throw new Error("BIOMETRIC_ML_BASE_URL is not configured");
  }

  const baseUrl = env.biometricMlBaseUrl.replace(/\/+$/, "");
  const payload = { imageUrl };
  const endpoints = [
    `${baseUrl}/biometric/probe-embedding`,
    `${baseUrl}/biometric/probe-embedding-from-url`,
  ];

  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      const { data } = await axios.post(endpoint, payload, {
        timeout: 30000,
        headers: { "Content-Type": "application/json" },
      });

      return extractEmbeddingFromMlResponse(data);
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Failed to generate probe embedding from ML service: ${
      lastError instanceof Error ? lastError.message : "unknown error"
    }`,
  );
};

const dogInclude: Prisma.dog_profileInclude = {
  dog_breed: { select: { id: true, name: true } },
  dog_images: {
    select: {
      id: true,
      image_url: true,
      thumbnail_url: true,
      is_primary: true,
      is_default: true,
      angle: true,
      capture_date: true,
      is_processed: true,
      created_at: true,
      image_type: {
        select: {
          id: true,
          identifier: true,
          name: true,
        },
      },
    },
    orderBy: [{ is_primary: "desc" }, { created_at: "desc" }],
  },
  attachments: {
    select: {
      id: true,
      file_name: true,
      file_url: true,
      file_type: true,
      category: true,
      created_at: true,
    },
    orderBy: { created_at: "desc" as const },
  },
  health_profile: {
    select: {
      id: true,
      weight_kg: true,
      height_cm: true,
      body_size_category: true,
      notes: true,
      updated_at: true,
      breeding_eligible: true,
      vet_certified: true,
    },
    orderBy: { updated_at: "desc" as const },
  },
  users: {
    select: {
      id: true,
      username: true,
      full_name: true,
      email: true,
      avatar_url: true,
      phone: true,
      address_line1: true,
      address_line2: true,
      city: true,
    },
  },
  dog_embeddings: {
    select: {
      id: true,
      image_id: true,
      created_at: true,
    },
  },
};

const dogByIdInclude: Prisma.dog_profileInclude = {
  ...dogInclude,
  dog_images: {
    select: {
      id: true,
      image_url: true,
      thumbnail_url: true,
      is_primary: true,
      is_default: true,
      angle: true,
      capture_date: true,
      is_processed: true,
      created_at: true,
      image_type: {
        select: {
          id: true,
          identifier: true,
          name: true,
        },
      },
    },
    where: {
      image_type: {
        identifier: PROFILE_IMAGE_TYPE_IDENTIFIER,
      },
    },
    orderBy: [{ is_primary: "desc" }, { created_at: "desc" }],
  },
};

const serializeDog = (dog: any) => {
  return {
    id: dog.id,
    ownerId: dog.owner_id,
    name: dog.name,
    breed: dog.dog_breed
      ? {
          id: dog.dog_breed.id,
          name: dog.dog_breed.name,
        }
      : null,
    breedId: dog.breed_id,
    dateOfBirth: dog.date_of_birth,
    gender: dog.gender,
    microchipNumber: dog.microchip_number,
    registrationNumber: dog.registration_number,
    description: dog.description,
    openToBreed: dog.open_to_breed,
    isNeuteredSpayed: dog.is_neutered_spayed,
    isActive: dog.is_active,
    isVerified: dog.is_verified,
    createdAt: dog.created_at,
    updatedAt: dog.updated_at,
    images: dog.dog_images.map((image: any) => ({
      id: image.id,
      imageUrl: image.image_url,
      thumbnailUrl: image.thumbnail_url,
      isPrimary: image.is_primary,
      isDefault: image.is_default,
      angle: image.angle,
      captureDate: image.capture_date,
      isProcessed: image.is_processed,
      createdAt: image.created_at,
      imageType: image.image_type
        ? {
            id: image.image_type.id,
            identifier: image.image_type.identifier,
            name: image.image_type.name,
          }
        : null,
    })),
    attachments: dog.attachments.map((attachment: any) => ({
      id: attachment.id,
      fileName: attachment.file_name,
      fileUrl: attachment.file_url,
      fileType: attachment.file_type,
      category: attachment.category,
      createdAt: attachment.created_at,
    })),
    healthProfiles: dog.health_profile.map((health: any) => ({
      id: health.id,
      weightKg: health.weight_kg,
      heightCm: health.height_cm,
      bodySizeCategory: health.body_size_category,
      breedingEligible: health.breeding_eligible,
      vetCertified: health.vet_certified,
      notes: health.notes,
      updatedAt: health.updated_at,
    })),
    owner: {
      id: dog.users.id,
      username: dog.users.username,
      fullName: dog.users.full_name,
      email: dog.users.email,
      avatarUrl: dog.users.avatar_url,
      phone: dog.users.phone,
      addressLine1: dog.users.address_line1,
      addressLine2: dog.users.address_line2,
      city: dog.users.city,
    },
    embeddings: Array.isArray(dog.dog_embeddings)
      ? dog.dog_embeddings.map((emb: any) => ({
          id: emb.id,
          primaryImageId: emb.image_id,
          createdAt: emb.created_at,
        }))
      : [],
  };
};

const ensureOwnerRole = async () => {
  const existingRole = await prisma.user_role.findUnique({
    where: { name: "owner" },
  });

  if (existingRole) {
    return existingRole;
  }

  return prisma.user_role.create({
    data: {
      name: "owner",
      description: "User who has registered at least one dog",
    },
  });
};

export const dogService = {
  registerBiometric: async (
    userId: number,
    dogId: number,
    input: RegisterBiometricInput,
  ) => {
    const existingDog = await prisma.dog_profile.findFirst({
      where: {
        id: dogId,
        is_deleted: { not: true },
      },
      select: {
        id: true,
        owner_id: true,
      },
    });

    if (!existingDog) {
      throw new Error("Dog not found");
    }

    if (existingDog.owner_id !== userId) {
      throw new Error("You are not allowed to register biometrics for this dog");
    }

    const existingEmbedding = await prisma.dog_embeddings.findFirst({
      where: { dog_id: dogId },
      select: { id: true },
    });

    if (existingEmbedding) {
      throw new Error("This dog already has a biometric registered. Delete it first before registering a new one.");
    }

    const images = Array.isArray(input.images) ? input.images : [];
    if (images.length !== 2) {
      throw new Error("Exactly 2 registration images are required");
    }

    for (const image of images) {
      if (!image.imageUrl?.trim()) {
        throw new Error("Each biometric image must include imageUrl");
      }
    }

    for (const image of images) {
      await qualityGate.assertAcceptedForImageUrl(image.imageUrl.trim());
    }

    const embedding = await callRegisterEmbeddingMl(
      images.map((image) => image.imageUrl.trim()),
    );

    const vectorLiteral = toVectorLiteral(embedding);

    const result = await prisma.$transaction(async (tx) => {
      const registrationImageTypeId = await ensureRegistrationImageType(tx);

      const createdImages: Array<{ id: number; image_url: string }> = [];
      for (const image of images) {
        const created = await tx.dog_images.create({
          data: {
            dog_id: dogId,
            image_type_id: registrationImageTypeId,
            uploaded_by: userId,
            image_url: image.imageUrl.trim(),
            thumbnail_url: image.thumbnailUrl,
            angle: image.angle,
            capture_date: parseOptionalDate(image.captureDate),
            is_processed: true,
            is_default: false,
            is_primary: false,
          },
          select: {
            id: true,
            image_url: true,
          },
        });

        createdImages.push(created);
      }

      const primaryImageId = createdImages[0].id;
      const embeddingInsertResult = await tx.$queryRaw<Array<{ id: number }>>`
        INSERT INTO dog_embeddings (dog_id, image_id, embedding)
        VALUES (${dogId}, ${primaryImageId}, ${vectorLiteral}::vector)
        RETURNING id
      `;

      const embeddingId = embeddingInsertResult[0]?.id;
      if (!embeddingId) {
        throw new Error("Failed to save embedding");
      }

      await tx.dog_embedding_images.createMany({
        data: createdImages.map((image) => ({
          embedding_id: embeddingId,
          image_id: image.id,
        })),
      });

      return {
        dogId,
        embeddingId,
        imageIds: createdImages.map((image) => image.id),
        imageType: REGISTRATION_IMAGE_TYPE_IDENTIFIER,
      };
    });

    return {
      message: "Dog biometric registered successfully",
      biometric: result,
    };
  },

  deleteBiometric: async (userId: number, embeddingId: number) => {
    const embedding = await prisma.dog_embeddings.findFirst({
      where: { id: embeddingId },
      select: {
        id: true,
        dog_id: true,
        dog_profile: { select: { owner_id: true } },
      },
    });

    if (!embedding) {
      throw new Error("Biometric embedding not found");
    }

    if (embedding.dog_profile.owner_id !== userId) {
      throw new Error("You are not allowed to delete this embedding");
    }

    await prisma.dog_embeddings.delete({ where: { id: embeddingId } });

    return { message: "Biometric embedding deleted successfully", embeddingId };
  },

  identifyBiometric: async (userId: number | null, input: IdentifyBiometricInput) => {
    if (!input.imageUrl?.trim()) {
      throw new Error("imageUrl is required");
    }

    const probeImageUrl = input.imageUrl.trim();
    const threshold = resolveBiometricThreshold(input.threshold);

    // Quality gate check — log rejection and re-throw
    let qualityGateAccepted = false;
    try {
      await qualityGate.assertAcceptedForImageUrl(probeImageUrl);
      qualityGateAccepted = true;
    } catch (qgErr: unknown) {
      // Extract quality gate details from the error if possible
      const qgFeedback = qgErr instanceof Error ? qgErr.message : String(qgErr);
      await createBiometricIdentifyLog({
        requested_by: userId ?? null,
        probe_image_url: probeImageUrl,
        quality_gate_accepted: false,
        quality_gate_feedback: qgFeedback,
        threshold,
        status: "quality_rejected",
      });
      throw qgErr;
    }

    let probeEmbedding: number[];
    try {
      probeEmbedding = await callProbeEmbeddingMl(probeImageUrl);
    } catch (mlErr: unknown) {
      const msg = mlErr instanceof Error ? mlErr.message : String(mlErr);
      await createBiometricIdentifyLog({
        requested_by: userId ?? null,
        probe_image_url: probeImageUrl,
        quality_gate_accepted: qualityGateAccepted,
        threshold,
        status: "error",
        error_message: `Embedding extraction failed: ${msg}`,
      });
      throw mlErr;
    }

    const probeVectorLiteral = toVectorLiteral(probeEmbedding);

    const nearest = await prisma.$queryRaw<
      Array<{ embeddingId: number; dogId: number; distance: number }>
    >`
      SELECT
        de.id AS "embeddingId",
        de.dog_id AS "dogId",
        (de.embedding <=> ${probeVectorLiteral}::vector) AS "distance"
      FROM dog_embeddings de
      INNER JOIN dog_profile dp ON dp.id = de.dog_id
      WHERE de.embedding IS NOT NULL
        AND COALESCE(dp.is_deleted, false) = false
      ORDER BY de.embedding <=> ${probeVectorLiteral}::vector
      LIMIT 1
    `;

    if (nearest.length === 0) {
      await createBiometricIdentifyLog({
        requested_by: userId ?? null,
        probe_image_url: probeImageUrl,
        quality_gate_accepted: qualityGateAccepted,
        matched: false,
        threshold,
        status: "no_embeddings",
      });
      return {
        matched: false,
        threshold,
        message: "No biometric embeddings available for matching",
      };
    }

    const best = nearest[0];
    const distance = Number(best.distance);
    const similarity = 1 - distance;

    if (similarity >= threshold) {
      await createBiometricIdentifyLog({
        requested_by: userId ?? null,
        probe_image_url: probeImageUrl,
        quality_gate_accepted: qualityGateAccepted,
        matched: true,
        matched_dog_id: best.dogId,
        matched_embedding_id: best.embeddingId,
        similarity,
        distance,
        threshold,
        status: "matched",
      });
      return {
        matched: true,
        dogId: best.dogId,
        embeddingId: best.embeddingId,
        similarity,
        distance,
        threshold,
      };
    }

    await createBiometricIdentifyLog({
      requested_by: userId ?? null,
      probe_image_url: probeImageUrl,
      quality_gate_accepted: qualityGateAccepted,
      matched: false,
      matched_dog_id: best.dogId,
      matched_embedding_id: best.embeddingId,
      similarity,
      distance,
      threshold,
      status: "not_matched",
    });
    return {
      matched: false,
      threshold,
      similarity,
      distance,
      message: "No match above threshold",
    };
  },

  getDogBreeds: async () => {
    const breeds = await prisma.dog_breed.findMany({
      select: {
        id: true,
        name: true,
        group_category: true,
        avg_lifespan_years: true,
      },
      orderBy: { name: "asc" },
    });

    return breeds.map((breed) => ({
      id: breed.id,
      name: breed.name,
      groupCategory: breed.group_category,
      avgLifespanYears: breed.avg_lifespan_years,
    }));
  },

  registerDog: async (userId: number, input: RegisterDogInput) => {
    if (!input.name?.trim()) {
      throw new Error("Dog name is required");
    }

    const parsedBreedId = parseOptionalInt(input.breedId);

    const isNeuteredSpayed = parseOptionalBoolean(input.isNeuteredSpayed);
    const openToBreed = parseOptionalBoolean(input.openToBreed);

    const images = normalizeDogImagesForCreate(
      Array.isArray(input.images) ? input.images : [],
    );
    const attachments = Array.isArray(input.attachments) ? input.attachments : [];

    validateImagesInput(images);
    validateAttachmentsInput(attachments);

    const dog = await prisma.$transaction(async (tx) => {
      const profileImageTypeId = await ensureProfileImageType(tx);

      const createdDog = await tx.dog_profile.create({
        data: {
          owner_id: userId,
          name: input.name.trim(),
          breed_id: parsedBreedId,
          date_of_birth: parseOptionalDate(input.dateOfBirth),
          gender: input.gender,
          microchip_number: input.microchipNumber,
          registration_number: input.registrationNumber,
          description: input.description,
          open_to_breed: openToBreed,
          is_neutered_spayed: isNeuteredSpayed,
        },
      });

      if (images.length > 0) {
        for (const image of images) {
          await tx.dog_images.create({
            data: {
              dog_id: createdDog.id,
              image_type_id: profileImageTypeId,
              uploaded_by: userId,
              image_url: image.imageUrl.trim(),
              thumbnail_url: image.thumbnailUrl,
              is_primary: image.isPrimary,
              angle: image.angle,
              capture_date: parseOptionalDate(image.captureDate),
              is_processed: image.isProcessed,
              is_default: image.isDefault,
            },
          });
        }
      }

      if (attachments.length > 0) {
        await tx.attachments.createMany({
          data: attachments.map((attachment) => ({
            dog_id: createdDog.id,
            uploaded_by: userId,
            file_name: attachment.fileName.trim(),
            file_url: attachment.fileUrl.trim(),
            file_type: attachment.fileType,
            category: attachment.category,
          })),
        });
      }

      const ownerRole = await ensureOwnerRole();
      await tx.users.update({
        where: { id: userId },
        data: { role_id: ownerRole.id },
      });

      return tx.dog_profile.findUniqueOrThrow({
        where: { id: createdDog.id },
        include: dogInclude,
      });
    });

    return {
      message: "Dog registered successfully. User role updated to owner.",
      dog: serializeDog(dog),
    };
  },

  editDog: async (userId: number, dogId: number, input: EditDogInput) => {
    const existingDog = await prisma.dog_profile.findFirst({
      where: {
        id: dogId,
        is_deleted: { not: true },
      },
      select: {
        id: true,
        owner_id: true,
      },
    });

    if (!existingDog) {
      throw new Error("Dog not found");
    }

    if (existingDog.owner_id !== userId) {
      throw new Error("You are not allowed to edit this dog");
    }

    const imagesToAdd = normalizeDogImagesForCreate(
      Array.isArray(input.imagesToAdd) ? input.imagesToAdd : [],
    );
    const imageIdsToRemove = Array.isArray(input.imageIdsToRemove)
      ? input.imageIdsToRemove
      : [];
    const attachmentsToAdd = Array.isArray(input.attachmentsToAdd)
      ? input.attachmentsToAdd
      : [];
    const attachmentIdsToRemove = Array.isArray(input.attachmentIdsToRemove)
      ? input.attachmentIdsToRemove
      : [];

    validateImagesInput(imagesToAdd);
    validateAttachmentsInput(attachmentsToAdd);

    if (
      input.defaultImageId !== undefined &&
      !Number.isInteger(Number(input.defaultImageId))
    ) {
      throw new Error("defaultImageId must be an integer");
    }

    const updatedDog = await prisma.$transaction(async (tx) => {
      const profileImageTypeId = await ensureProfileImageType(tx);

      const updateData: Record<string, unknown> = {};

      if (input.name !== undefined) {
        if (!input.name?.trim()) {
          throw new Error("Dog name cannot be empty");
        }
        updateData.name = input.name.trim();
      }

      if (input.breedId !== undefined) {
        updateData.breed_id = parseNullableInt(input.breedId);
      }

      if (input.dateOfBirth !== undefined) {
        updateData.date_of_birth = parseNullableDate(input.dateOfBirth);
      }

      if (input.gender !== undefined) {
        updateData.gender = input.gender;
      }

      if (input.microchipNumber !== undefined) {
        updateData.microchip_number = input.microchipNumber?.trim() || null;
      }

      if (input.registrationNumber !== undefined) {
        updateData.registration_number = input.registrationNumber?.trim() || null;
      }

      if (input.description !== undefined) {
        updateData.description = input.description;
      }

      if (input.openToBreed !== undefined) {
        updateData.open_to_breed = parseNullableBoolean(input.openToBreed);
      }

      if (input.isNeuteredSpayed !== undefined) {
        updateData.is_neutered_spayed = parseNullableBoolean(
          input.isNeuteredSpayed,
        );
      }

      if (Object.keys(updateData).length > 0) {
        await tx.dog_profile.update({
          where: { id: dogId },
          data: updateData,
        });
      }

      if (imageIdsToRemove.length > 0) {
        await tx.dog_images.deleteMany({
          where: {
            dog_id: dogId,
            id: { in: imageIdsToRemove },
          },
        });
      }

      if (attachmentIdsToRemove.length > 0) {
        await tx.attachments.deleteMany({
          where: {
            dog_id: dogId,
            id: { in: attachmentIdsToRemove },
          },
        });
      }

      const createdImageIds: number[] = [];
      for (const image of imagesToAdd) {
        const createdImage = await tx.dog_images.create({
          data: {
            dog_id: dogId,
            image_type_id: profileImageTypeId,
            uploaded_by: userId,
            image_url: image.imageUrl.trim(),
            thumbnail_url: image.thumbnailUrl,
            is_primary: image.isPrimary,
            angle: image.angle,
            capture_date: parseOptionalDate(image.captureDate),
            is_processed: image.isProcessed,
            is_default: image.isDefault,
          },
          select: { id: true, is_default: true },
        });

        createdImageIds.push(createdImage.id);
      }

      if (attachmentsToAdd.length > 0) {
        await tx.attachments.createMany({
          data: attachmentsToAdd.map((attachment) => ({
            dog_id: dogId,
            uploaded_by: userId,
            file_name: attachment.fileName.trim(),
            file_url: attachment.fileUrl.trim(),
            file_type: attachment.fileType,
            category: attachment.category,
          })),
        });
      }

      const currentImages = await tx.dog_images.findMany({
        where: {
          dog_id: dogId,
          image_type: {
            identifier: PROFILE_IMAGE_TYPE_IDENTIFIER,
          },
        },
        select: { id: true, is_default: true, created_at: true },
        orderBy: { created_at: "asc" },
      });

      let defaultImageId: number | undefined;

      if (input.defaultImageId !== undefined) {
        defaultImageId = Number(input.defaultImageId);
      } else {
        const defaultFromNew = currentImages.find((image) => image.is_default)?.id;
        if (defaultFromNew) {
          defaultImageId = defaultFromNew;
        }
      }

      if (defaultImageId !== undefined) {
        const existsInDog = currentImages.some((image) => image.id === defaultImageId);
        if (!existsInDog) {
          throw new Error("defaultImageId does not belong to this dog");
        }

        await tx.dog_images.updateMany({
          where: {
            dog_id: dogId,
            image_type: {
              identifier: PROFILE_IMAGE_TYPE_IDENTIFIER,
            },
          },
          data: { is_default: false },
        });

        await tx.dog_images.update({
          where: { id: defaultImageId },
          data: { is_default: true },
        });
      } else if (currentImages.length > 0) {
        const hasDefault = currentImages.some((image) => image.is_default === true);
        if (!hasDefault) {
          await tx.dog_images.update({
            where: { id: currentImages[0].id },
            data: { is_default: true },
          });
        }
      }

      return tx.dog_profile.findUniqueOrThrow({
        where: { id: dogId },
        include: dogInclude,
      });
    });

    return {
      message: "Dog updated successfully",
      dog: serializeDog(updatedDog),
    };
  },

  getDogsByOwnerId: async (ownerId: number) => {
    const dogs = await prisma.dog_profile.findMany({
      where: {
        owner_id: ownerId,
        is_deleted: { not: true },
      },
      include: dogInclude,
      orderBy: { created_at: "desc" },
    });

    return dogs.map(serializeDog);
  },

  getDogById: async (dogId: number) => {
    const dog = await prisma.dog_profile.findFirst({
      where: {
        id: dogId,
        is_deleted: { not: true },
      },
      include: dogByIdInclude,
    });

    if (!dog) {
      throw new Error("Dog not found");
    }

    return serializeDog(dog);
  },

  getMatchedDogDetails: async (dogId: number) => {
    try {
     const dog = await prisma.dog_profile.findUnique({
        where: { id: dogId },
        select: {
          id: true,
          name: true,
          dog_breed: {
            select: {
              name: true,
            },
          },
          dog_images: {
            
            select: {
              image_url: true,
            },
          },
          gender: true,
          is_verified: true,
          date_of_birth: true,
          users:{
            select:{

              id:true,
              full_name:true,
              email:true,
              avatar_url:true,
            }
          }
        },
      });
      return {
        dogId: dog?.id,
        name: dog?.name,
        breed: dog?.dog_breed?.name,
        gender: dog?.gender,
        isVerified: dog?.is_verified,
        dateOfBirth: dog?.date_of_birth ? dog.date_of_birth : "N/A",
        images: dog?.dog_images.length
          ? dog.dog_images.map((img) => img.image_url)
          : [
              "https://static.vecteezy.com/system/resources/thumbnails/021/334/027/small_2x/smiling-bernese-mountain-dog-avatar-tongue-hanging-out-cute-cartoon-pet-domestic-animal-vector.jpg",
            ],
        owner: dog?.users,
        is_verified: dog?.is_verified,
      };
    } catch (error) {
       throw new Error("Failed to retrieve dog profile");
    }
  }
};

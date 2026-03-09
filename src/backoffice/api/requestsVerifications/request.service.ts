import { prisma } from "../../../lib/prisma";
import axios from "axios";


export const requestService = {
  getRequestsForVerification: async (filters: {
    userId?: number;
    statusId?: number;
    keyword?: string;
  }) => {
    try {
      let user;
      if (filters.userId) {
        user = await prisma.users.findUnique({
          where: { id: filters.userId },
          select: { id: true },
        });
        if (!user) {
          throw new Error("User not found");
        }
      }

      const whereClause: any = {};
      if (user) {
        whereClause.requested_user = user.id;
      }
      if (filters.statusId) {
        whereClause.status = filters.statusId;
      }
      if (filters.keyword) {
        whereClause.OR = [
          { code: { contains: filters.keyword, mode: "insensitive" } },
        ];
      }

      const requests = await prisma.match_review.findMany({
        where: whereClause,
        select: {
          id: true,
          code: true,
          status_match_review_statusTostatus: {
            select: {
              id: true,
              name: true,
            },
          },
          users_match_review_requested_userTousers: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
          ml_output: true,
          comment: true,
          created_at: true,
        },
      });
      if (!requests) {
        throw new Error("No requests found");
      }
      return requests;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to get match review requests ",
      );
    }
  },

  approveRequest: async (
    requestId: number,
    data: { userId: number; comment: string },
  ) => {
    try {
      const request = await prisma.match_review.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          code: true,
          ml_output: true,
          requested_user: true,
          status_match_review_statusTostatus: {
            select: {
              id: true,
              name: true,
            },
          },
          users_match_review_requested_userTousers: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
        },
      });

      if (!request) {
        throw new Error("Match request not found");
      }

      const [approvedStatus, pendingStatus, reviewer] = await Promise.all([
        prisma.status.findFirst({
          where: { identifier: "review_req", priority: 2 },
        }),
        prisma.status.findFirst({
          where: { identifier: "review_req", priority: 1 },
        }),
        prisma.users.findUnique({
          where: { id: data.userId },
          select: {
            id: true,
            full_name: true,
          },
        }),
      ]);

      if (!approvedStatus) {
        throw new Error("Approved status not found");
      }

      if (!pendingStatus) {
        throw new Error("Pending status not found");
      }

      if (request.status_match_review_statusTostatus?.id !== pendingStatus.id) {
        throw new Error("Only pending requests can be approved");
      }

      const updatedRequest = await prisma.match_review.update({
        where: { id: requestId },
        data: {
          status: approvedStatus.id,
          comment: data.comment,
          review_by: data.userId,
          reviewed_at: new Date(),
        },
      });

      if (!updatedRequest) {
        throw new Error("Failed to update request status");
      }
      // Extract values from ml_output JSON
      const mlOutput = request.ml_output as any;

      const dog1Name = mlOutput?.dog1_name ?? "Dog 1";
      const dog2Name = mlOutput?.dog2_name ?? "Dog 2";
      const [dog1Image, dog2Image] = await Promise.all([
        prisma.dog_images.findFirst({
          where: {
            dog_id: Number(mlOutput?.dog1_id),
            is_default: true,
            image_type_id: 1,
          },
          select: { image_url: true },
        }),
        prisma.dog_images.findFirst({
          where: {
            dog_id: Number(mlOutput?.dog2_id),
            is_default: true,
            image_type_id: 1,
          },
          select: { image_url: true },
        }),
      ]);

      // Trigger n8n email webhook
      const notificationEngine = process.env.NOTIFICATION_WORKFLOW_WEBHOOK;

      if (
        notificationEngine &&
        request.users_match_review_requested_userTousers?.email
      ) {
        await axios.post(
          notificationEngine,
          {
            event_type: "match_review_approved",
            user_email: request.users_match_review_requested_userTousers.email,
            user_name:
              request.users_match_review_requested_userTousers.full_name ??
              "User",
            request_code: request.code,
            dog1_name: dog1Name,
            dog2_name: dog2Name,
            dog1_image_url:
              dog1Image?.image_url ??
              "https://png.pngtree.com/png-clipart/20191121/original/pngtree-dog-logo-design-vector-icon-png-image_5149990.jpg",
            dog2_image_url:
              dog2Image?.image_url ??
              "https://png.pngtree.com/png-clipart/20191121/original/pngtree-dog-logo-design-vector-icon-png-image_5149990.jpg",
            comment: data.comment,
            reviewed_by: reviewer?.full_name ?? "Veterinary Team",
            logo_url:
              process.env.APP_LOGO_URL ?? "https://yourdomain.com/logo.png",
          },
          {
            timeout: 20000,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      return updatedRequest;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to update match review request status",
      );
    }
  },
  rejectRequest: async (
    requestId: number,
    data: { userId: number; comment: string },
  ) => {
    try {
      const request = await prisma.match_review.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          code: true,
          ml_output: true,
          requested_user: true,
          status_match_review_statusTostatus: {
            select: {
              id: true,
              name: true,
            },
          },
          users_match_review_requested_userTousers: {
            select: {
              id: true,
              full_name: true,
              email: true,
            },
          },
        },
      });

      if (!request) {
        throw new Error("Match request not found");
      }

      const [rejectStatus, pendingStatus, reviewer] = await Promise.all([
        prisma.status.findFirst({
          where: { identifier: "review_req", priority: 3 },
        }),
        prisma.status.findFirst({
          where: { identifier: "review_req", priority: 1 },
        }),
        prisma.users.findUnique({
          where: { id: data.userId },
          select: {
            id: true,
            full_name: true,
          },
        }),
      ]);

      if (!rejectStatus) {
        throw new Error("Approved status not found");
      }

      if (!pendingStatus) {
        throw new Error("Pending status not found");
      }

      if (request.status_match_review_statusTostatus?.id !== pendingStatus.id) {
        throw new Error("Only pending requests can be approved");
      }

      const updatedRequest = await prisma.match_review.update({
        where: { id: requestId },
        data: {
          status: rejectStatus.id,
          comment: data.comment,
          review_by: data.userId,
          reviewed_at: new Date(),
        },
      });

      if (!updatedRequest) {
        throw new Error("Failed to update request status");
      }
      // Extract values from ml_output JSON
      const mlOutput = request.ml_output as any;

      const dog1Name = mlOutput?.dog1_name ?? "Dog 1";
      const dog2Name = mlOutput?.dog2_name ?? "Dog 2";
      const [dog1Image, dog2Image] = await Promise.all([
        prisma.dog_images.findFirst({
          where: {
            dog_id: Number(mlOutput?.dog1_id),
            is_default: true,
            image_type_id: 1,
          },
          select: { image_url: true },
        }),
        prisma.dog_images.findFirst({
          where: {
            dog_id: Number(mlOutput?.dog2_id),
            is_default: true,
            image_type_id: 1,
          },
          select: { image_url: true },
        }),
      ]);

      // Trigger n8n email webhook
      const notificationEngine = process.env.NOTIFICATION_WORKFLOW_WEBHOOK;

      if (
        notificationEngine &&
        request.users_match_review_requested_userTousers?.email
      ) {
        await axios.post(
          notificationEngine,
          {
            event_type: "match_review_rejected",
            user_email: request.users_match_review_requested_userTousers.email,
            user_name:
              request.users_match_review_requested_userTousers.full_name ??
              "User",
            request_code: request.code,
            dog1_name: dog1Name,
            dog2_name: dog2Name,
            dog1_image_url:
              dog1Image?.image_url ??
              "https://png.pngtree.com/png-clipart/20191121/original/pngtree-dog-logo-design-vector-icon-png-image_5149990.jpg",
            dog2_image_url:
              dog2Image?.image_url ??
              "https://png.pngtree.com/png-clipart/20191121/original/pngtree-dog-logo-design-vector-icon-png-image_5149990.jpg",
            comment: data.comment,
            reviewed_by: reviewer?.full_name ?? "Veterinary Team",
            logo_url:
              process.env.APP_LOGO_URL ?? "https://yourdomain.com/logo.png",
          },
          {
            timeout: 20000,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      return updatedRequest;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to update match review request status",
      );
    }
  },
  getRequestById: async (requestId: number) => {
    try {
      const request = await prisma.match_review.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          code: true,
          status_match_review_statusTostatus: {
            select: { id: true, name: true },
          },
          ml_output: true,
          comment: true,
          users_match_review_review_byTousers: {
            select: {
              id: true,
              full_name: true,
              user_role: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!request) {
        throw new Error("Match request not found");
      }

      // ✅ Extract dog IDs from ml_output safely
      const ml = request.ml_output as any;
      const dog1Id = Number(ml?.dog1_id);
      const dog2Id = Number(ml?.dog2_id);

      // ✅ Default values
      let dog1_image_url: string | null = null;
      let dog2_image_url: string | null = null;

      // ✅ Fetch default image for dog1
      if (Number.isInteger(dog1Id) && dog1Id > 0) {
        const img1 = await prisma.dog_images.findFirst({
          where: { dog_id: dog1Id, is_default: true },
          select: { image_url: true },
          orderBy: { created_at: "desc" },
        });
        dog1_image_url = img1?.image_url ?? null;
      }

      // Fetch default image for dog2
      if (Number.isInteger(dog2Id) && dog2Id > 0) {
        const img2 = await prisma.dog_images.findFirst({
          where: { dog_id: dog2Id, is_default: true },
          select: { image_url: true },
          orderBy: { created_at: "desc" },
        });
        dog2_image_url = img2?.image_url ?? null;
      }

      // Append to response
      return {
        ...request,
        dog1_image_url,
        dog2_image_url,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Failed to get match review request by id",
      );
    }
  },
  getMatchStatusList: async () => {
    try {
      const statusList = await prisma.status.findMany({
        where: { identifier: "review_req" },
        select: {
          id: true,
          name: true,
        },
      });
      return statusList;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "Failed to get status list",
      );
    }
  },
};

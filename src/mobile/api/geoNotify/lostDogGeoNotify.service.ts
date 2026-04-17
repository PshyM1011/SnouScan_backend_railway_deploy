import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  haversineDistanceMeters,
  tierForAgeMs,
} from "./lostDogGeo.tiers";

const NOTIFICATION_TYPE = "lost_dog_nearby";

export type ProcessAdaptiveGeoNotifyResult = {
  /** Lost reports considered (had lat/lng). */
  reportsConsidered: number;
  /** Notification rows created/updated for user feed. */
  notificationsCreated: number;
  /** New log rows (same count as notifications when all succeed). */
  logRowsCreated: number;
};

/**
 * For each open lost report with last_seen_lat/lng, computes age from created_at,
 * derives the current radius tier, finds users with an enabled watch pin inside
 * that circle (excluding the reporter), and creates in-app notifications + log
 * rows for each (report, recipient, tier) not already sent.
 */
export async function processAdaptiveLostDogGeoNotifications(): Promise<ProcessAdaptiveGeoNotifyResult> {
  const reports = await prisma.lost_dog_reports.findMany({
    where: {
      last_seen_lat: { not: null },
      last_seen_lng: { not: null },
    },
    include: {
      dog_profile: { select: { name: true } },
    },
  });

  const watchAreas = await prisma.user_lost_dog_watch_area.findMany({
    where: { alerts_enabled: true },
  });

  const now = Date.now();
  let notificationsCreated = 0;
  let logRowsCreated = 0;

  for (const report of reports) {
    const lat = report.last_seen_lat!;
    const lng = report.last_seen_lng!;
    const ageMs = now - report.created_at.getTime();
    const tier = tierForAgeMs(ageMs);
    if (!tier) {
      continue;
    }

    const dogName = report.dog_profile?.name?.trim() || "A dog";
    const locationLabel = report.last_seen_location?.trim() || "an unknown location";
    const seenAt = report.last_seen_at ?? report.created_at;
    const seenAtLabel = seenAt.toISOString();
    const candidates = new Set<number>();

    for (const w of watchAreas) {
      if (w.user_id === report.owner_id) {
        continue;
      }
      const d = haversineDistanceMeters(w.lat, w.lng, lat, lng);
      if (d <= tier.radiusM) {
        candidates.add(w.user_id);
      }
    }

    for (const userId of candidates) {
      const existing = await prisma.lost_report_geo_notification_log.findUnique({
        where: {
          report_id_recipient_user_id_tier_id: {
            report_id: report.report_id,
            recipient_user_id: userId,
            tier_id: tier.tierId,
          },
        },
      });
      if (existing) {
        continue;
      }

      try {
        const referenceId = BigInt(report.report_id);
        await prisma.$transaction(async (tx) => {
          await tx.lost_report_geo_notification_log.create({
            data: {
              report_id: report.report_id,
              recipient_user_id: userId,
              tier_id: tier.tierId,
              radius_m: tier.radiusM,
            },
          });
          const existingNotifications = await tx.notification.findMany({
            where: {
              user_id: userId,
              type: NOTIFICATION_TYPE,
              reference_id: referenceId,
            },
            select: { id: true },
            orderBy: { created_at: "desc" },
          });

          const payload = {
            title: `Report #${report.report_id} Update`,
            message: `${dogName} was reported missing near ${locationLabel}. Last seen at ${seenAtLabel}.`,
            is_read: false,
            created_at: new Date(),
          };

          if (existingNotifications.length > 0) {
            const [latest, ...duplicates] = existingNotifications;
            await tx.notification.update({
              where: { id: latest.id },
              data: payload,
            });
            if (duplicates.length > 0) {
              await tx.notification.deleteMany({
                where: {
                  id: { in: duplicates.map((n) => n.id) },
                },
              });
            }
          } else {
            await tx.notification.create({
              data: {
                user_id: userId,
                type: NOTIFICATION_TYPE,
                reference_id: referenceId,
                ...payload,
              },
            });
          }
        });
        logRowsCreated += 1;
        notificationsCreated += 1;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          continue;
        }
        throw err;
      }
    }
  }

  return {
    reportsConsidered: reports.length,
    notificationsCreated,
    logRowsCreated,
  };
}

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
  /** New notification rows created. */
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
        await prisma.$transaction(async (tx) => {
          await tx.lost_report_geo_notification_log.create({
            data: {
              report_id: report.report_id,
              recipient_user_id: userId,
              tier_id: tier.tierId,
              radius_m: tier.radiusM,
            },
          });
          await tx.notification.create({
            data: {
              user_id: userId,
              title: "Lost dog near your watch area",
              message: `${dogName} was reported missing near a location you follow. Report #${report.report_id}.`,
              type: NOTIFICATION_TYPE,
              reference_id: BigInt(report.report_id),
            },
          });
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

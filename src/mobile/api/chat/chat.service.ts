import { FieldValue } from "firebase-admin/firestore";
import { prisma } from "../../../lib/prisma";
import { getInAppMessagingFirestore } from "../../../lib/firebaseAdminInAppMessaging";

export async function openSightingConversation(params: {
  sightingId: number;
  requesterUserId: number;
}) {
  const { sightingId, requesterUserId } = params;

  const sighting = await prisma.dog_sighting_reports.findUnique({
    where: { sighting_id: sightingId },
    select: {
      sighting_id: true,
      reporter_user_id: true,
      dog_sighting_report_matches: {
        where: { rank: 1 },
        take: 1,
        include: {
          lost_dog_reports: {
            select: {
              report_id: true,
              owner_id: true,
            },
          },
        },
      },
    },
  });
  if (!sighting) {
    throw new Error("Sighting not found");
  }

  const rankOne = sighting.dog_sighting_report_matches[0];
  const ownerUserId = rankOne?.lost_dog_reports?.owner_id ?? null;
  if (!ownerUserId) {
    throw new Error("No rank-1 lost report owner found for this sighting");
  }

  const reporterUserId = sighting.reporter_user_id;
  const isParticipant =
    requesterUserId === reporterUserId || requesterUserId === ownerUserId;
  if (!isParticipant) {
    throw new Error("Access denied");
  }

  const participants = [String(reporterUserId), String(ownerUserId)].sort();
  const conversationId = `sighting_${sightingId}_${participants[0]}_${participants[1]}`;

  const db = getInAppMessagingFirestore();
  const ref = db.collection("conversations").doc(conversationId);
  await db.runTransaction(async (trx) => {
    const snap = await trx.get(ref);
    if (snap.exists) {
      return;
    }
    trx.set(ref, {
      sightingId,
      reporterUserId: String(reporterUserId),
      ownerUserId: String(ownerUserId),
      participants,
      createdAt: FieldValue.serverTimestamp(),
      lastMessage: "",
      lastMessageAt: FieldValue.serverTimestamp(),
    });
  });

  return {
    conversationId,
    participants,
    sightingId,
  };
}

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/http";
import { canUseLocation } from "@/lib/policies";
import { getActivePresence, putPresence } from "@/lib/presence";
import { distanceInMeters } from "@/lib/discovery-radius";
import { reserveProximityAlert } from "@/lib/proximity-alerts";
import { getAppSocket } from "@/lib/app-socket";
import { sendPushToUser } from "@/lib/web-push";

const schema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().positive().max(5000),
});

async function notifyPeopleNearby(userId: string) {
  const source = await getActivePresence(userId);
  if (!source) return;

  const [sourceUser, sessions, blocks, exclusions] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { handle: true, profile: { select: { displayName: true } } } }),
    db.visibilitySession.findMany({
      where: { userId: { not: userId }, endedAt: null, expiresAt: { gt: new Date() } },
      select: { userId: true },
    }),
    db.userBlock.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    }),
    db.visibilityExclusion.findMany({
      where: { OR: [{ ownerId: userId }, { excludedUserId: userId }] },
      select: { ownerId: true, excludedUserId: true },
    }),
  ]);
  if (!sourceUser) return;

  const blockedUserIds = new Set(blocks.map((item) => item.blockerId === userId ? item.blockedId : item.blockerId));
  const hiddenUserIds = new Set(exclusions.map((item) => item.ownerId === userId ? item.excludedUserId : item.ownerId));
  const displayName = sourceUser.profile?.displayName ?? sourceUser.handle;

  for (const session of sessions) {
    if (blockedUserIds.has(session.userId) || hiddenUserIds.has(session.userId)) continue;
    const target = await getActivePresence(session.userId);
    if (!target || distanceInMeters(source, target) > 200) continue;
    if (!reserveProximityAlert(userId, session.userId)) continue;

    void sendPushToUser(session.userId, {
      title: "Follow Me: \u0447\u043e\u0432\u0435\u043a \u043d\u0430\u0431\u043b\u0438\u0437\u043e",
      body: `${displayName} \u0435 \u043d\u0430 \u043f\u043e-\u043c\u0430\u043b\u043a\u043e \u043e\u0442 200 \u043c \u043e\u0442 \u0442\u0435\u0431.`,
      url: "/",
    }).catch((error: unknown) => console.error("Could not send proximity push notification", error));
  }
}

export async function PUT(request: Request) {
  try {
    const me = await requireUserId();
    const user = await db.user.findUniqueOrThrow({
      where: { id: me },
      select: { declaredAdult: true, dateOfBirth: true, ageVerificationStatus: true },
    });
    if (!canUseLocation(user)) return fail("AGE_VERIFICATION_REQUIRED", "\u041d\u044f\u043c\u0430\u0442\u0435 \u043f\u0440\u0430\u0432\u043e \u0434\u0430 \u0441\u043f\u043e\u0434\u0435\u043b\u044f\u0442\u0435 \u043c\u0435\u0441\u0442\u043e\u043f\u043e\u043b\u043e\u0436\u0435\u043d\u0438\u0435.", 403);

    const session = await db.visibilitySession.findFirst({
      where: { userId: me, endedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { startedAt: "desc" },
    });
    if (!session) return fail("VISIBILITY_OFF", "\u041f\u044a\u0440\u0432\u043e \u0432\u043a\u043b\u044e\u0447\u0435\u0442\u0435 \u0432\u0438\u0434\u0438\u043c\u043e\u0441\u0442\u0442\u0430.", 409);

    const point = schema.parse(await request.json());
    await putPresence(me, { ...point, expiresAt: Math.min(session.expiresAt.getTime(), Date.now() + 120_000), updatedAt: Date.now() });
    getAppSocket()?.emit("map:refresh");
    void notifyPeopleNearby(me).catch((error: unknown) => console.error("Could not evaluate proximity notification", error));

    return ok({ visible: true, expiresAt: session.expiresAt });
  } catch (error) {
    return apiError(error);
  }
}

import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, ok } from "@/lib/http";
import { getActivePresence } from "@/lib/presence";
import { publicUserSelect } from "@/lib/public-user";
import { profileForAudience } from "@/lib/profile-visibility";

export async function GET(request: Request) {
  try {
    const me = await requireUserId();
    const cursor = new URL(request.url).searchParams.get("cursor");
    const blocked = await db.userBlock.findMany({
      where: { OR: [{ blockerId: me }, { blockedId: me }] },
      select: { blockerId: true, blockedId: true },
    });
    const excluded = blocked.flatMap((block) => [block.blockerId, block.blockedId]);
    const users = await db.user.findMany({
      where: { id: { notIn: [me, ...excluded] } },
      select: publicUserSelect,
      orderBy: { id: "asc" },
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const nextCursor = users.length > 20 ? users.pop()!.id : null;
    const activeSessions = await db.visibilitySession.findMany({
      where: {
        userId: { in: users.map((user) => user.id) },
        endedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { userId: true, startedAt: true },
    });
    const activeSessionByUserId = new Map(activeSessions.map((session) => [session.userId, session]));

    return ok({
      users: await Promise.all(users.map(async (user) => {
        const session = activeSessionByUserId.get(user.id);
        const currentPresence = session ? await getActivePresence(user.id) : null;
        return {
          ...user,
          profile: user.profile ? profileForAudience(user.profile, "PUBLIC") : null,
          isLocationVisible: Boolean(currentPresence),
          lastActiveAt: currentPresence?.updatedAt ? new Date(currentPresence.updatedAt).toISOString() : session?.startedAt.toISOString() ?? null,
        };
      })),
      nextCursor,
    });
  } catch (error) {
    return apiError(error);
  }
}

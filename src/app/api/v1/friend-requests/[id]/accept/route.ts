import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/http";
import { pair, areBlocked } from "@/lib/social";
import { getAppSocket } from "@/lib/app-socket";
import { sendPushToUser } from "@/lib/web-push";
import { notifyUser } from "@/lib/notifications";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUserId();
    const { id } = await params;
    const request = await db.friendRequest.findUnique({ where: { id } });
    if (!request || request.receiverId !== me || request.status !== "PENDING") {
      return fail("NOT_FOUND", "Поканата не е налична.", 404);
    }
    if (await areBlocked(request.senderId, me)) return fail("BLOCKED", "Контактът не е разрешен.", 403);

    const [userAId, userBId] = pair(request.senderId, me);
    const conversation = await db.$transaction(async (tx) => {
      const claimed = await tx.friendRequest.updateMany({
        where: { id, receiverId: me, status: "PENDING" },
        data: { status: "ACCEPTED", respondedAt: new Date() },
      });
      if (!claimed.count) return null;
      await tx.friendship.upsert({
        where: { userAId_userBId: { userAId, userBId } },
        update: {},
        create: { userAId, userBId },
      });
      return tx.conversation.create({ data: { members: { create: [{ userId: userAId }, { userId: userBId }] } } });
    });
    if (!conversation) return fail("NOT_FOUND", "Поканата не е налична.", 404);

    const recipient = await db.user.findUnique({
      where: { id: me },
      select: { handle: true, profile: { select: { displayName: true } } },
    });
    if (recipient) {
      const displayName = recipient.profile?.displayName ?? recipient.handle;
      const notification = {
        requestId: id,
        status: "ACCEPTED" as const,
        recipient: { handle: recipient.handle, displayName },
        createdAt: new Date().toISOString(),
      };
      getAppSocket()?.to(`user:${request.senderId}`).emit("notification:friend-request-updated", notification);
      void notifyUser({ userId: request.senderId, type: "FRIEND_REQUEST_ACCEPTED", title: "Поканата е приета", body: `${displayName} прие поканата ти за приятелство.`, url: "/", payload: { requestId: id }, push: false }).catch((error) => console.error("Could not create friendship notification", error));
      void sendPushToUser(request.senderId, {
        title: "Поканата е приета",
        body: `${displayName} прие поканата ти за приятелство.`,
        url: "/",
      }).catch((error: unknown) => console.error("Could not send friend request accepted push notification", error));
    }
    return ok({ conversationId: conversation.id });
  } catch (error) {
    return apiError(error);
  }
}

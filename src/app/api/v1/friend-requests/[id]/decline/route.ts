import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/http";
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
    const result = await db.friendRequest.updateMany({
      where: { id, receiverId: me, status: "PENDING" },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    if (!result.count) return fail("NOT_FOUND", "Поканата не е налична.", 404);

    const recipient = await db.user.findUnique({
      where: { id: me },
      select: { handle: true, profile: { select: { displayName: true } } },
    });
    if (recipient) {
      const displayName = recipient.profile?.displayName ?? recipient.handle;
      const notification = {
        requestId: id,
        status: "DECLINED",
        recipient: { handle: recipient.handle, displayName },
        createdAt: new Date().toISOString(),
      } as const;
      getAppSocket()?.to(`user:${request.senderId}`).emit("notification:friend-request-updated", notification);
      void notifyUser({ userId: request.senderId, type: "FRIEND_REQUEST_DECLINED", title: "Поканата е отказана", body: `${displayName} отказа поканата ти за приятелство.`, url: "/", payload: { requestId: id }, push: false }).catch((error) => console.error("Could not create friendship notification", error));
      void sendPushToUser(request.senderId, {
        title: "Поканата е отказана",
        body: `${displayName} отказа поканата ти за приятелство.`,
        url: "/",
      }).catch((error: unknown) => console.error("Could not send friend request declined push notification", error));
    }
    return ok({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

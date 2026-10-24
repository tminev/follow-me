import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/http";
import { areBlocked } from "@/lib/social";
import { getAppSocket } from "@/lib/app-socket";
import { sendPushToUser } from "@/lib/web-push";

async function members(conversationId: string, userId: string) {
  const ownMembership = await db.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!ownMembership) return null;

  return db.conversationMember.findMany({
    where: { conversationId },
    select: { userId: true },
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUserId();
    const { id } = await params;
    if (!await members(id, me)) return fail("FORBIDDEN", "Нямате достъп до този разговор.", 403);

    const messages = await db.message.findMany({
      where: { conversationId: id, deletedAt: null },
      select: { id: true, body: true, senderId: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    return ok({ messages: messages.reverse().map((message) => ({ ...message, isMine: message.senderId === me })) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUserId();
    const { id } = await params;
    const list = await members(id, me);
    if (!list) return fail("FORBIDDEN", "Нямате достъп до този разговор.", 403);

    const other = list.find((member) => member.userId !== me);
    if (!other || await areBlocked(me, other.userId)) {
      return fail("BLOCKED", "Съобщението не може да бъде изпратено.", 403);
    }

    const { body } = z.object({ body: z.string().trim().min(1).max(2000) }).parse(await request.json());
    const [message, sender] = await Promise.all([
      db.message.create({
        data: { conversationId: id, senderId: me, body },
        select: { id: true, body: true, senderId: true, createdAt: true },
      }),
      db.user.findUnique({
        where: { id: me },
        select: { handle: true, profile: { select: { displayName: true } } },
      }),
    ]);

    const chatMessage = { ...message, createdAt: message.createdAt.toISOString() };
    const sockets = getAppSocket();
    sockets?.to(`conversation:${id}`).emit("chat:message", { conversationId: id, message: chatMessage });

    if (sender) {
      const displayName = sender.profile?.displayName ?? sender.handle;
      sockets?.to(`user:${other.userId}`).emit("notification:message", {
        conversationId: id,
        message: chatMessage,
        sender: { handle: sender.handle, displayName },
      });
      void sendPushToUser(other.userId, {
        title: `Ново съобщение от ${displayName}`,
        body: "Отвори Follow Me, за да прочетеш съобщението.",
        url: "/",
      }).catch((error: unknown) => console.error("Could not send message push notification", error));
    }

    return ok({ message }, 201);
  } catch (error) {
    return apiError(error);
  }
}

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/http";
import { areBlocked, areFriends } from "@/lib/social";
import { getAppSocket } from "@/lib/app-socket";
import { sendPushToUser } from "@/lib/web-push";

const schema = z.object({ recipientId: z.string().min(1), intro: z.string().trim().max(160).optional() });
const invitationUserSelect = {
  id: true, handle: true,
  profile: { select: { displayName: true, bio: true, city: true, neighborhood: true, avatarUrl: true, heightCm: true, hairColor: true, interestsText: true, lookingFor: true, favoriteMovie: true, favoriteBook: true, occupation: true, education: true, languages: true, weekendStyle: true, firstDateIdea: true } },
} as const;

export async function POST(request: Request) {
  try {
    const senderId = await requireUserId();
    const input = schema.parse(await request.json());
    if (senderId === input.recipientId) return fail("SELF_REQUEST", "Не можете да поканите себе си.", 400);
    const recipient = await db.user.findUnique({ where: { id: input.recipientId }, select: { id: true } });
    if (!recipient) return fail("USER_NOT_FOUND", "Този профил вече не е наличен.", 404);
    if (await areBlocked(senderId, input.recipientId)) return fail("BLOCKED", "Контактът не е разрешен.", 403);
    if (await areFriends(senderId, input.recipientId)) return fail("ALREADY_FRIENDS", "Вече сте приятели.", 409);
    const reverse = await db.friendRequest.findFirst({ where: { senderId: input.recipientId, receiverId: senderId, status: "PENDING" } });
    if (reverse) return fail("REVERSE_REQUEST_PENDING", "Този човек вече ви е изпратил покана.", 409);
    const [item, sender] = await Promise.all([
      db.friendRequest.upsert({ where: { senderId_receiverId: { senderId, receiverId: input.recipientId } }, update: { status: "PENDING", intro: input.intro, respondedAt: null }, create: { senderId, receiverId: input.recipientId, intro: input.intro } }),
      db.user.findUnique({ where: { id: senderId }, select: { handle: true, profile: { select: { displayName: true } } } }),
    ]);
    if (!sender) return fail("UNAUTHORIZED", "Необходим е вход.", 401);
    getAppSocket()?.to(`user:${input.recipientId}`).emit("notification:friend-request", { requestId: item.id, sender: { handle: sender.handle, displayName: sender.profile?.displayName ?? sender.handle }, createdAt: item.createdAt.toISOString() });
    void sendPushToUser(input.recipientId, { title: "Нова покана", body: `${sender.profile?.displayName ?? sender.handle} ти изпрати покана за приятелство.`, url: "/" }).catch((error) => console.error("Could not send friend request push notification", error));
    return ok({ request: item }, 201);
  } catch (error) { return apiError(error); }
}

export async function GET(request: Request) {
  try {
    const id = await requireUserId();
    const direction = new URL(request.url).searchParams.get("direction") === "outgoing" ? "outgoing" : "incoming";
    const items = await db.friendRequest.findMany({
      where: direction === "incoming" ? { receiverId: id, status: "PENDING" } : { senderId: id },
      include: direction === "incoming" ? { sender: { select: invitationUserSelect } } : { receiver: { select: invitationUserSelect } },
      orderBy: { createdAt: "desc" },
    });
    return ok({ requests: items });
  } catch (error) { return apiError(error); }
}

import { db } from "@/lib/db";
import { getAppSocket } from "@/lib/app-socket";
import { sendPushToUser } from "@/lib/web-push";

type CreateNotification = {
  userId: string;
  type: "FRIEND_REQUEST" | "FRIEND_REQUEST_ACCEPTED" | "FRIEND_REQUEST_DECLINED" | "NEW_MESSAGE" | "GAME_INVITATION" | "GAME_UPDATE";
  title: string;
  body: string;
  url?: string;
  payload?: Record<string, string>;
  push?: boolean;
};

export async function notifyUser(input: CreateNotification) {
  const { push, ...data } = input;
  const notification = await db.notification.create({ data });
  const event = { id: notification.id, type: notification.type, title: notification.title, body: notification.body, url: notification.url, createdAt: notification.createdAt.toISOString() };
  getAppSocket()?.to(`user:${input.userId}`).emit("notification:new", event);
  if (push !== false) void sendPushToUser(input.userId, { title: input.title, body: input.body, url: input.url ?? "/" }).catch((error) => console.error("Could not deliver push notification", error));
  return notification;
}

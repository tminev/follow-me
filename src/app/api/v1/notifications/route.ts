import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, ok } from "@/lib/http";

export async function GET() {
  try {
    const userId = await requireUserId();
    const notifications = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
    return ok({ notifications, unreadCount: notifications.filter((item) => !item.readAt).length });
  } catch (error) { return apiError(error); }
}

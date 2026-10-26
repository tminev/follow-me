import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, ok } from "@/lib/http";

export async function GET() {
  try {
    const userId = await requireUserId();
    const [blocked, hidden, reports] = await Promise.all([
      db.userBlock.findMany({ where: { blockerId: userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true, blocked: { select: { id: true, handle: true, profile: { select: { displayName: true, avatarUrl: true } } } } } }),
      db.visibilityExclusion.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "desc" }, select: { createdAt: true, excludedUser: { select: { id: true, handle: true, profile: { select: { displayName: true, avatarUrl: true } } } } } }),
      db.report.findMany({ where: { reporterId: userId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, category: true, status: true, createdAt: true, targetUser: { select: { handle: true, profile: { select: { displayName: true } } } } } }),
    ]);
    return ok({ blocked, hidden, reports });
  } catch (error) { return apiError(error); }
}

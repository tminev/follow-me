import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, ok } from "@/lib/http";
import { activePresence } from "@/lib/presence";

export async function GET() {
  try {
    const me = await requireUserId();
    const session = await db.visibilitySession.findFirst({
      where: { userId: me, endedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { startedAt: "desc" },
    });
    return ok({
      visible: Boolean(session && activePresence(me)),
      session: session ? { id: session.id, expiresAt: session.expiresAt, continuous: session.shareMode === "CONTINUOUS" } : null,
    });
  } catch (error) {
    return apiError(error);
  }
}
import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/http";

async function moderator() {
  const userId = await requireUserId();
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user || (user.role !== "MODERATOR" && user.role !== "ADMIN")) return null;
  return user;
}

export async function GET() {
  try {
    if (!await moderator()) return fail("FORBIDDEN", "Нямаш права за модерация.", 403);
    const reports = await db.report.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100,
      include: { reporter: { select: { handle: true, profile: { select: { displayName: true } } } }, targetUser: { select: { id: true, handle: true, accountStatus: true, profile: { select: { displayName: true } } } } },
    });
    return ok({ reports });
  } catch (error) { return apiError(error); }
}

const actionSchema = z.object({ reportId: z.string().min(1), decision: z.enum(["UNDER_REVIEW", "RESOLVED", "DISMISSED"]), restriction: z.enum(["NONE", "RESTRICTED", "SUSPENDED", "BANNED"]).default("NONE"), reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request) {
  try {
    const actor = await moderator();
    if (!actor) return fail("FORBIDDEN", "Нямаш права за модерация.", 403);
    const input = actionSchema.parse(await request.json());
    const report = await db.report.findUnique({ where: { id: input.reportId } });
    if (!report) return fail("NOT_FOUND", "Сигналът не е наличен.", 404);
    await db.$transaction(async (tx) => {
      await tx.report.update({ where: { id: report.id }, data: { status: input.decision } });
      if (report.targetUserId && input.restriction !== "NONE") {
        await tx.user.update({ where: { id: report.targetUserId }, data: { accountStatus: input.restriction } });
        const action = input.restriction === "RESTRICTED" ? "CONTACT_COOLDOWN" : input.restriction === "SUSPENDED" ? "SUSPEND" : "BAN";
        await tx.moderationAction.create({ data: { reportId: report.id, targetId: report.targetUserId, moderatorId: actor.id, action, reason: input.reason } });
      }
    });
    return ok({ ok: true });
  } catch (error) { return apiError(error); }
}

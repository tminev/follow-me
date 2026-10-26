import { z } from "zod";
import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, fail, ok } from "@/lib/http";

const createSchema = z.object({
  targetUserId: z.string().min(1),
  category: z.enum(["UNWANTED_CONTACT", "HARASSMENT", "THREAT", "SEXUAL_CONTENT", "FAKE_PROFILE", "BLOCK_EVASION", "OTHER"]),
  details: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const reporterId = await requireUserId();
    const input = createSchema.parse(await request.json());
    if (input.targetUserId === reporterId) return fail("SELF_REPORT", "Не можеш да докладваш собствения си профил.", 400);
    const target = await db.user.findUnique({ where: { id: input.targetUserId }, select: { id: true } });
    if (!target) return fail("USER_NOT_FOUND", "Този профил вече не е наличен.", 404);
    const report = await db.report.create({ data: { reporterId, ...input } });
    return ok({ report: { id: report.id, status: report.status, createdAt: report.createdAt } }, 201);
  } catch (error) { return apiError(error); }
}

export async function GET() {
  try {
    const reporterId = await requireUserId();
    const reports = await db.report.findMany({ where: { reporterId }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, category: true, status: true, createdAt: true, targetUser: { select: { handle: true, profile: { select: { displayName: true } } } } } });
    return ok({ reports });
  } catch (error) { return apiError(error); }
}

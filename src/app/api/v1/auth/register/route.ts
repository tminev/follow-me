import { hash } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { issueSession } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/http";

const schema = z.object({
  email: z.email().transform(v => v.toLowerCase()), handle: z.string().regex(/^[a-zA-Z0-9_]{3,24}$/, "Потребителското име трябва да е 3–24 латински букви, цифри или _ без интервали."),
  password: z.string().min(8).max(72), displayName: z.string().trim().min(2).max(50),
  dateOfBirth: z.iso.date(), declaredAdult: z.boolean(),
});
export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      const handleIssue = parsed.error.issues.find((issue) => issue.path[0] === "handle");
      if (handleIssue) return fail("INVALID_HANDLE", handleIssue.message, 422);
      return fail("VALIDATION_ERROR", "Провери въведените данни и опитай отново.", 422);
    }
    const input = parsed.data;
    const dob = new Date(`${input.dateOfBirth}T00:00:00.000Z`);
    const today = new Date(); let age = today.getUTCFullYear() - dob.getUTCFullYear();
    if (today.getUTCMonth() < dob.getUTCMonth() || (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate())) age--;
    const effectiveAdult = input.declaredAdult && age >= 18;
    const existing = await db.user.findFirst({
      where: { OR: [{ email: input.email }, { handle: input.handle }] },
      select: { email: true, handle: true },
    });
    if (existing?.email === input.email) {
      return fail("EMAIL_ALREADY_USED", "Вече има профил с този имейл. Опитай да влезеш в него.", 409);
    }
    if (existing?.handle === input.handle) {
      return fail("HANDLE_ALREADY_USED", "Това потребителско име вече е заето. Избери друго.", 409);
    }
    const user = await db.user.create({ data: { email: input.email, handle: input.handle, passwordHash: await hash(input.password, 12), dateOfBirth: dob, declaredAdult: effectiveAdult, profile: { create: { displayName: input.displayName } } } });
    await issueSession(user.id);
    return ok({ user: { id: user.id, handle: user.handle, declaredAdult: user.declaredAdult, ageVerified: false } }, 201);
  } catch (error) { return apiError(error); }
}


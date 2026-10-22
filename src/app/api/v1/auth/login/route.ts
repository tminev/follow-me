import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { issueSession } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/http";
const schema = z.object({ email: z.email().transform(v => v.toLowerCase()), password: z.string().min(1).max(72) });
export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (!user || !(await compare(input.password, user.passwordHash))) return fail("INVALID_CREDENTIALS", "Невалиден имейл или парола.", 401);
    await issueSession(user.id); return ok({ user: { id: user.id, handle: user.handle } });
  } catch (error) { return apiError(error); }
}


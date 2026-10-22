import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/http";
import { canUseLocation } from "@/lib/policies";

const requestSchema = z.union([
  z.object({ durationMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]) }),
  z.object({ continuous: z.literal(true) }),
]);

export async function POST(request: Request) {
  try {
    const me = await requireUserId();
    const requestData = requestSchema.parse(await request.json());
    const user = await db.user.findUniqueOrThrow({
      where: { id: me },
      select: { declaredAdult: true, dateOfBirth: true, ageVerificationStatus: true },
    });
    if (!canUseLocation(user)) return fail("AGE_VERIFICATION_REQUIRED", "Картата е достъпна само за пълнолетни потребители.", 403);

    const continuous = "continuous" in requestData;
    const expiresAt = "continuous" in requestData
      ? new Date(Date.now() + 365 * 24 * 60 * 60_000)
      : new Date(Date.now() + requestData.durationMinutes * 60_000);

    await db.visibilitySession.updateMany({ where: { userId: me, endedAt: null }, data: { endedAt: new Date() } });
    const session = await db.visibilitySession.create({
      data: { userId: me, expiresAt, shareMode: continuous ? "CONTINUOUS" : "TEMPORARY" },
    });
    return ok({ session: { id: session.id, expiresAt: session.expiresAt, continuous } });
  } catch (error) {
    return apiError(error);
  }
}
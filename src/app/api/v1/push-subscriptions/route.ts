import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/http";
import { webPushConfigured, webPushPublicKey } from "@/lib/web-push";

const subscriptionSchema = z.object({
  endpoint: z.url().refine((value) => value.startsWith("https://")),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function GET() {
  try {
    const userId = await requireUserId();
    const subscription = await db.pushSubscription.findFirst({ where: { userId }, select: { id: true } });
    return ok({ configured: webPushConfigured(), publicKey: webPushPublicKey(), subscribed: Boolean(subscription) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    if (!webPushConfigured()) return fail("PUSH_NOT_CONFIGURED", "Push известията не са конфигурирани на сървъра.", 503);
    const parsed = subscriptionSchema.safeParse(await request.json());
    if (!parsed.success) return fail("VALIDATION_ERROR", "Невалидна push регистрация.", 422, parsed.error.flatten());
    const { endpoint, keys } = parsed.data;
    const existing = await db.pushSubscription.findUnique({ where: { endpoint }, select: { userId: true } });
    if (existing && existing.userId !== userId) {
      return fail("PUSH_SUBSCRIPTION_IN_USE", "Тази push регистрация принадлежи на друг профил.", 409);
    }
    await db.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh: keys.p256dh, auth: keys.auth },
      create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });
    return ok({ subscribed: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireUserId();
    const parsed = z.object({ endpoint: z.url() }).safeParse(await request.json());
    if (!parsed.success) return fail("VALIDATION_ERROR", "Невалидна push регистрация.", 422, parsed.error.flatten());
    await db.pushSubscription.deleteMany({ where: { userId, endpoint: parsed.data.endpoint } });
    return ok({ subscribed: false });
  } catch (error) {
    return apiError(error);
  }
}

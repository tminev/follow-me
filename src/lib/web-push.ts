import webpush from "web-push";
import { db } from "@/lib/db";

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export function webPushPublicKey() {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

function vapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function webPushConfigured() {
  return Boolean(vapidConfig());
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });
  if (!subscriptions.length) return;

  const config = vapidConfig();
  if (!config) {
    console.error("Web Push subscriptions exist but VAPID is not configured.");
    return;
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify(payload),
        { TTL: 3600 },
      );
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? error.statusCode
        : undefined;
      if (statusCode === 404 || statusCode === 410) {
        await db.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
        return;
      }
      console.error("Web Push delivery failed", error);
    }
  }));
}

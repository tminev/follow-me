import { requireUserId } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, ok } from "@/lib/http";
import { ensureProgression, levelForXp } from "@/lib/progression";

export async function GET() {
  try {
    const userId = await requireUserId();
    const { wallet, progression } = await ensureProgression(userId);
    const [recentSparks, recentXp, recentLoyalty] = await Promise.all([
      db.sparkLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8, select: { delta: true, eventType: true, createdAt: true } }),
      db.xpLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8, select: { delta: true, eventType: true, createdAt: true } }),
      db.loyaltyLedger.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 8, select: { delta: true, eventType: true, createdAt: true } }),
    ]);
    return ok({ wallet: { sparks: wallet.balance }, progression: { xp: progression.xp, level: levelForXp(progression.xp), loyaltyPoints: progression.loyaltyPoints }, activity: { sparks: recentSparks, xp: recentXp, loyalty: recentLoyalty } });
  } catch (error) { return apiError(error); }
}

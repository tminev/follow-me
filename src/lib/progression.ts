import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const GAME_COMPLETION_REWARD = { xp: 30, sparks: 10, loyalty: 5 };

export function levelForXp(xp: number) {
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);
}

export async function ensureProgression(userId: string) {
  const [wallet, progression] = await Promise.all([
    db.walletBalance.upsert({ where: { userId }, update: {}, create: { userId } }),
    db.progression.upsert({ where: { userId }, update: {}, create: { userId, lastActiveAt: new Date() } }),
  ]);
  return { wallet, progression };
}

export async function rewardCompletedGame(userId: string, gameId: string) {
  const key = `game-completed:${gameId}:${userId}`;
  return db.$transaction(async (tx) => {
    const existing = await tx.sparkLedger.findUnique({ where: { idempotencyKey: key } });
    if (existing) return false;
    const metadata: Prisma.InputJsonValue = { gameId, reward: GAME_COMPLETION_REWARD };
    await tx.sparkLedger.create({ data: { userId, delta: GAME_COMPLETION_REWARD.sparks, eventType: "GAME_COMPLETED", idempotencyKey: key, metadata } });
    await tx.xpLedger.create({ data: { userId, delta: GAME_COMPLETION_REWARD.xp, eventType: "GAME_COMPLETED", idempotencyKey: key, metadata } });
    await tx.loyaltyLedger.create({ data: { userId, delta: GAME_COMPLETION_REWARD.loyalty, eventType: "GAME_COMPLETED", idempotencyKey: key } });
    const progression = await tx.progression.upsert({
      where: { userId },
      update: { xp: { increment: GAME_COMPLETION_REWARD.xp }, loyaltyPoints: { increment: GAME_COMPLETION_REWARD.loyalty }, lastActiveAt: new Date() },
      create: { userId, xp: GAME_COMPLETION_REWARD.xp, loyaltyPoints: GAME_COMPLETION_REWARD.loyalty, lastActiveAt: new Date() },
    });
    await tx.progression.update({ where: { userId }, data: { level: levelForXp(progression.xp) } });
    await tx.walletBalance.upsert({ where: { userId }, update: { balance: { increment: GAME_COMPLETION_REWARD.sparks }, version: { increment: 1 } }, create: { userId, balance: GAME_COMPLETION_REWARD.sparks, version: 1 } });
    return true;
  });
}

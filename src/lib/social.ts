import { db } from "@/lib/db";
export const pair = (a: string, b: string) => a < b ? [a,b] as const : [b,a] as const;
export async function areBlocked(a: string, b: string) { return Boolean(await db.userBlock.findFirst({ where: { OR: [{ blockerId:a, blockedId:b }, { blockerId:b, blockedId:a }] } })); }
export async function areFriends(a: string, b: string) { const [userAId,userBId]=pair(a,b); return Boolean(await db.friendship.findUnique({ where: { userAId_userBId: { userAId,userBId } } })); }


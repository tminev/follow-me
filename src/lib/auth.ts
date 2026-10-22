import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { createAccessToken, userIdFromAccessToken } from "@/lib/auth-token";

const ACCESS_COOKIE = "fm_access";
const REFRESH_COOKIE = "fm_refresh";
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueSession(userId: string) {
  const access = await createAccessToken(userId);
  const refresh = randomBytes(32).toString("base64url");
  await db.refreshSession.create({ data: { userId, hashedToken: tokenHash(refresh), expiresAt: new Date(Date.now() + 30 * 86400_000) } });
  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(ACCESS_COOKIE, access, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 900 });
  jar.set(REFRESH_COOKIE, refresh, { httpOnly: true, sameSite: "lax", secure, path: "/api/v1/auth", maxAge: 30 * 86400 });
}

export async function clearSession() {
  const jar = await cookies();
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (refresh) await db.refreshSession.updateMany({ where: { hashedToken: tokenHash(refresh), revokedAt: null }, data: { revokedAt: new Date() } });
  jar.delete(ACCESS_COOKIE); jar.delete(REFRESH_COOKIE);
}

export async function currentUserId() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return userIdFromAccessToken(token);
}
export async function requireUserId() { const id = await currentUserId(); if (!id) throw new Error("UNAUTHORIZED"); return id; }

export async function rotateSession() {
  const jar = await cookies();
  const oldToken = jar.get(REFRESH_COOKIE)?.value;
  if (!oldToken) throw new Error("UNAUTHORIZED");
  const existing = await db.refreshSession.findUnique({ where: { hashedToken: tokenHash(oldToken) } });
  if (!existing || existing.revokedAt || existing.expiresAt <= new Date()) throw new Error("UNAUTHORIZED");
  await db.refreshSession.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  await issueSession(existing.userId);
}

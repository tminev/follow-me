import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "development-only-secret-change-before-deploying");

export async function createAccessToken(userId: string) {
  return new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("15m").sign(secret);
}

export async function userIdFromAccessToken(token: string) {
  try {
    return (await jwtVerify(token, secret)).payload.sub ?? null;
  } catch {
    return null;
  }
}

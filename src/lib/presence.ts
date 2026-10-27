import { createClient, type RedisClientType } from "redis";

export type Presence = { latitude: number; longitude: number; accuracyMeters: number; expiresAt: number; updatedAt: number };
export class PresenceUnavailableError extends Error { constructor() { super("PRESENCE_UNAVAILABLE"); } }

const memory = globalThis as unknown as { followMePresence?: Map<string, Presence>; followMeRedis?: Promise<RedisClientType | null> };
const localPresence = memory.followMePresence ?? new Map<string, Presence>();
if (process.env.NODE_ENV !== "production") memory.followMePresence = localPresence;

async function redis() {
  if (!process.env.REDIS_URL) return null;
  if (!memory.followMeRedis) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (error) => console.error("Redis presence error", error.message));
    memory.followMeRedis = client.connect().then(() => client).catch(() => null);
  }
  return memory.followMeRedis;
}

function ttlSeconds(item: Presence) { return Math.max(1, Math.ceil((item.expiresAt - Date.now()) / 1000)); }
function key(userId: string) { return `follow-me:presence:${userId}`; }

export async function putPresence(userId: string, item: Presence) {
  const client = await redis();
  if (client) {
    await client.set(key(userId), JSON.stringify(item), { EX: ttlSeconds(item) });
    return;
  }
  if (process.env.NODE_ENV === "production") throw new PresenceUnavailableError();
  localPresence.set(userId, item);
}

export async function getActivePresence(userId: string): Promise<Presence | null> {
  const client = await redis();
  if (client) {
    const raw = await client.get(key(userId));
    if (!raw) return null;
    const item = JSON.parse(raw) as Presence;
    return item.expiresAt > Date.now() ? item : null;
  }
  if (process.env.NODE_ENV === "production") throw new PresenceUnavailableError();
  const item = localPresence.get(userId);
  if (!item || item.expiresAt <= Date.now()) { localPresence.delete(userId); return null; }
  return item;
}

export async function removePresence(userId: string) {
  const client = await redis();
  if (client) { await client.del(key(userId)); return; }
  if (process.env.NODE_ENV === "production") throw new PresenceUnavailableError();
  localPresence.delete(userId);
}

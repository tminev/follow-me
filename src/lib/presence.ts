type Presence = { latitude: number; longitude: number; accuracyMeters: number; expiresAt: number };
const globalPresence = globalThis as unknown as { followMePresence?: Map<string, Presence> };
export const presence = globalPresence.followMePresence ?? new Map<string, Presence>();
if (process.env.NODE_ENV !== "production") globalPresence.followMePresence = presence;
export function activePresence(userId: string) {
  const item = presence.get(userId);
  if (!item || item.expiresAt <= Date.now()) { presence.delete(userId); return null; }
  return item;
}

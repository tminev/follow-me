const globalState = globalThis as typeof globalThis & { followMeProximityAlerts?: Map<string, number> };
const cooldowns = globalState.followMeProximityAlerts ?? new Map<string, number>();
if (process.env.NODE_ENV !== "production") globalState.followMeProximityAlerts = cooldowns;

const COOLDOWN_MS = 5 * 60_000;

export function reserveProximityAlert(firstUserId: string, secondUserId: string, now = Date.now()) {
  const key = [firstUserId, secondUserId].sort().join(":");
  const until = cooldowns.get(key) ?? 0;
  if (until > now) return false;
  cooldowns.set(key, now + COOLDOWN_MS);
  return true;
}

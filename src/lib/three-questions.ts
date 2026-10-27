export { ROMANTIC_GAMES, findRomanticGame } from "@/lib/romantic-games";

export function answersFrom(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

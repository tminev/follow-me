export type Coordinates = { latitude: number; longitude: number };

export type LoyaltyLevel = "STANDARD" | "LOYAL";

export type DiscoveryRadius = {
  meters: number;
  loyaltyLabel: string;
};

// Temporary policy hook. When the loyalty programme is added, this function will
// read the member's loyalty status from the database instead of returning STANDARD.
export function loyaltyLevelForUser(_userId: string): LoyaltyLevel {
  return "STANDARD";
}

export function discoveryRadiusFor(loyaltyLevel: LoyaltyLevel): DiscoveryRadius {
  if (loyaltyLevel === "LOYAL") return { meters: 2_000, loyaltyLabel: "Лоялен член" };
  return { meters: 600, loyaltyLabel: "Стандартен радиус" };
}

export function distanceInMeters(a: Coordinates, b: Coordinates) {
  const earthRadius = 6_371_000;
  const radians = Math.PI / 180;
  const deltaLatitude = (b.latitude - a.latitude) * radians;
  const deltaLongitude = (b.longitude - a.longitude) * radians;
  const latitudeA = a.latitude * radians;
  const latitudeB = b.latitude * radians;
  const value = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(value));
}
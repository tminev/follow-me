import { describe, expect, it } from "vitest";
import { approximateCoordinate, canUseLocation } from "./policies";

describe("location safety policy", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  it("rejects unverified adults", () => expect(canUseLocation({ declaredAdult: true, ageVerificationStatus: "UNVERIFIED", dateOfBirth: new Date("1990-01-01") }, now)).toBe(false));
  it("rejects minors even when declared adult", () => expect(canUseLocation({ declaredAdult: true, ageVerificationStatus: "VERIFIED", dateOfBirth: new Date("2012-01-01") }, now)).toBe(false));
  it("allows verified adults", () => expect(canUseLocation({ declaredAdult: true, ageVerificationStatus: "VERIFIED", dateOfBirth: new Date("1990-01-01") }, now)).toBe(true));
  it("reduces coordinate precision", () => expect(approximateCoordinate(42.6977082)).toBe(42.7));
});


import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok(data: unknown, status = 200) { return NextResponse.json(data, { status }); }
export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json({ code, message, ...(details ? { details } : {}) }, { status });
}
export function apiError(error: unknown) {
  if (error instanceof ZodError) return fail("VALIDATION_ERROR", "Невалидни данни.", 422, error.flatten());
  if (error instanceof Error && error.message === "UNAUTHORIZED") return fail("UNAUTHORIZED", "Необходим е вход.", 401);
  console.error(error instanceof Error ? error.message : "Unknown API error");
  return fail("INTERNAL_ERROR", "Възникна неочаквана грешка.", 500);
}


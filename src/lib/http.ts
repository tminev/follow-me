import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json({
    ok: false,
    code,
    message,
    error: { code, message, ...(details ? { details } : {}) },
    ...(details ? { details } : {}),
  }, { status });
}

export function apiError(error: unknown) {
  if (error instanceof SyntaxError) {
    return fail("INVALID_JSON", "Изпратените данни са в невалиден формат. Обнови страницата и опитай отново.", 400);
  }
  if (error instanceof ZodError) {
    return fail("VALIDATION_ERROR", "Провери попълнените полета и опитай отново.", 422, error.flatten());
  }
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return fail("UNAUTHORIZED", "Сесията ти е изтекла. Влез отново в профила си.", 401);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return fail("ALREADY_EXISTS", "Тези данни вече се използват.", 409);
    if (error.code === "P2003") return fail("RELATED_RESOURCE_NOT_FOUND", "Избраният профил или запис вече не е наличен.", 404);
    if (error.code === "P2025") return fail("NOT_FOUND", "Търсеният запис не е наличен или вече е променен.", 404);
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return fail("DATABASE_UNAVAILABLE", "Връзката с базата данни временно не е налична. Опитай пак след малко.", 503);
  }

  console.error(error instanceof Error ? error.message : "Unknown API error");
  return fail("INTERNAL_ERROR", "Възникна неочаквана грешка. Опитай отново след малко.", 500);
}

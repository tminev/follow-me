import { clearSession } from "@/lib/auth";
import { apiError, ok } from "@/lib/http";
export async function POST() { try { await clearSession(); return ok({ ok: true }); } catch (e) { return apiError(e); } }


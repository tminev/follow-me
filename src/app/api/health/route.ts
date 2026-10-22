import { ok } from "@/lib/http";
export async function GET() { return ok({ status: "ok", service: "follow-me", time: new Date().toISOString() }); }


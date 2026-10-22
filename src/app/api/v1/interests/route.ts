import { db } from "@/lib/db"; import { apiError, ok } from "@/lib/http";
export async function GET() { try { return ok({ interests: await db.interest.findMany({ orderBy: { title: "asc" } }) }); } catch(e) { return apiError(e); } }


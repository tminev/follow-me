import { db } from "@/lib/db";import { requireUserId } from "@/lib/auth";import { apiError,ok } from "@/lib/http";import { presence } from "@/lib/presence";
export async function POST(){try{const me=await requireUserId();await db.visibilitySession.updateMany({where:{userId:me,endedAt:null},data:{endedAt:new Date()}});presence.delete(me);return ok({visible:false})}catch(e){return apiError(e)}}


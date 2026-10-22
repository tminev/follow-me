import { db } from "@/lib/db"; import { requireUserId } from "@/lib/auth"; import { apiError, ok } from "@/lib/http"; import { publicUserSelect } from "@/lib/public-user";
export async function GET(){try{const me=await requireUserId();const rows=await db.friendship.findMany({where:{OR:[{userAId:me},{userBId:me}]},include:{userA:{select:publicUserSelect},userB:{select:publicUserSelect}},orderBy:{createdAt:"desc"}});return ok({friends:rows.map(r=>r.userAId===me?r.userB:r.userA)})}catch(e){return apiError(e)}}


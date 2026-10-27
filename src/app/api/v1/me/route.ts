import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, ok } from "@/lib/http";
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const visibilitySchema = z.object({
  photo: z.enum(["PUBLIC", "FRIENDS"]), about: z.enum(["PUBLIC", "FRIENDS"]), location: z.enum(["PUBLIC", "FRIENDS"]),
  appearance: z.enum(["PUBLIC", "FRIENDS"]), intentions: z.enum(["PUBLIC", "FRIENDS"]), interests: z.enum(["PUBLIC", "FRIENDS"]),
  favorites: z.enum(["PUBLIC", "FRIENDS"]), professional: z.enum(["PUBLIC", "FRIENDS"]), lifestyle: z.enum(["PUBLIC", "FRIENDS"]),
});
const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(50).optional(),
  bio: optionalText(500), city: optionalText(80), neighborhood: optionalText(80),
  heightCm: z.number().int().min(120).max(240).nullable().optional(), hairColor: optionalText(40),
  interestsText: optionalText(300), lookingFor: optionalText(80), favoriteMovie: optionalText(120), favoriteBook: optionalText(120),
  occupation: optionalText(100), education: optionalText(100), languages: optionalText(120), weekendStyle: optionalText(160), firstDateIdea: optionalText(180),
  avatarUrl: z.union([z.url(), z.string().regex(/^data:image\/(jpeg|png|webp|gif);base64,/).max(1_500_000)]).nullable().optional(),
  visibility: visibilitySchema.optional(),
});
export async function GET() {
  try { const id = await requireUserId(); const user = await db.user.findUniqueOrThrow({ where: { id }, select: { id: true, handle: true, email: true, declaredAdult: true, ageVerificationStatus: true, role: true, profile: true, interests: { select: { interest: true } } } }); return ok({ user }); } catch (e) { return apiError(e); }
}
export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId();
    const { visibility, ...data } = profileSchema.parse(await request.json());
    const profile = await db.profile.update({ where: { userId }, data: { ...data, ...(visibility ? { profileVisibility: JSON.stringify(visibility) } : {}) } });
    return ok({ profile });
  } catch (e) { return apiError(e); }
}


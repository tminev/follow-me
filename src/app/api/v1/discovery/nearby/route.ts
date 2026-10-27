import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { apiError, fail, ok } from "@/lib/http";
import { getActivePresence } from "@/lib/presence";
import { canUseLocation } from "@/lib/policies";
import { discoveryRadiusFor, distanceInMeters, loyaltyLevelForUser } from "@/lib/discovery-radius";
import { profileForAudience } from "@/lib/profile-visibility";

export async function GET() {
  try {
    const me = await requireUserId();
    const viewer = await db.user.findUniqueOrThrow({
      where: { id: me },
      select: { declaredAdult: true, dateOfBirth: true, ageVerificationStatus: true },
    });
    if (!canUseLocation(viewer)) return fail("AGE_VERIFICATION_REQUIRED", "Откриването е достъпно само за пълнолетни потребители.", 403);

    const loyaltyLevel = await loyaltyLevelForUser(me);
    const radius = discoveryRadiusFor(loyaltyLevel);
    const viewerPresence = await getActivePresence(me);
    if (!viewerPresence) return ok({ users: [], radiusMeters: radius.meters, loyaltyLabel: radius.loyaltyLabel });

    const blocks = await db.userBlock.findMany({ where: { OR: [{ blockerId: me }, { blockedId: me }] } });
    const hidden = await db.visibilityExclusion.findMany({ where: { excludedUserId: me } });
    const excluded = new Set([me, ...blocks.flatMap((item) => [item.blockerId, item.blockedId]), ...hidden.map((item) => item.ownerId)]);
    const sessions = await db.visibilitySession.findMany({
      where: { endedAt: null, expiresAt: { gt: new Date() }, userId: { notIn: [...excluded] } },
      include: {
        user: {
          select: {
            id: true,
            handle: true,
            profile: {
              select: {
                displayName: true, bio: true, city: true, neighborhood: true, avatarUrl: true, profileVisibility: true,
                heightCm: true, hairColor: true, interestsText: true, lookingFor: true, favoriteMovie: true, favoriteBook: true,
                occupation: true, education: true, languages: true, weekendStyle: true, firstDateIdea: true,
              },
            },
          },
        },
      },
    });
    const users = (await Promise.all(sessions.map(async (session) => {
      const presence = await getActivePresence(session.userId);
      if (!presence || distanceInMeters(viewerPresence, presence) > radius.meters) return null;
      return {
        id: session.user.id,
        handle: session.user.handle,
        displayName: session.user.profile?.displayName ?? session.user.handle,
        profile: session.user.profile ? profileForAudience(session.user.profile, "PUBLIC") : null,
        latitude: presence.latitude,
        longitude: presence.longitude,
        precision: "exact" as const,
      };
    }))).filter((user): user is NonNullable<typeof user> => user !== null);

    return ok({ users, radiusMeters: radius.meters, loyaltyLabel: radius.loyaltyLabel });
  } catch (error) {
    return apiError(error);
  }
}

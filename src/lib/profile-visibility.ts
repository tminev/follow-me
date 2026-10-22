export const PROFILE_VISIBILITY_GROUPS = ["photo", "about", "location", "appearance", "intentions", "interests", "favorites", "professional", "lifestyle"] as const;

export type ProfileVisibilityGroup = typeof PROFILE_VISIBILITY_GROUPS[number];
export type ProfileVisibility = Record<ProfileVisibilityGroup, "PUBLIC" | "FRIENDS">;
export type ProfileAudience = "PUBLIC" | "FRIEND" | "SELF";

export const defaultProfileVisibility: ProfileVisibility = {
  photo: "PUBLIC", about: "PUBLIC", location: "PUBLIC", appearance: "PUBLIC", intentions: "PUBLIC",
  interests: "PUBLIC", favorites: "PUBLIC", professional: "FRIENDS", lifestyle: "PUBLIC",
};

export function parseProfileVisibility(raw?: string | null): ProfileVisibility {
  if (!raw) return { ...defaultProfileVisibility };
  try {
    const input = JSON.parse(raw) as Partial<ProfileVisibility>;
    return PROFILE_VISIBILITY_GROUPS.reduce((result, group) => ({
      ...result,
      [group]: input[group] === "FRIENDS" ? "FRIENDS" : "PUBLIC",
    }), {} as ProfileVisibility);
  } catch { return { ...defaultProfileVisibility }; }
}

export function profileForAudience<T extends Record<string, unknown>>(profile: T, audience: ProfileAudience) {
  const visibility = parseProfileVisibility(profile.profileVisibility as string | null | undefined);
  const canSee = (group: ProfileVisibilityGroup) => audience === "SELF" || visibility[group] === "PUBLIC" || audience === "FRIEND";
  return {
    ...profile,
    profileVisibility: undefined,
    avatarUrl: canSee("photo") ? profile.avatarUrl : null,
    bio: canSee("about") ? profile.bio : null,
    city: canSee("location") ? profile.city : null,
    neighborhood: canSee("location") ? profile.neighborhood : null,
    heightCm: canSee("appearance") ? profile.heightCm : null,
    hairColor: canSee("appearance") ? profile.hairColor : null,
    lookingFor: canSee("intentions") ? profile.lookingFor : null,
    interestsText: canSee("interests") ? profile.interestsText : null,
    favoriteMovie: canSee("favorites") ? profile.favoriteMovie : null,
    favoriteBook: canSee("favorites") ? profile.favoriteBook : null,
    occupation: canSee("professional") ? profile.occupation : null,
    education: canSee("professional") ? profile.education : null,
    languages: canSee("professional") ? profile.languages : null,
    weekendStyle: canSee("lifestyle") ? profile.weekendStyle : null,
    firstDateIdea: canSee("lifestyle") ? profile.firstDateIdea : null,
  };
}

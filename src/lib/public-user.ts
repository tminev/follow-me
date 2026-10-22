export const publicUserSelect = {
  id: true, handle: true,
  profile: { select: {
    displayName: true, bio: true, city: true, neighborhood: true, avatarUrl: true, profileVisibility: true,
    heightCm: true, hairColor: true, interestsText: true, lookingFor: true, favoriteMovie: true, favoriteBook: true,
    occupation: true, education: true, languages: true, weekendStyle: true, firstDateIdea: true,
  } },
  interests: { select: { interest: { select: { slug: true, title: true } } } },
} as const;


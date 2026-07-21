import type { UpdateProfilePayload } from "../types/app";

interface ExistingProfile {
  nickname?: string | null;
  bio?: string | null;
}

export const PROFILE_LIMITS = {
  nickname: 50,
  avatarUrl: 255,
  bio: 500,
} as const;

export function normalizeProfilePayload(values: UpdateProfilePayload): UpdateProfilePayload {
  const normalized: UpdateProfilePayload = {};
  if (values.nickname !== undefined) normalized.nickname = values.nickname.trim();
  if (values.avatarUrl !== undefined) normalized.avatarUrl = values.avatarUrl.trim();
  if (values.bio !== undefined) normalized.bio = values.bio.trim();
  return normalized;
}

export function hasProfileChanges(profile: ExistingProfile | null | undefined, values: UpdateProfilePayload) {
  return (values.nickname?.trim() ?? "") !== (profile?.nickname?.trim() ?? "")
    || (values.bio?.trim() ?? "") !== (profile?.bio?.trim() ?? "");
}

export async function loadProfileContentPages<T>(loadMine: () => Promise<T>, loadFavorites: () => Promise<T>) {
  const [mine, favorites] = await Promise.allSettled([
    Promise.resolve().then(loadMine),
    Promise.resolve().then(loadFavorites),
  ]);
  return { mine, favorites };
}

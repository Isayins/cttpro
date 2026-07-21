import type { UpdateProfilePayload } from "../types/app";

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

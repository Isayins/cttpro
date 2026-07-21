import type { UpdateProfilePayload } from "../types/app";

export const PROFILE_LIMITS = {
  nickname: 50,
  avatarUrl: 255,
  bio: 500,
} as const;

export function normalizeProfilePayload(values: UpdateProfilePayload): UpdateProfilePayload {
  return {
    nickname: values.nickname?.trim() ?? "",
    avatarUrl: values.avatarUrl?.trim() ?? "",
    bio: values.bio?.trim() ?? "",
  };
}

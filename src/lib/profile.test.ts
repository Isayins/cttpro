import { describe, expect, it } from "vitest";

import { PROFILE_LIMITS, normalizeProfilePayload } from "./profile";

describe("profile values", () => {
  it("keeps the UI limits aligned with persisted profile fields", () => {
    expect(PROFILE_LIMITS).toEqual({ nickname: 50, avatarUrl: 255, bio: 500 });
  });

  it("normalizes profile text before submission", () => {
    expect(
      normalizeProfilePayload({
        nickname: "  昵称  ",
        avatarUrl: "  /api/uploads/avatars/user-1.jpg  ",
        bio: "  简介  ",
      }),
    ).toEqual({
      nickname: "昵称",
      avatarUrl: "/api/uploads/avatars/user-1.jpg",
      bio: "简介",
    });
  });
});

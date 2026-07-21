import { describe, expect, it } from "vitest";

import { PROFILE_LIMITS, hasProfileChanges, loadProfileContentPages, normalizeProfilePayload } from "./profile";

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

  it("does not clear fields omitted by a partial profile form", () => {
    expect(normalizeProfilePayload({ nickname: "  昵称  ", bio: "  " })).toEqual({
      nickname: "昵称",
      bio: "",
    });
  });

  it("detects only meaningful public profile changes", () => {
    const profile = { nickname: "昵称", bio: null };
    expect(hasProfileChanges(profile, { nickname: " 昵称 ", bio: "" })).toBe(false);
    expect(hasProfileChanges(profile, { nickname: "新昵称", bio: "" })).toBe(true);
  });

  it("preserves an independent content result when the other request fails", async () => {
    const result = await loadProfileContentPages(
      async () => ({ total: 3 }),
      () => { throw new Error("favorites unavailable"); },
    );

    expect(result.mine).toEqual({ status: "fulfilled", value: { total: 3 } });
    expect(result.favorites.status).toBe("rejected");
  });
});

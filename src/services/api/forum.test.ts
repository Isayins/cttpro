import { afterEach, describe, expect, it, vi } from "vitest";

import { forumApi } from "./forum";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("forum API pagination", () => {
  it("passes requested pages and sizes for posts and replies", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return new Response("[]", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await forumApi.getPosts({ page: 2, size: 30 });
    await forumApi.getReplies(42, 2, 20);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/forum/posts?page=2&size=30",
      "/api/forum/posts/42/replies?page=2&size=20",
    ]);
  });
});

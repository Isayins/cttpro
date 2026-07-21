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

  it("preserves the total when requesting a post page", async () => {
    const response = {
      records: [{ id: 1, title: "最近帖子" }],
      total: 42,
      page: 1,
      size: 3,
    };
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(forumApi.getPostsPage({ mine: true, size: 3 })).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/forum/posts?page=1&size=3&mine=true",
      expect.anything(),
    );
  });
});

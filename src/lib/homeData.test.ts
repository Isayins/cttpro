import { describe, expect, it } from "vitest";

import type { DownloadResource, Post, SiteNotice } from "../types/app";
import { resolveHomeData } from "./homeData";

describe("resolveHomeData", () => {
  it("keeps successful sections when another request fails", () => {
    const notice = { id: 1 } as SiteNotice;
    const olderDownload = { id: 1, updateTime: "2026-07-01 10:00:00" } as DownloadResource;
    const newerDownload = { id: 2, updateTime: "2026-07-02 10:00:00" } as DownloadResource;

    expect(
      resolveHomeData([
        { status: "fulfilled", value: [notice] },
        { status: "rejected", reason: new Error("forum unavailable") },
        { status: "fulfilled", value: [olderDownload, newerDownload] },
      ]),
    ).toEqual({
      notices: [notice],
      recentPosts: [],
      recentDownloads: [newerDownload, olderDownload],
    });
  });

  it("limits recent posts to four", () => {
    const posts = Array.from({ length: 5 }, (_, index) => ({ id: index + 1 }) as Post);

    expect(
      resolveHomeData([
        { status: "fulfilled", value: [] },
        { status: "fulfilled", value: posts },
        { status: "fulfilled", value: [] },
      ]).recentPosts,
    ).toEqual(posts.slice(0, 4));
  });
});

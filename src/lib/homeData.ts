import type { DownloadResource, Post, SiteNotice } from "../types/app";

type HomeDataResults = [
  PromiseSettledResult<SiteNotice[]>,
  PromiseSettledResult<Post[]>,
  PromiseSettledResult<DownloadResource[]>,
];

export function resolveHomeData([notices, posts, downloads]: HomeDataResults) {
  const downloadItems = downloads.status === "fulfilled" ? downloads.value : [];

  return {
    notices: notices.status === "fulfilled" ? notices.value : [],
    recentPosts: posts.status === "fulfilled" ? posts.value.slice(0, 4) : [],
    recentDownloads: [...downloadItems]
      .sort(
        (left, right) =>
          new Date(right.updateTime ?? right.createTime ?? 0).getTime() -
          new Date(left.updateTime ?? left.createTime ?? 0).getTime(),
      )
      .slice(0, 4),
  };
}

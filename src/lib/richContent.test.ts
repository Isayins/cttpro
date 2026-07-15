import { describe, expect, it } from "vitest";

import { getImageMarkupUrl, getTextPreviewWithoutImageBlocks, isSafeImageUrl } from "./richContent";

describe("rich content image parsing", () => {
  it("keeps supporting uploaded image markup", () => {
    expect(getImageMarkupUrl("![图片](/uploads/forum-images/demo.webp)", { trim: true })).toBe("/uploads/forum-images/demo.webp");
  });

  it("detects a bare image url with query parameters", () => {
    const discordImageUrl =
      "https://cdn.discordapp.com/attachments/1519619835603058848/1520320604895711242/f40131f9-d3d8-40c9-a099-2a0032cf4ca2.png?ex=6a460a66&is=6a44b8e6&hm=353c085800d04916b6e1a14e4a838b9405ea00f45b92f7e0ae1cf9d34e1435be&";

    expect(getImageMarkupUrl(discordImageUrl, { trim: true })).toBe(discordImageUrl);
  });

  it("does not treat non-image web pages as image blocks", () => {
    expect(getImageMarkupUrl("https://example.com/topic/123", { trim: true })).toBeNull();
  });

  it("removes bare image urls from text previews", () => {
    expect(getTextPreviewWithoutImageBlocks("第一行\nhttps://cdn.example.com/demo.png?size=large\n最后一行", "[图片]")).toBe("第一行 最后一行");
  });

  it("allows local upload image paths without unsafe path segments", () => {
    expect(isSafeImageUrl("/uploads/forum-images/demo.webp")).toBe(true);
    expect(isSafeImageUrl("uploads/forum-images/demo.webp?size=large")).toBe(true);
  });

  it("rejects local upload image paths with parent directory segments", () => {
    expect(isSafeImageUrl("/uploads/../secret.png")).toBe(false);
    expect(isSafeImageUrl("/api/uploads/%2e%2e/secret.png")).toBe(false);
    expect(isSafeImageUrl("/uploads/forum-images\\secret.png")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  isAllowedDownloadResourceUrl,
  isAllowedImageResourceUrl,
  isAllowedWebTargetUrl,
} from "./urlValidation";

describe("url validation", () => {
  it("allows safe persisted image resources", () => {
    expect(isAllowedImageResourceUrl("")).toBe(true);
    expect(isAllowedImageResourceUrl("https://cdn.example.com/avatar.png")).toBe(true);
    expect(isAllowedImageResourceUrl("//cdn.example.com/avatar.png")).toBe(true);
    expect(isAllowedImageResourceUrl("/images/products/demo.png")).toBe(true);
    expect(isAllowedImageResourceUrl("uploads/avatar.webp")).toBe(true);
  });

  it("rejects unsafe or unsupported persisted image resources", () => {
    expect(isAllowedImageResourceUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedImageResourceUrl("data:image/png;base64,xxx")).toBe(false);
    expect(isAllowedImageResourceUrl("/downloads/file.zip")).toBe(false);
    expect(isAllowedImageResourceUrl("/images/../secret.png")).toBe(false);
  });

  it("allows download resources from web URLs and site paths", () => {
    expect(isAllowedDownloadResourceUrl("https://example.com/file.zip")).toBe(true);
    expect(isAllowedDownloadResourceUrl("//cdn.example.com/file.zip")).toBe(true);
    expect(isAllowedDownloadResourceUrl("/uploads/file.zip")).toBe(true);
    expect(isAllowedDownloadResourceUrl("downloads/file.zip?version=1")).toBe(true);
  });

  it("rejects unsafe download resource URLs", () => {
    expect(isAllowedDownloadResourceUrl("")).toBe(false);
    expect(isAllowedDownloadResourceUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedDownloadResourceUrl("mailto:test@example.com")).toBe(false);
    expect(isAllowedDownloadResourceUrl("../secret.zip")).toBe(false);
    expect(isAllowedDownloadResourceUrl("/uploads/../secret.zip")).toBe(false);
  });

  it("allows QR targets only as http(s) URLs or absolute site paths", () => {
    expect(isAllowedWebTargetUrl("https://example.com/page")).toBe(true);
    expect(isAllowedWebTargetUrl("/downloads")).toBe(true);
    expect(isAllowedWebTargetUrl("downloads")).toBe(false);
    expect(isAllowedWebTargetUrl("//example.com/page")).toBe(false);
    expect(isAllowedWebTargetUrl("javascript:alert(1)")).toBe(false);
  });
});


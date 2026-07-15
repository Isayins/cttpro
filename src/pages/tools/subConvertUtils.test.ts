import { describe, expect, it } from "vitest";

import {
  buildClientImportLinks,
  buildShortLinkUrl,
  buildSubConvertResult,
  buildSubscriptionSourceStat,
  classifySubscriptionSource,
  defaultSubConvertBackend,
} from "./subConvertUtils";

const baseOptions = {
  input: "https://example.com/sub\nvmess://demo\nhttps://example.com/sub",
  target: "clash" as const,
  backendUrl: defaultSubConvertBackend,
  outputName: "IDNCAR",
  configUrl: "",
  includeFilter: "HK|SG",
  excludeFilter: "倍率|官网",
  shortLinkTemplate: "https://short.example.com/short?url={url}",
  emoji: true,
  udp: true,
  tfo: false,
  skipCertVerify: false,
  appendType: true,
  sort: true,
};

describe("sub convert utils", () => {
  it("classifies subscription and node source lines", () => {
    expect(classifySubscriptionSource("https://example.com/sub")).toBe("subscription");
    expect(classifySubscriptionSource("trojan://password@example.com:443")).toBe("node");
    expect(classifySubscriptionSource("not a url")).toBe("unknown");
  });

  it("builds source stats with duplicate counts", () => {
    expect(buildSubscriptionSourceStat(baseOptions.input)).toEqual({
      total: 3,
      unique: 2,
      subscriptions: 1,
      nodes: 1,
      unknown: 0,
      duplicates: 1,
    });
  });

  it("generates SubConverter URL, short-link request and import links", () => {
    const result = buildSubConvertResult(baseOptions);
    const parsed = new URL(result.convertedUrl);

    expect(parsed.origin + parsed.pathname).toBe(defaultSubConvertBackend);
    expect(parsed.searchParams.get("target")).toBe("clash");
    expect(parsed.searchParams.get("url")).toBe("https://example.com/sub|vmess://demo");
    expect(parsed.searchParams.get("include")).toBe("HK|SG");
    expect(parsed.searchParams.get("exclude")).toBe("倍率|官网");
    expect(parsed.searchParams.get("append_type")).toBe("true");
    expect(result.shortLinkUrl).toContain(encodeURIComponent(result.convertedUrl));
    expect(result.output).toContain("目标客户端：Clash");
    expect(result.clientLinks.map((item) => item.label)).toContain("Shadowrocket");
  });

  it("supports short-link templates without explicit placeholder", () => {
    const convertedUrl = "https://sub.example.com/sub?target=clash";

    expect(buildShortLinkUrl(convertedUrl, "https://short.example.com/api")).toBe(
      "https://short.example.com/api?url=https%3A%2F%2Fsub.example.com%2Fsub%3Ftarget%3Dclash",
    );
  });

  it("builds common client import links", () => {
    const links = buildClientImportLinks("https://example.com/sub?target=clash", "Demo");

    expect(links.find((item) => item.label === "Clash")?.value).toContain("clash://install-config");
    expect(links.find((item) => item.label === "Sing-Box")?.value).toContain("sing-box://");
  });
});

import { describe, expect, it } from "vitest";

import {
  buildRedirectFromLocation,
  defaultAuthenticatedPath,
  resolveRedirectPageTitle,
  resolveRedirectPath,
} from "./authRedirect";
import { routePaths } from "./routeAccess";

describe("auth redirects", () => {
  it("preserves pathname, query and hash when building a return target", () => {
    expect(
      buildRedirectFromLocation({
        pathname: routePaths.forum,
        search: "?post=123",
        hash: "#replies",
      }),
    ).toBe("/forum?post=123#replies");
  });

  it("keeps safe internal redirect targets", () => {
    expect(resolveRedirectPath("/forum?post=123#replies")).toBe("/forum?post=123#replies");
    expect(resolveRedirectPath(" /forum ")).toBe(routePaths.forum);
  });

  it("falls back for external, empty or login redirect targets", () => {
    expect(resolveRedirectPath(undefined)).toBe(defaultAuthenticatedPath);
    expect(resolveRedirectPath("")).toBe(defaultAuthenticatedPath);
    expect(resolveRedirectPath("https://example.com/products")).toBe(defaultAuthenticatedPath);
    expect(resolveRedirectPath("//example.com/products")).toBe(defaultAuthenticatedPath);
    expect(resolveRedirectPath(`${routePaths.login}?from=/products`)).toBe(defaultAuthenticatedPath);
  });

  it("resolves friendly titles from sanitized redirect paths", () => {
    expect(resolveRedirectPageTitle("/forum?post=123#replies")).toBe("论坛交流");
    expect(resolveRedirectPageTitle("/products?sku=vip#detail")).toBe("商品中心");
    expect(resolveRedirectPageTitle(routePaths.adminQrCodes)).toBe("二维码管理");
    expect(resolveRedirectPageTitle("/unknown")).toBe("学习记录");
  });
});

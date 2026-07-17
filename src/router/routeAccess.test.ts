import { describe, expect, it } from "vitest";

import {
  accountMenuActions,
  adminNavItems,
  authenticatedNavItems,
  drawerShortcutActions,
  primaryNavItems,
  type HeaderAction,
  type NavItem,
} from "../components/headerNavigation";
import { adminRoutePaths, protectedRoutePaths, publicRoutePaths, routePaths } from "./routeAccess";

const publicRouteSet = new Set<string>(publicRoutePaths);
const protectedRouteSet = new Set<string>(protectedRoutePaths);
const adminRouteSet = new Set<string>(adminRoutePaths);

function withoutHash(to: string) {
  return to.split("#")[0] || routePaths.home;
}

function expectNavItemMatchesRouteAccess(item: NavItem) {
  const path = withoutHash(item.to);

  if (item.adminOnly) {
    expect(adminRouteSet.has(path), `${item.label} should point to an admin route`).toBe(true);
    return;
  }

  if (item.requiresAuth) {
    expect(protectedRouteSet.has(path), `${item.label} should point to a protected route`).toBe(true);
    return;
  }

  expect(publicRouteSet.has(path), `${item.label} should point to a public route`).toBe(true);
}

function expectActionMatchesRouteAccess(action: HeaderAction) {
  const path = withoutHash(action.to);
  const routeSet = action.adminOnly ? adminRouteSet : protectedRouteSet;

  expect(routeSet.has(path), `${action.label} should point to an authenticated route`).toBe(true);
}

describe("route access metadata", () => {
  it("does not expose removed pages", () => {
    expect(Object.values(routePaths)).not.toContain("/stock");
    expect(Object.values(routePaths)).not.toContain("/admin/demos");
    expect(Object.values(routePaths)).not.toContain("/admin/demos/enterprise");
    expect([...primaryNavItems, ...authenticatedNavItems, ...adminNavItems].map((item) => item.to)).not.toContain("/stock");
    expect([...accountMenuActions, ...drawerShortcutActions].map((item) => item.to)).not.toContain("/stock");
  });

  it("keeps route groups disjoint", () => {
    for (const path of publicRoutePaths) {
      expect(protectedRouteSet.has(path), `${path} should not be both public and protected`).toBe(false);
      expect(adminRouteSet.has(path), `${path} should not be both public and admin-only`).toBe(false);
    }

    for (const path of protectedRoutePaths) {
      expect(adminRouteSet.has(path), `${path} should not be both protected and admin-only`).toBe(false);
    }
  });

  it("keeps the product center behind login", () => {
    expect(publicRouteSet.has(routePaths.products)).toBe(false);
    expect(protectedRouteSet.has(routePaths.products)).toBe(true);
    expect(adminRouteSet.has(routePaths.products)).toBe(false);
  });

  it("keeps visible nav permissions aligned with route groups", () => {
    for (const item of [...primaryNavItems, ...authenticatedNavItems, ...adminNavItems]) {
      expectNavItemMatchesRouteAccess(item);
    }
  });

  it("keeps account and drawer shortcuts behind authenticated routes", () => {
    for (const action of [...accountMenuActions, ...drawerShortcutActions]) {
      expectActionMatchesRouteAccess(action);
    }
  });
});

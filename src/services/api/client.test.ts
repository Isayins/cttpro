import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_SESSION_EXPIRED_EVENT, clearAuthToken, getAuthToken, setAuthToken } from "../authToken";
import { apiRequest, buildApiRequestUrl, isApiRequestError } from "./client";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

function stubBrowserWindow() {
  const events = new EventTarget();
  const storage = new Map<string, string>();

  vi.stubGlobal("window", {
    location: { origin: "http://localhost" },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  });
}

describe("api client", () => {
  it("builds site-relative API URLs when no API base URL is configured", () => {
    expect(buildApiRequestUrl("api/auth/me")).toBe("/api/auth/me");
    expect(buildApiRequestUrl("/api/products?page=1#top")).toBe("/api/products?page=1#top");
  });

  it("serializes JSON request bodies and sets content type", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiRequest<{ ok: boolean }>("/api/demo", {
        method: "POST",
        body: { name: "IDNCAR" },
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const init = call?.[1];
    expect(init).toBeDefined();
    if (!init) {
      throw new Error("request init missing");
    }
    expect(init.body).toBe(JSON.stringify({ name: "IDNCAR" }));
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
  });

  it("throws status-aware API errors for failed HTTP responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: "登录已失效，请重新登录" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
      ),
    );

    try {
      await apiRequest("/api/auth/me");
      throw new Error("request should have failed");
    } catch (error) {
      expect(isApiRequestError(error)).toBe(true);
      if (isApiRequestError(error)) {
        expect(error.message).toBe("登录已失效，请重新登录");
        expect(error.status).toBe(401);
        expect(error.statusText).toBe("Unauthorized");
        expect(error.responseBody).toEqual({ message: "登录已失效，请重新登录" });
      }
    }
  });

  it("uses localized fallback messages when failed responses have no body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 403, statusText: "Forbidden" })),
    );

    try {
      await apiRequest("/api/admin/users");
      throw new Error("request should have failed");
    } catch (error) {
      expect(isApiRequestError(error)).toBe(true);
      if (isApiRequestError(error)) {
        expect(error.message).toBe("没有权限执行此操作");
        expect(error.status).toBe(403);
        expect(error.responseBody).toBeUndefined();
      }
    }
  });

  it("clears stored auth and emits a session-expired event for authenticated 401 responses", async () => {
    stubBrowserWindow();
    setAuthToken("stale-token");

    const expiredEvents: Array<{ status: number; message: string }> = [];
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, (event) => {
      expiredEvents.push((event as CustomEvent<{ status: number; message: string }>).detail);
    });

    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return new Response("", {
        status: 401,
        statusText: "Unauthorized",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      await apiRequest("/api/auth/me", { authMode: "required" });
      throw new Error("request should have failed");
    } catch (error) {
      expect(isApiRequestError(error)).toBe(true);
    }

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer stale-token");
    expect(getAuthToken()).toBeNull();
    expect(expiredEvents).toEqual([{ status: 401, message: "登录已失效，请重新登录" }]);
  });
});

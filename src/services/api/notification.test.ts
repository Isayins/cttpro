import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAuthToken, setAuthToken } from "../authToken";
import { notificationApi } from "./notification";

afterEach(() => {
  clearAuthToken();
  vi.unstubAllGlobals();
});

describe("notification API pagination", () => {
  it("passes the oldest loaded notification as the history cursor", async () => {
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      void args;
      return new Response("[]", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("test-token");

    await notificationApi.getNotifications(20, 99);
    await notificationApi.getUnreadCount();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/notifications?limit=20&beforeId=99",
      "/api/notifications/unread-count",
    ]);
  });
});

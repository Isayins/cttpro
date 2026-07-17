import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const VISITOR_ID_KEY = "idncar_visitor_id";
const SESSION_ID_KEY = "idncar_session_id";
const PREVIOUS_PATH_KEY = "idncar_previous_path";

type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type WindowWithIdleCallback = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: (deadline: IdleDeadline) => void, options?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

const routeTitleMap: Record<string, string> = {
  "/": "首页",
  "/about": "关于我们",
  "/downloads": "下载中心",
  "/tools": "实用工具",
  "/randomtalk": "随便聊聊",
  "/verify": "下载验证",
  "/login": "登录注册",
  "/forum": "论坛交流",
  "/profile": "个人资料",
  "/admin": "管理后台",
  "/admin/qrcodes": "二维码管理",
  "/q": "品牌二维码",
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function safeGetStorageItem(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorageItem(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // Analytics should never break browsing when storage is unavailable.
  }
}

function getOrCreateStorageId(key: string, prefix: string, storage: Storage) {
  const existing = safeGetStorageItem(storage, key);
  if (existing) {
    return existing;
  }
  const created = createId(prefix);
  safeSetStorageItem(storage, key, created);
  return created;
}

function resolvePageTitle(pathname: string) {
  if (routeTitleMap[pathname]) {
    return routeTitleMap[pathname];
  }

  const matchedPrefix = Object.keys(routeTitleMap).find((key) => key !== "/" && pathname.startsWith(key));
  if (matchedPrefix) {
    return routeTitleMap[matchedPrefix];
  }

  return document.title || pathname;
}

function resolveDeviceType(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet")) {
    return "TABLET";
  }
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    return "MOBILE";
  }
  return "DESKTOP";
}

function scheduleIdleTask(callback: () => void) {
  const idleWindow = window as WindowWithIdleCallback;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 2500 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(callback, 600);
  return () => window.clearTimeout(handle);
}

export default function RouteAnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    const currentPath = `${location.pathname}${location.search}`;
    const lastTrackedAt = Number(safeGetStorageItem(sessionStorage, `idncar_track_${currentPath}`) ?? "0");
    const now = Date.now();

    if (now - lastTrackedAt < 1200) {
      return;
    }

    const visitorId = getOrCreateStorageId(VISITOR_ID_KEY, "visitor", localStorage);
    const sessionId = getOrCreateStorageId(SESSION_ID_KEY, "session", sessionStorage);
    const previousPath = safeGetStorageItem(sessionStorage, PREVIOUS_PATH_KEY);
    const referrer = previousPath ? `${window.location.origin}${previousPath}` : document.referrer;
    const userAgent = navigator.userAgent;

    safeSetStorageItem(sessionStorage, `idncar_track_${currentPath}`, String(now));
    safeSetStorageItem(sessionStorage, PREVIOUS_PATH_KEY, currentPath);

    return scheduleIdleTask(() => {
      void import("../services/api/analytics")
        .then(({ analyticsApi }) =>
          analyticsApi.trackVisit({
            path: location.pathname,
            pageTitle: resolvePageTitle(location.pathname),
            visitorId,
            sessionId,
            referrer,
            source: previousPath ? "internal" : undefined,
            userAgent,
            deviceType: resolveDeviceType(userAgent),
          }),
        )
        .catch(() => {
          // Ignore statistics failures so they never affect browsing.
        });
    });
  }, [location.pathname, location.search]);

  return null;
}

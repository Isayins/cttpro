import { API_BASE_URL, downloadApi } from "./api";
import type { DownloadResource } from "../types/app";

export type DownloadItem = {
  id: number;
  title: string;
  version?: string | null;
  changelog?: string | null;
  url: string;
  icon?: string | null;
  locked?: boolean;
  category?: string | null;
  fileSize?: string | null;
  checksumSha256?: string | null;
  downloadCount?: number | null;
  updateTime?: string | null;
  sortOrder?: number | null;
};

function mapDownload(item: DownloadResource): DownloadItem {
  return {
    id: item.id,
    title: item.title,
    version: item.version,
    changelog: item.changelog,
    url: item.url,
    icon: item.icon,
    locked: item.locked,
    category: item.category,
    fileSize: item.fileSize,
    checksumSha256: item.checksumSha256,
    downloadCount: item.downloadCount,
    updateTime: item.updateTime ?? item.createTime,
    sortOrder: item.sortOrder,
  };
}

export async function getDownloads(): Promise<DownloadItem[]> {
  const items = await downloadApi.getDownloads();
  return items.map(mapDownload);
}

export async function trackDownload(downloadId: number): Promise<void> {
  await downloadApi.trackDownload(downloadId);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const fixed = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(fixed)} ${units[unitIndex]}`;
}

function getBrowserOrigin() {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

function getApiBaseUrl() {
  return API_BASE_URL || getBrowserOrigin();
}

function getApiOrigin() {
  return new URL(getApiBaseUrl(), getBrowserOrigin()).origin;
}

function buildApiUrl(path: string) {
  return new URL(path, getApiBaseUrl()).toString();
}

export function resolveDownloadUrl(url: string) {
  if (!url) {
    return "";
  }

  if (url.startsWith("/uploads/")) {
    const upgradedPath = `/api${url}`;
    return new URL(upgradedPath, `${getApiOrigin()}/`).toString();
  }

  if (url.startsWith("uploads/")) {
    const upgradedPath = `/api/${url}`;
    return new URL(upgradedPath, `${getApiOrigin()}/`).toString();
  }

  if (/^(https?:|data:|blob:|mailto:|tel:)/i.test(url)) {
    return url;
  }

  if (url.startsWith("//")) {
    return `${typeof window === "undefined" ? "https:" : window.location.protocol}${url}`;
  }

  return new URL(url, `${getApiOrigin()}/`).toString();
}

async function detectFileSizeFromUrl(url: string): Promise<string | null> {
  const target = resolveDownloadUrl(url);
  if (!/^https?:\/\//i.test(target)) {
    return null;
  }

  try {
    const headResponse = await fetch(target, {
      method: "HEAD",
      cache: "no-store",
      redirect: "follow",
    });
    const contentLength = Number(headResponse.headers.get("content-length"));
    const formatted = formatFileSize(contentLength);
    if (formatted) {
      return formatted;
    }
  } catch {
    // Ignore and fallback to ranged GET below.
  }

  try {
    const rangeResponse = await fetch(target, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      cache: "no-store",
      redirect: "follow",
    });
    const contentRange = rangeResponse.headers.get("content-range");
    const matched = contentRange?.match(/\/(\d+)\s*$/);
    if (matched?.[1]) {
      return formatFileSize(Number(matched[1]));
    }
    const contentLength = Number(rangeResponse.headers.get("content-length"));
    return formatFileSize(contentLength);
  } catch {
    return null;
  }
}

export async function hydrateMissingFileSizes(items: DownloadItem[]): Promise<DownloadItem[]> {
  if (!items.length) {
    return items;
  }

  const nextItems = [...items];
  for (let i = 0; i < nextItems.length; i += 1) {
    const item = nextItems[i];
    if (item.fileSize || !item.url) {
      continue;
    }

    const detected = await detectFileSizeFromUrl(item.url);
    if (detected) {
      nextItems[i] = { ...item, fileSize: detected };
    }
  }

  return nextItems;
}

export function buildVerifyPageUrl(resource: string, fileName?: string) {
  const verifyUrl = new URL("/verify", getBrowserOrigin());
  verifyUrl.searchParams.set("resource", resource);
  if (fileName && fileName.trim()) {
    verifyUrl.searchParams.set("fileName", fileName.trim());
  }
  return verifyUrl.toString();
}

export function buildProtectedDownloadUrl(downloadToken: string) {
  const downloadUrl = new URL("/api/download", getApiBaseUrl());
  downloadUrl.searchParams.set("token", downloadToken);
  return downloadUrl.toString();
}

async function fetchJson(input: RequestInfo, init?: RequestInit, timeout = 10000) {
  const controller = new AbortController();
  const timerId = window.setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const text = await response.text();
    let json: unknown = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new Error("服务器返回的数据格式不正确");
    }

    if (!response.ok) {
      const message =
        json && typeof json === "object" && ("message" in json || "error" in json)
          ? String((json as Record<string, unknown>).message ?? (json as Record<string, unknown>).error)
          : response.statusText || "请求失败";
      throw new Error(message);
    }

    return json;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("请求超时，请稍后重试");
    }
    throw error;
  } finally {
    window.clearTimeout(timerId);
  }
}

export async function getCaptcha(): Promise<{ captchaId: string; image: string }> {
  return fetchJson(buildApiUrl("/api/captcha"), { cache: "no-store" }, 8000) as Promise<{
    captchaId: string;
    image: string;
  }>;
}

export async function verifyCaptcha(
  captchaId: string,
  answer: string,
  resource: string,
  fileName?: string,
): Promise<{ ok?: boolean; downloadToken?: string; message?: string }> {
  return fetchJson(
    buildApiUrl("/api/verify_captcha"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ captchaId, answer, resource, fileName }),
    },
    10000,
  ) as Promise<{ ok?: boolean; downloadToken?: string; message?: string }>;
}

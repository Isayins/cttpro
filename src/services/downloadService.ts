import { apiRequest, buildApiRequestUrl } from "./api/client";
import { downloadApi } from "./api/download";
import type { DownloadResource } from "../types/app";

export type DownloadItem = {
  id: number;
  title: string;
  version?: string | null;
  changelog?: string | null;
  url: string;
  icon?: string | null;
  locked?: boolean;
  passwordProtected?: boolean;
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
    passwordProtected: item.passwordProtected,
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

function getApiOrigin() {
  return new URL(buildApiRequestUrl("/"), getBrowserOrigin()).origin;
}

function buildAbsoluteApiUrl(path: string) {
  return new URL(buildApiRequestUrl(path), getBrowserOrigin()).toString();
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
  const target = buildDirectDownloadUrl(url);
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
    if (
      item.fileSize ||
      !item.url ||
      item.locked ||
      item.passwordProtected
    ) {
      continue;
    }

    const detected = await detectFileSizeFromUrl(item.url);
    if (detected) {
      nextItems[i] = { ...item, fileSize: detected };
    }
  }

  return nextItems;
}

export function buildVerifyPageUrl(
  resource: string,
  fileName?: string,
  requirements?: { captchaRequired?: boolean; passwordRequired?: boolean },
) {
  const verifyUrl = new URL("/verify", getBrowserOrigin());
  verifyUrl.searchParams.set("resource", resource);
  if (fileName && fileName.trim()) {
    verifyUrl.searchParams.set("fileName", fileName.trim());
  }
  verifyUrl.searchParams.set(
    "captcha",
    requirements?.captchaRequired === false ? "0" : "1",
  );
  if (requirements?.passwordRequired) {
    verifyUrl.searchParams.set("password", "1");
  }
  return verifyUrl.toString();
}

export function buildProtectedDownloadUrl(downloadToken: string) {
  const downloadUrl = new URL(buildAbsoluteApiUrl("/api/download/"));
  downloadUrl.searchParams.set("token", downloadToken);
  return downloadUrl.toString();
}

export function buildDirectDownloadUrl(resource: string, fileName?: string) {
  const downloadUrl = new URL(buildAbsoluteApiUrl("/api/download/direct/"));
  downloadUrl.searchParams.set("resource", resource);
  if (fileName && fileName.trim()) {
    downloadUrl.searchParams.set("fileName", fileName.trim());
  }
  return downloadUrl.toString();
}

export async function getCaptcha(): Promise<{ captchaId: string; image: string }> {
  return apiRequest<{ captchaId: string; image: string }>("/api/download/captcha", {
    cache: "no-store",
    timeoutMs: 8000,
  });
}

export async function verifyCaptcha(
  captchaId: string,
  answer: string,
  resource: string,
  fileName?: string,
  password?: string,
): Promise<{ ok?: boolean; downloadToken?: string; message?: string }> {
  return apiRequest<{ ok?: boolean; downloadToken?: string; message?: string }>("/api/download/verify", {
    method: "POST",
    body: { captchaId, answer, resource, fileName, password },
    timeoutMs: 10000,
  });
}

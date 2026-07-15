import { clearAuthToken, getAuthToken, notifyAuthSessionExpired } from "../authToken";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const DEFAULT_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 15000);

export type AuthMode = "none" | "required" | "optional";

export interface RequestOptions extends Omit<RequestInit, "body"> {
  authMode?: AuthMode;
  body?: unknown;
  timeoutMs?: number;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly responseBody: unknown;

  constructor(message: string, status: number, statusText: string, responseBody: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.statusText = statusText;
    this.responseBody = responseBody;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

function getBrowserOrigin() {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

export function buildApiRequestUrl(path: string) {
  const normalizedInput = path.startsWith("/") ? path : `/${path}`;
  const pathUrl = new URL(normalizedInput, getBrowserOrigin());
  const normalizedPath = pathUrl.pathname;
  const normalizedBase = API_BASE_URL.trim().replace(/\/+$/, "");
  if (!normalizedBase) {
    return `${normalizedPath}${pathUrl.search}${pathUrl.hash}`;
  }

  const baseUrl = new URL(normalizedBase, getBrowserOrigin());
  const basePath = baseUrl.pathname.replace(/\/+$/, "");
  if (basePath && (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`))) {
    baseUrl.pathname = normalizedPath;
  } else {
    baseUrl.pathname = `${basePath}${normalizedPath}`.replace(/\/{2,}/g, "/");
  }
  baseUrl.search = pathUrl.search;
  baseUrl.hash = pathUrl.hash;
  return baseUrl.toString();
}

function createTimeoutError() {
  return new DOMException("Request timed out", "TimeoutError");
}

function parseErrorResponseBody(text: string) {
  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function resolveErrorMessage(responseBody: unknown, fallback: string) {
  if (responseBody && typeof responseBody === "object" && !Array.isArray(responseBody)) {
    const errorData = responseBody as { detail?: unknown; message?: unknown; error?: unknown };
    if (typeof errorData.detail === "string" && errorData.detail) {
      return errorData.detail;
    }
    if (typeof errorData.message === "string" && errorData.message) {
      return errorData.message;
    }
    if (typeof errorData.error === "string" && errorData.error) {
      return errorData.error;
    }
  }

  if (typeof responseBody === "string" && responseBody) {
    return responseBody;
  }

  return fallback;
}

function resolveStatusFallbackMessage(status: number, statusText: string) {
  const statusMessageMap: Record<number, string> = {
    400: "请求参数有误，请检查后重试",
    401: "登录已失效，请重新登录",
    403: "没有权限执行此操作",
    404: "请求的资源不存在",
    409: "当前操作存在冲突，请刷新后重试",
    429: "操作太频繁，请稍后再试",
    500: "服务端异常，请稍后重试",
    502: "服务暂时不可用，请稍后重试",
    503: "服务暂时不可用，请稍后重试",
    504: "服务响应超时，请稍后重试",
  };

  return statusMessageMap[status] ?? (statusText || "请求失败");
}

function shouldExpireAuthSession(status: number, authMode: AuthMode, token: string | null) {
  return status === 401 && token !== null && authMode !== "none";
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authMode = "none", headers, body, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, signal, ...rest } = options;
  const token = getAuthToken();

  if (authMode === "required" && !token) {
    throw new Error("请先登录");
  }

  const requestHeaders = new Headers(headers ?? {});
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if ((authMode === "required" || authMode === "optional") && token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const abortFromSignal = () => controller.abort(signal?.reason);

  if (signal?.aborted) {
    controller.abort(signal.reason);
  } else {
    signal?.addEventListener("abort", abortFromSignal, { once: true });
  }

  if (timeoutMs > 0) {
    timeoutHandle = globalThis.setTimeout(() => controller.abort(createTimeoutError()), timeoutMs);
  }

  let response: Response;
  try {
    response = await fetch(buildApiRequestUrl(path), {
      ...rest,
      headers: requestHeaders,
      signal: controller.signal,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch (error) {
    if (controller.signal.reason instanceof DOMException && controller.signal.reason.name === "TimeoutError") {
      throw new Error("请求超时，请稍后重试");
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error(error instanceof Error && error.message ? error.message : "网络连接失败，请稍后重试");
  } finally {
    if (timeoutHandle !== null) {
      globalThis.clearTimeout(timeoutHandle);
    }
    signal?.removeEventListener("abort", abortFromSignal);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();

  if (!response.ok) {
    const responseBody = parseErrorResponseBody(text);
    const fallbackMessage = resolveStatusFallbackMessage(response.status, response.statusText);
    const errorMessage = resolveErrorMessage(responseBody, fallbackMessage);
    if (shouldExpireAuthSession(response.status, authMode, token)) {
      clearAuthToken();
      notifyAuthSessionExpired({ status: response.status, message: errorMessage });
    }
    throw new ApiRequestError(errorMessage, response.status, response.statusText, responseBody);
  }

  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("服务端返回了无法解析的响应");
  }
}

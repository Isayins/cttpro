export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export type AuthMode = "none" | "required" | "optional";

export interface RequestOptions extends Omit<RequestInit, "body"> {
  authMode?: AuthMode;
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authMode = "none", headers, body, ...rest } = options;
  const token = localStorage.getItem("token");

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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: requestHeaders,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMessage = "请求失败";
    try {
      const errorData = (await response.json()) as { message?: string };
      if (errorData?.message) {
        errorMessage = errorData.message;
      }
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

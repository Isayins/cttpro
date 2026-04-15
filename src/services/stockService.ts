import type { MarketSnapshot } from "../types/type";


const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8735";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : {};

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && ("detail" in data || "message" in data)
        ? String((data as any).detail ?? (data as any).message)
        : text) || `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export function fetchState() {
  return request<MarketSnapshot>("/api/state");
}

export function manualBuy() {
  return request<{ ok: boolean; message: string }>("/api/action/buy", {
    method: "POST",
  });
}

export function manualSell() {
  return request<{ ok: boolean; message: string }>("/api/action/sell", {
    method: "POST",
  });
}

export function startAutomation() {
  return request<{ ok: boolean; message: string }>("/api/automation/start", {
    method: "POST",
  });
}

export function stopAutomation() {
  return request<{ ok: boolean; message: string }>("/api/automation/stop", {
    method: "POST",
  });
}

export function getWsUrl() {
  const base = API_BASE.replace(/^http/, "ws");
  return `${base}/ws`;
}
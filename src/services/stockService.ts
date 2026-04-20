import type { MarketSnapshot, StockItem } from "../types/type";
import { API_BASE_URL } from "./api";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? API_BASE_URL;

type ErrorResponse = {
  detail?: string;
  message?: string;
  raw?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem("token");
  const headers = new Headers(init?.headers ?? {});

  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const text = await res.text();
  const data = text ? safeJsonParse(text) : {};

  if (!res.ok) {
    const payload = data && typeof data === "object" ? (data as ErrorResponse) : null;
    const message =
      (payload && (payload.detail || payload.message)
        ? String(payload.detail ?? payload.message)
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

export function fetchState(symbol?: string, limit?: number) {
  const params = new URLSearchParams();
  if (symbol) {
    params.set("symbol", symbol);
  }
  if (limit) {
    params.set("limit", String(limit));
  }
  const query = params.toString();
  return request<MarketSnapshot>(`/api/quant/state${query ? `?${query}` : ""}`);
}

export function fetchStocks() {
  return request<StockItem[]>("/api/quant/stocks");
}

export function manualBuy() {
  return request<{ ok: boolean; message: string }>("/api/quant/action/buy", {
    method: "POST",
  });
}

export function manualSell() {
  return request<{ ok: boolean; message: string }>("/api/quant/action/sell", {
    method: "POST",
  });
}

export function startAutomation() {
  return request<{ ok: boolean; message: string }>("/api/quant/automation/start", {
    method: "POST",
  });
}

export function stopAutomation() {
  return request<{ ok: boolean; message: string }>("/api/quant/automation/stop", {
    method: "POST",
  });
}

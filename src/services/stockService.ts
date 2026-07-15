import type {
  DatabaseSummary,
  MarketSnapshot,
  ScreenerJobSnapshot,
  ScreenerQueryOptions,
  StockItem,
} from "../types/type";
import { apiRequest } from "./api/client";

const STOCKS_CACHE_KEY = "quant.stock.list.cache.v1";
const STOCKS_CACHE_TTL_MS = 1000 * 60 * 60 * 8;
const DATABASE_CACHE_KEY_PREFIX = "quant.stock.database.cache.v1";
const DATABASE_CACHE_TTL_MS = 1000 * 60 * 30;

type StocksCachePayload = {
  updatedAt: number;
  items: StockItem[];
};

type DatabaseCachePayload = {
  updatedAt: number;
  summary: DatabaseSummary;
};

function isStockItem(value: unknown): value is StockItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StockItem>;
  return typeof candidate.symbol === "string" && typeof candidate.name === "string";
}

function readStocksCachePayload() {
  try {
    const raw = localStorage.getItem(STOCKS_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StocksCachePayload>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.updatedAt !== "number" || !Array.isArray(parsed.items)) {
      return null;
    }

    const items = parsed.items.filter(isStockItem);
    if (items.length === 0) {
      return null;
    }

    return {
      updatedAt: parsed.updatedAt,
      items,
    };
  } catch {
    return null;
  }
}

export function getCachedStocks(maxAgeMs = STOCKS_CACHE_TTL_MS) {
  const payload = readStocksCachePayload();
  if (!payload) {
    return null;
  }
  if (Date.now() - payload.updatedAt > maxAgeMs) {
    return null;
  }
  return payload.items;
}

export function cacheStocks(items: StockItem[]) {
  try {
    const payload: StocksCachePayload = {
      updatedAt: Date.now(),
      items,
    };
    localStorage.setItem(STOCKS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore cache failures and keep the network path working.
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
  params.set("include_database", "false");
  const query = params.toString();
  return apiRequest<MarketSnapshot>(`/api/quant/state${query ? `?${query}` : ""}`, {
    authMode: "optional",
  });
}

function buildDatabaseCacheKey(symbol: string) {
  return `${DATABASE_CACHE_KEY_PREFIX}.${symbol}`;
}

function readDatabaseCache(symbol: string, maxAgeMs = DATABASE_CACHE_TTL_MS) {
  try {
    const raw = sessionStorage.getItem(buildDatabaseCacheKey(symbol));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<DatabaseCachePayload>;
    if (!parsed || typeof parsed.updatedAt !== "number" || !parsed.summary) {
      return null;
    }
    if (Date.now() - parsed.updatedAt > maxAgeMs) {
      return null;
    }
    return parsed.summary;
  } catch {
    return null;
  }
}

function writeDatabaseCache(symbol: string, summary: DatabaseSummary) {
  try {
    sessionStorage.setItem(
      buildDatabaseCacheKey(symbol),
      JSON.stringify({
        updatedAt: Date.now(),
        summary,
      } satisfies DatabaseCachePayload)
    );
  } catch {
    // Ignore cache failures and keep the network path working.
  }
}

export async function fetchDatabaseSummary(symbol?: string) {
  if (!symbol) {
    return null;
  }

  const cached = readDatabaseCache(symbol);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams();
  params.set("symbol", symbol);
  const summary = await apiRequest<DatabaseSummary>(`/api/quant/database?${params.toString()}`, {
    authMode: "optional",
  });
  writeDatabaseCache(symbol, summary);
  return summary;
}

export function fetchStocks() {
  return apiRequest<StockItem[]>("/api/quant/stocks", {
    authMode: "optional",
  });
}

function buildScreenerQuery(top?: number, maxSymbols?: number, filters?: ScreenerQueryOptions, forceRefresh = false) {
  const params = new URLSearchParams();
  if (top) {
    params.set("top", String(top));
  }
  if (maxSymbols) {
    params.set("max_symbols", String(maxSymbols));
  }
  if (filters?.preset && filters.preset !== "custom") {
    params.set("preset", filters.preset);
  }
  if (filters?.minAvgAmountK !== undefined) {
    params.set("min_avg_amount_k", String(filters.minAvgAmountK));
  }
  if (filters?.minLatestAmountK !== undefined) {
    params.set("min_latest_amount_k", String(filters.minLatestAmountK));
  }
  if (filters?.minFloatMarketCapW !== undefined) {
    params.set("min_float_market_cap_w", String(filters.minFloatMarketCapW));
  }
  if (filters?.minTotalMarketCapW !== undefined) {
    params.set("min_total_market_cap_w", String(filters.minTotalMarketCapW));
  }
  if (filters?.minListedDays !== undefined) {
    params.set("min_listed_days", String(filters.minListedDays));
  }
  if (filters?.excludeSt !== undefined) {
    params.set("exclude_st", String(filters.excludeSt));
  }
  if (filters?.excludeBse !== undefined) {
    params.set("exclude_bse", String(filters.excludeBse));
  }
  if (filters?.excludeSuspended !== undefined) {
    params.set("exclude_suspended", String(filters.excludeSuspended));
  }
  if (filters?.excludeNonListingStatus !== undefined) {
    params.set("exclude_non_listing_status", String(filters.excludeNonListingStatus));
  }
  if (forceRefresh) {
    params.set("force_refresh", "true");
  }
  return params.toString();
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function waitFor(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve();
    }, delayMs);

    if (signal?.aborted) {
      abort();
      return;
    }

    signal?.addEventListener("abort", abort, { once: true });
  });
}

function fetchScreenerJobStart(top?: number, maxSymbols?: number, filters?: ScreenerQueryOptions, forceRefresh = false, signal?: AbortSignal) {
  const query = buildScreenerQuery(top, maxSymbols, filters, forceRefresh);
  return apiRequest<ScreenerJobSnapshot>(`/api/quant/screener/jobs${query ? `?${query}` : ""}`, {
    authMode: "optional",
    signal,
  });
}

function fetchScreenerJob(jobId: string, signal?: AbortSignal) {
  return apiRequest<ScreenerJobSnapshot>(`/api/quant/screener/jobs/${jobId}`, {
    authMode: "optional",
    signal,
  });
}

export async function fetchScreener(
  top?: number,
  maxSymbols?: number,
  filters?: ScreenerQueryOptions,
  options: {
    forceRefresh?: boolean;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {}
) {
  const { forceRefresh = false, signal, timeoutMs = 1000 * 60 * 12 } = options;
  const started = await fetchScreenerJobStart(top, maxSymbols, filters, forceRefresh, signal);

  if (started.status === "completed" && started.result) {
    return started.result;
  }

  if (started.status === "failed" || started.status === "cancelled") {
    throw new Error(started.error || "筛选任务执行失败");
  }

  if (!started.jobId) {
    throw new Error("筛选任务没有返回有效的任务编号");
  }

  const deadline = Date.now() + timeoutMs;
  let current = started;

  while (Date.now() < deadline) {
    try {
      await waitFor(Math.max(500, current.pollAfterMs ?? 1500), signal);
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      throw error;
    }

    current = await fetchScreenerJob(started.jobId, signal);
    if (current.status === "completed" && current.result) {
      return current.result;
    }
    if (current.status === "failed" || current.status === "cancelled") {
      throw new Error(current.error || "筛选任务执行失败");
    }
  }

  throw new Error("筛选任务执行时间过长，请稍后刷新结果");
}

export function manualBuy() {
  return apiRequest<{ ok: boolean; message: string }>("/api/quant/action/buy", {
    method: "POST",
    authMode: "required",
  });
}

export function manualSell() {
  return apiRequest<{ ok: boolean; message: string }>("/api/quant/action/sell", {
    method: "POST",
    authMode: "required",
  });
}

export function startAutomation() {
  return apiRequest<{ ok: boolean; message: string }>("/api/quant/automation/start", {
    method: "POST",
    authMode: "required",
  });
}

export function stopAutomation() {
  return apiRequest<{ ok: boolean; message: string }>("/api/quant/automation/stop", {
    method: "POST",
    authMode: "required",
  });
}

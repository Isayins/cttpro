import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../services/api/client";
import { fetchState } from "../services/stockService";
import type { MarketSnapshot } from "../types/type";

const SNAPSHOT_CACHE_TTL_MS = 1000 * 45;
const WS_RECONNECT_DELAY_MS = 2500;
const WS_FALLBACK_DELAY_MS = 2500;

function buildSnapshotCacheKey(symbol?: string, limit?: number) {
  return `quant.market.snapshot.${symbol || "default"}.${limit || "default"}`;
}

function buildWebSocketUrl(symbol?: string, limit?: number) {
  const baseUrl = API_BASE_URL
    ? new URL(API_BASE_URL, window.location.origin)
    : new URL(window.location.origin);
  const normalizedPath = baseUrl.pathname.endsWith("/")
    ? baseUrl.pathname.slice(0, -1)
    : baseUrl.pathname;
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.pathname = `${normalizedPath}/api/quant/ws`.replace(/\/{2,}/g, "/");
  baseUrl.search = "";
  if (symbol) {
    baseUrl.searchParams.set("symbol", symbol);
  }
  if (limit) {
    baseUrl.searchParams.set("limit", String(limit));
  }
  baseUrl.searchParams.set("include_database", "false");
  return baseUrl.toString();
}

function readSnapshotCache(symbol?: string, limit?: number) {
  try {
    const raw = sessionStorage.getItem(buildSnapshotCacheKey(symbol, limit));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { updatedAt?: number; snapshot?: MarketSnapshot };
    if (!parsed || typeof parsed.updatedAt !== "number" || !parsed.snapshot) {
      return null;
    }

    if (Date.now() - parsed.updatedAt > SNAPSHOT_CACHE_TTL_MS) {
      return null;
    }

    return parsed.snapshot;
  } catch {
    return null;
  }
}

function writeSnapshotCache(symbol: string | undefined, limit: number | undefined, snapshot: MarketSnapshot) {
  try {
    sessionStorage.setItem(
      buildSnapshotCacheKey(symbol, limit),
      JSON.stringify({
        updatedAt: Date.now(),
        snapshot,
      })
    );
  } catch {
    // Ignore cache failures and keep polling alive.
  }
}

export function useMarketSocket(symbol?: string, limit?: number) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(() => readSnapshotCache(symbol, limit));
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>("");
  const requestIdRef = useRef(0);
  const socketRef = useRef<WebSocket | null>(null);

  const loadSnapshot = useCallback(async (currentSymbol?: string, currentLimit?: number) => {
    const requestId = ++requestIdRef.current;

    try {
      const data = await fetchState(currentSymbol, currentLimit);
      if (requestId !== requestIdRef.current) {
        return null;
      }

      setSnapshot(data);
      writeSnapshotCache(currentSymbol, currentLimit, data);
      setConnected(true);
      setError("");
      return data;
    } catch (errorValue) {
      if (requestId !== requestIdRef.current) {
        return null;
      }

      setConnected(false);
      setError(errorValue instanceof Error ? errorValue.message : "加载行情数据失败");
      return null;
    }
  }, []);

  const reload = async () => {
    await loadSnapshot(symbol, limit);
  };

  useEffect(() => {
    const cachedSnapshot = readSnapshotCache(symbol, limit);
    if (cachedSnapshot) {
      setSnapshot(cachedSnapshot);
      setError("");
    }
    if (typeof window === "undefined" || typeof window.WebSocket === "undefined") {
      void loadSnapshot(symbol, limit);
      return () => {
        requestIdRef.current += 1;
      };
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;
    let fallbackTimer: number | null = null;
    let receivedSnapshot = false;

    const clearTimers = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (fallbackTimer !== null) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const closeSocket = () => {
      if (socketRef.current) {
        const currentSocket = socketRef.current;
        socketRef.current = null;
        currentSocket.close();
      }
    };

    const scheduleReconnect = () => {
      if (cancelled || document.hidden || reconnectTimer !== null) {
        return;
      }
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, WS_RECONNECT_DELAY_MS);
    };

    const connect = () => {
      if (cancelled) {
        return;
      }

      clearTimers();
      closeSocket();
      receivedSnapshot = false;

      const socket = new WebSocket(buildWebSocketUrl(symbol, limit));
      socketRef.current = socket;

      fallbackTimer = window.setTimeout(() => {
        fallbackTimer = null;
        if (!receivedSnapshot) {
          void loadSnapshot(symbol, limit);
        }
      }, WS_FALLBACK_DELAY_MS);

      socket.onopen = () => {
        if (cancelled) {
          return;
        }
        setConnected(true);
        setError("");
      };

      socket.onmessage = (event) => {
        if (cancelled) {
          return;
        }
        try {
          const payload = JSON.parse(String(event.data)) as MarketSnapshot | { type?: string };
          if ("type" in payload && payload.type === "ping") {
            return;
          }
          receivedSnapshot = true;
          setSnapshot(payload as MarketSnapshot);
          writeSnapshotCache(symbol, limit, payload as MarketSnapshot);
          setConnected(true);
          setError("");
        } catch {
          setError("服务端返回了无法解析的响应");
        }
      };

      socket.onerror = () => {
        if (cancelled) {
          return;
        }
        setConnected(false);
      };

      socket.onclose = () => {
        if (cancelled) {
          return;
        }
        setConnected(false);
        scheduleReconnect();
      };
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearTimers();
        closeSocket();
        setConnected(false);
        return;
      }
      connect();
    };

    connect();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      requestIdRef.current += 1;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimers();
      closeSocket();
    };
  }, [loadSnapshot, symbol, limit]);

  return {
    snapshot,
    connected,
    error,
    reload,
  };
}

import { useEffect, useRef, useState } from "react";
import { fetchState } from "../services/stockService";
import type { MarketSnapshot } from "../types/type";

const POLL_INTERVAL_MS = 10000;

export function useMarketSocket(symbol?: string, limit?: number) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>("");
  const requestIdRef = useRef(0);

  const loadSnapshot = async (currentSymbol?: string, currentLimit?: number) => {
    const requestId = ++requestIdRef.current;

    try {
      const data = await fetchState(currentSymbol, currentLimit);
      if (requestId !== requestIdRef.current) {
        return null;
      }

      setSnapshot(data);
      setConnected(true);
      setError("");
      return data;
    } catch (errorValue) {
      if (requestId !== requestIdRef.current) {
        return null;
      }

      setConnected(false);
      setError(errorValue instanceof Error ? errorValue.message : "Failed to load market data");
      return null;
    }
  };

  const reload = async () => {
    await loadSnapshot(symbol, limit);
  };

  useEffect(() => {
    let alive = true;

    const loadLatestSnapshot = async () => {
      const requestId = ++requestIdRef.current;

      try {
        const data = await fetchState(symbol, limit);
        if (!alive || requestId !== requestIdRef.current) {
          return;
        }

        setSnapshot(data);
        setConnected(true);
        setError("");
      } catch (errorValue) {
        if (!alive || requestId !== requestIdRef.current) {
          return;
        }

        setConnected(false);
        setError(errorValue instanceof Error ? errorValue.message : "Failed to load market data");
      }
    };

    void loadLatestSnapshot();
    const timer = window.setInterval(() => {
      void loadLatestSnapshot();
    }, POLL_INTERVAL_MS);

    return () => {
      alive = false;
      requestIdRef.current += 1;
      window.clearInterval(timer);
    };
  }, [symbol, limit]);

  return {
    snapshot,
    connected,
    error,
    reload,
  };
}

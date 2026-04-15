import { useEffect, useState } from "react";
import { fetchState, getWsUrl } from "../services/stockService";
import type { MarketSnapshot } from "../types/type";

export function useMarketSocket() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>("");

  const reload = async () => {
    const data = await fetchState();
    setSnapshot(data);
  };

  useEffect(() => {
    let alive = true;

    fetchState()
      .then((data) => {
        if (alive) setSnapshot(data);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "加载失败");
      });

    const ws = new WebSocket(getWsUrl());

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError("WebSocket 连接失败");

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        
        // ✨ 核心修复：如果是心跳包，直接跳过，不要更新到 snapshot 里
        if (data.type === "ping" || data.type === "pong") {
          console.log("收到心跳包");
          return; 
        }
    
        // 只有当数据包含关键字段（比如 symbol）时才更新状态
        if (data.symbol || data.signal) {
          setSnapshot(data as MarketSnapshot);
        }
      } catch (err) {
        console.error("解析消息失败:", err);
      }
    };

    return () => {
      alive = false;
      ws.close();
    };
  }, []);

  return {
    snapshot,
    connected,
    error,
    reload,
  };
}
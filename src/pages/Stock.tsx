import { useState } from "react";
import {
  manualBuy,
  manualSell,
  startAutomation,
  stopAutomation
} from "../services/stockService";
import { useMarketSocket } from "../hooks/useMarketSocket";
import MainLayout from "../layouts/MainLayout";
import StockLayout from "../components/StockLayout";
import React from "react";

export default function Stock() {
  const { snapshot, connected, error, reload } = useMarketSocket();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const runAction = async (
    fn: () => Promise<{ ok: boolean; message: string }>
  ) => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fn();
      setMessage(res.message);
      await reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <MainLayout>
      <StockLayout
        snapshot={snapshot}
        connected={connected}
        error={error}
        busy={busy}
        message={message}
        onBuy={() => runAction(manualBuy)}
        onSell={() => runAction(manualSell)}
        onStart={() => runAction(startAutomation)}
        onStop={() => runAction(stopAutomation)}
      />
    </MainLayout>
  );
}
import { useEffect, useState } from "react";
import React from "react";
import StockLayout from "../components/StockLayout";
import MainLayout from "../layouts/MainLayout";
import { useMarketSocket } from "../hooks/useMarketSocket";
import type { StockItem } from "../types/type";
import {
  fetchStocks,
  manualBuy,
  manualSell,
  startAutomation,
  stopAutomation,
} from "../services/stockService";

const TIME_RANGE_OPTIONS = [
  { key: "1M", label: "1M", limit: 22 },
  { key: "3M", label: "3M", limit: 66 },
  { key: "6M", label: "6M", limit: 132 },
  { key: "1Y", label: "1Y", limit: 252 },
  { key: "3Y", label: "3Y", limit: 756 },
  { key: "ALL", label: "全部", limit: 5000 },
] as const;

type TimeRangeKey = (typeof TIME_RANGE_OPTIONS)[number]["key"];

export default function Stock() {
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>("1Y");
  const activeRange = TIME_RANGE_OPTIONS.find((item) => item.key === selectedRange) ?? TIME_RANGE_OPTIONS[3];
  const { snapshot, connected, error, reload } = useMarketSocket(
    selectedSymbol || undefined,
    activeRange.limit
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [stocksLoading, setStocksLoading] = useState(true);
  const [stocksError, setStocksError] = useState("");

  const currentStock = stocks.find((item) => item.symbol === (snapshot?.symbol || selectedSymbol));

  useEffect(() => {
    let alive = true;

    fetchStocks()
      .then((items) => {
        if (!alive) {
          return;
        }
        setStocks(items);
        setStocksError("");
      })
      .catch((err: unknown) => {
        if (!alive) {
          return;
        }
        setStocksError(err instanceof Error ? err.message : "加载股票列表失败");
      })
      .finally(() => {
        if (alive) {
          setStocksLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!snapshot?.symbol || selectedSymbol) {
      return;
    }
    setSelectedSymbol(snapshot.symbol);
  }, [snapshot?.symbol, selectedSymbol]);

  const runAction = async (fn: () => Promise<{ ok: boolean; message: string }>) => {
    setBusy(true);
    setMessage("");
    try {
      const res = await fn();
      setMessage(res.message);
      await reload();
    } catch (errorValue) {
      setMessage(errorValue instanceof Error ? errorValue.message : "操作失败");
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
        stocks={stocks}
        stocksLoading={stocksLoading}
        stocksError={stocksError}
        selectedSymbol={selectedSymbol}
        currentStockName={currentStock?.name || snapshot?.name || ""}
        currentStockCode={currentStock?.symbol || snapshot?.symbol || ""}
        selectedRange={selectedRange}
        rangeOptions={TIME_RANGE_OPTIONS}
        onSelectSymbol={setSelectedSymbol}
        onSelectRange={setSelectedRange}
        onBuy={() => runAction(manualBuy)}
        onSell={() => runAction(manualSell)}
        onStart={() => runAction(startAutomation)}
        onStop={() => runAction(stopAutomation)}
      />
    </MainLayout>
  );
}

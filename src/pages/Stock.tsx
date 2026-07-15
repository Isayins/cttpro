import { startTransition, useEffect, useMemo, useState } from "react";
import StockLayout from "../components/StockLayout";
import MainLayout from "../layouts/MainLayout";
import { useMarketSocket } from "../hooks/useMarketSocket";
import type { DatabaseSummary, ScreenerQueryOptions, ScreenerSnapshot } from "../types/type";
import {
  cacheStocks,
  fetchDatabaseSummary,
  fetchScreener,
  fetchStocks,
  getCachedStocks,
  manualBuy,
  manualSell,
  startAutomation,
  stopAutomation,
} from "../services/stockService";

const TIME_RANGE_OPTIONS = [
  { key: "1M", label: "1个月", limit: 22 },
  { key: "3M", label: "3个月", limit: 66 },
  { key: "6M", label: "6个月", limit: 132 },
  { key: "1Y", label: "1年", limit: 252 },
  { key: "3Y", label: "3年", limit: 756 },
  { key: "ALL", label: "全部", limit: 5000 },
] as const;

type TimeRangeKey = (typeof TIME_RANGE_OPTIONS)[number]["key"];
const DEFAULT_RANGE: TimeRangeKey = "6M";
const STOCKS_REFRESH_DELAY_MS = 180;
const SCREENER_LOAD_DELAY_MS = 320;
const SCREENER_INITIAL_DEFER_MS = 900;
const SCREENER_FALLBACK_DEFER_MS = 1800;
const DEFAULT_SCREENER_TOP = 6;
const SCREENER_FILTERS_STORAGE_KEY = "quant.screener.filters.v1";
const DEFAULT_SCREENER_FILTERS: ScreenerQueryOptions = {
  preset: "balanced",
  minAvgAmountK: 300000,
  minLatestAmountK: 150000,
  minFloatMarketCapW: 500000,
  minTotalMarketCapW: 0,
  minListedDays: 120,
  excludeSt: true,
  excludeBse: true,
  excludeSuspended: true,
  excludeNonListingStatus: true,
};

function getInitialStocksState() {
  const cachedStocks = getCachedStocks();
  return {
    stocks: cachedStocks ?? [],
    loading: !cachedStocks,
  };
}

function readScreenerFilters(): ScreenerQueryOptions {
  try {
    const raw = localStorage.getItem(SCREENER_FILTERS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SCREENER_FILTERS;
    }
    const parsed = JSON.parse(raw) as Partial<ScreenerQueryOptions>;
    return {
      preset:
        parsed.preset === "aggressive" || parsed.preset === "balanced" || parsed.preset === "conservative" || parsed.preset === "custom"
          ? parsed.preset
          : DEFAULT_SCREENER_FILTERS.preset,
      minAvgAmountK: typeof parsed.minAvgAmountK === "number" ? parsed.minAvgAmountK : DEFAULT_SCREENER_FILTERS.minAvgAmountK,
      minLatestAmountK:
        typeof parsed.minLatestAmountK === "number" ? parsed.minLatestAmountK : DEFAULT_SCREENER_FILTERS.minLatestAmountK,
      minFloatMarketCapW:
        typeof parsed.minFloatMarketCapW === "number" ? parsed.minFloatMarketCapW : DEFAULT_SCREENER_FILTERS.minFloatMarketCapW,
      minTotalMarketCapW:
        typeof parsed.minTotalMarketCapW === "number" ? parsed.minTotalMarketCapW : DEFAULT_SCREENER_FILTERS.minTotalMarketCapW,
      minListedDays: typeof parsed.minListedDays === "number" ? parsed.minListedDays : DEFAULT_SCREENER_FILTERS.minListedDays,
      excludeSt: typeof parsed.excludeSt === "boolean" ? parsed.excludeSt : DEFAULT_SCREENER_FILTERS.excludeSt,
      excludeBse: typeof parsed.excludeBse === "boolean" ? parsed.excludeBse : DEFAULT_SCREENER_FILTERS.excludeBse,
      excludeSuspended:
        typeof parsed.excludeSuspended === "boolean" ? parsed.excludeSuspended : DEFAULT_SCREENER_FILTERS.excludeSuspended,
      excludeNonListingStatus:
        typeof parsed.excludeNonListingStatus === "boolean"
          ? parsed.excludeNonListingStatus
          : DEFAULT_SCREENER_FILTERS.excludeNonListingStatus,
    };
  } catch {
    return DEFAULT_SCREENER_FILTERS;
  }
}

function writeScreenerFilters(filters: ScreenerQueryOptions) {
  localStorage.setItem(SCREENER_FILTERS_STORAGE_KEY, JSON.stringify(filters));
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export default function Stock() {
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>(DEFAULT_RANGE);
  const activeRange = TIME_RANGE_OPTIONS.find((item) => item.key === selectedRange) ?? TIME_RANGE_OPTIONS[2];
  const { snapshot, connected, error, reload } = useMarketSocket(selectedSymbol || undefined, activeRange.limit);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [{ stocks, loading: stocksLoading }, setStocksState] = useState(getInitialStocksState);
  const [stocksError, setStocksError] = useState("");
  const [screener, setScreener] = useState<ScreenerSnapshot | null>(null);
  const [screenerLoading, setScreenerLoading] = useState(false);
  const [screenerError, setScreenerError] = useState("");
  const [screenerTop, setScreenerTop] = useState(DEFAULT_SCREENER_TOP);
  const [screenerFilters, setScreenerFilters] = useState<ScreenerQueryOptions>(() => readScreenerFilters());
  const [screenerReady, setScreenerReady] = useState(false);
  const [databaseSummary, setDatabaseSummary] = useState<DatabaseSummary | null>(null);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [databaseError, setDatabaseError] = useState("");

  const snapshotWithDatabase = useMemo(() => {
    if (!snapshot) {
      return snapshot;
    }
    if (!databaseSummary) {
      return snapshot;
    }
    return {
      ...snapshot,
      database: databaseSummary,
    };
  }, [databaseSummary, snapshot]);

  const currentStock = useMemo(
    () => stocks.find((item) => item.symbol === (snapshot?.symbol || selectedSymbol)),
    [selectedSymbol, snapshot?.symbol, stocks]
  );

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      fetchStocks()
        .then((items) => {
          if (!alive) {
            return;
          }
          cacheStocks(items);
          startTransition(() => {
            setStocksState({
              stocks: items,
              loading: false,
            });
          });
          setStocksError("");
        })
        .catch((err: unknown) => {
          if (!alive) {
            return;
          }
          setStocksError(err instanceof Error ? err.message : "加载股票列表失败");
          setStocksState((previous) => ({
            stocks: previous.stocks,
            loading: false,
          }));
        });
    }, STOCKS_REFRESH_DELAY_MS);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!snapshot?.symbol || selectedSymbol) {
      return;
    }
    setSelectedSymbol(snapshot.symbol);
  }, [snapshot?.symbol, selectedSymbol]);

  useEffect(() => {
    const activeSymbol = snapshot?.symbol || selectedSymbol;
    if (!activeSymbol) {
      setDatabaseSummary(null);
      setDatabaseError("");
      setDatabaseLoading(false);
      return;
    }

    let alive = true;
    setDatabaseLoading(true);
    setDatabaseError("");
    setDatabaseSummary(null);

    fetchDatabaseSummary(activeSymbol)
      .then((summary) => {
        if (!alive) {
          return;
        }
        setDatabaseSummary(summary);
        setDatabaseLoading(false);
      })
      .catch((err: unknown) => {
        if (!alive) {
          return;
        }
        setDatabaseLoading(false);
        setDatabaseError(err instanceof Error ? err.message : "加载数据库概览失败");
      });

    return () => {
      alive = false;
    };
  }, [selectedSymbol, snapshot?.symbol]);

  useEffect(() => {
    writeScreenerFilters(screenerFilters);
  }, [screenerFilters]);

  useEffect(() => {
    if (screenerReady) {
      return;
    }

    const delay = snapshot ? SCREENER_INITIAL_DEFER_MS : SCREENER_FALLBACK_DEFER_MS;
    const timer = window.setTimeout(() => {
      setScreenerReady(true);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [screenerReady, snapshot]);

  useEffect(() => {
    if (!screenerReady) {
      return;
    }

    let alive = true;
    const controller = new AbortController();
    setScreenerLoading(true);
    const timer = window.setTimeout(() => {
      fetchScreener(screenerTop, undefined, screenerFilters, {
        signal: controller.signal,
      })
        .then((payload) => {
          if (!alive) {
            return;
          }
          startTransition(() => {
            setScreener(payload);
            setScreenerLoading(false);
          });
          setScreenerError("");
        })
        .catch((err: unknown) => {
          if (!alive) {
            return;
          }
          if (isAbortError(err)) {
            return;
          }
          setScreenerLoading(false);
          setScreenerError(err instanceof Error ? err.message : "加载筛选结果失败");
        });
    }, SCREENER_LOAD_DELAY_MS);

    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [screenerFilters, screenerReady, screenerTop]);

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

  const reloadScreener = async () => {
    if (!screenerReady) {
      setScreenerReady(true);
    }
    setScreenerLoading(true);
    try {
      const payload = await fetchScreener(screenerTop, undefined, screenerFilters, {
        forceRefresh: true,
      });
      startTransition(() => {
        setScreener(payload);
        setScreenerLoading(false);
      });
      setScreenerError("");
    } catch (errorValue) {
      setScreenerLoading(false);
      if (isAbortError(errorValue)) {
        return;
      }
      setScreenerError(errorValue instanceof Error ? errorValue.message : "加载筛选结果失败");
    }
  };

  const changeScreenerTop = (nextTop: number) => {
    if (nextTop === screenerTop) {
      return;
    }
    setScreenerTop(nextTop);
  };

  const changeScreenerFilters = (nextFilters: ScreenerQueryOptions) => {
    setScreenerFilters(nextFilters);
  };

  const resetScreenerFilters = () => {
    setScreenerFilters({ ...DEFAULT_SCREENER_FILTERS });
  };

  return (
    <MainLayout contentWidth="wide">
      <StockLayout
        snapshot={snapshotWithDatabase}
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
        databaseLoading={databaseLoading}
        databaseError={databaseError}
        screener={screener}
        screenerLoading={screenerLoading}
        screenerError={screenerError}
        screenerTop={screenerTop}
        screenerFilters={screenerFilters}
        selectedRange={selectedRange}
        rangeOptions={TIME_RANGE_OPTIONS}
        onSelectSymbol={setSelectedSymbol}
        onSelectRange={(range) => setSelectedRange(range as TimeRangeKey)}
        onRefreshScreener={reloadScreener}
        onChangeScreenerTop={changeScreenerTop}
        onChangeScreenerFilters={changeScreenerFilters}
        onResetScreenerFilters={resetScreenerFilters}
        onBuy={() => runAction(manualBuy)}
        onSell={() => runAction(manualSell)}
        onStart={() => runAction(startAutomation)}
        onStop={() => runAction(stopAutomation)}
      />
    </MainLayout>
  );
}

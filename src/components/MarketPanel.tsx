import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import type { CandlePoint, EquityPoint, MarketSnapshot, ScreenerSnapshot, StockItem, StockProfile, StrategyCard } from "../types/type";
import { Card, CardContent } from "./ui";
import type { OverlayMode, SubChartMode } from "./KLineChart";
import {
  formatForecastDirectionLabel,
  formatRiskLevelLabel,
  formatSignalActionLabel,
  formatSignalMarketLabel,
  formatStanceLabel,
  formatStrategySignalLabel,
  translateStrategyText,
} from "../utils/marketI18n";

const StockSelectorPanel = lazy(() => import("./StockSelectorPanel"));
const StrategyPanel = lazy(() => import("./StrategyPanel"));
const KLineChart = lazy(() => import("./KLineChart"));
const MacdChart = lazy(() => import("./MacdChart"));
const EquityChart = lazy(() => import("./EquityChart"));

type FavoriteGroup = "WATCH" | "BUYLIST" | "HOLDING";
type FavoriteRecord = {
  group: FavoriteGroup;
  note: string;
  targetPrice: string;
  stopPrice: string;
  holdingHorizon: string;
  addedAt: string;
  updatedAt: string;
};

type FavoriteStore = Record<string, FavoriteRecord>;
type WorkspaceShortcutItem = {
  symbol: string;
  name: string;
  descriptor: string;
  groupLabel?: string;
  holdingHorizon?: string;
  targetPrice?: string;
  stopPrice?: string;
  updatedAt?: string;
};

type StrategySourceMatch = {
  bucketId: string;
  bucketName: string;
  familyLabel: string;
  category: string;
  horizon: string;
  rank: number;
  fitScore: number;
  overallScore: number;
  signal: "PASS" | "WATCH" | "AVOID";
  summary: string;
};

type StrategySignalSummary = {
  passCount: number;
  watchCount: number;
  avoidCount: number;
};

const SCREENER_FAVORITES_STORAGE_KEY = "quant.screener.favorites.v3";
const LEGACY_SCREENER_FAVORITES_STORAGE_KEY = "quant.screener.favorites.v2";
const RECENT_SYMBOLS_KEY = "quant.recent.symbols";
const EMPTY_STRATEGY_CARDS: StrategyCard[] = [];
const PLAN_GROUP_OPTIONS: Array<{ value: FavoriteGroup; label: string }> = [
  { value: "WATCH", label: "观察" },
  { value: "BUYLIST", label: "买入清单" },
  { value: "HOLDING", label: "持仓" },
];

function nowIso() {
  return new Date().toISOString();
}
function readFavoriteStore(): FavoriteStore {
  try {
    const raw = localStorage.getItem(SCREENER_FAVORITES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Partial<FavoriteRecord>>;
      const next: FavoriteStore = {};
      for (const [symbol, value] of Object.entries(parsed || {})) {
        const group = value?.group;
        if (group !== "WATCH" && group !== "BUYLIST" && group !== "HOLDING") {
          continue;
        }
        next[symbol] = {
          group,
          note: typeof value.note === "string" ? value.note : "",
          targetPrice: typeof value.targetPrice === "string" ? value.targetPrice : "",
          stopPrice: typeof value.stopPrice === "string" ? value.stopPrice : "",
          holdingHorizon: typeof value.holdingHorizon === "string" ? value.holdingHorizon : "",
          addedAt: typeof value.addedAt === "string" && value.addedAt ? value.addedAt : nowIso(),
          updatedAt: typeof value.updatedAt === "string" && value.updatedAt ? value.updatedAt : nowIso(),
        };
      }
      return next;
    }

    const legacyRaw = localStorage.getItem(LEGACY_SCREENER_FAVORITES_STORAGE_KEY);
    if (!legacyRaw) {
      return {};
    }
    const legacyParsed = JSON.parse(legacyRaw) as Record<string, unknown>;
    const migrated: FavoriteStore = {};
    for (const [symbol, group] of Object.entries(legacyParsed)) {
      if (group !== "WATCH" && group !== "BUYLIST" && group !== "HOLDING") {
        continue;
      }
      migrated[symbol] = {
        group,
        note: "",
        targetPrice: "",
        stopPrice: "",
        holdingHorizon: "",
        addedAt: nowIso(),
        updatedAt: nowIso(),
      };
    }
    return migrated;
  } catch {
    return {};
  }
}

function writeFavoriteStore(store: FavoriteStore) {
  localStorage.setItem(SCREENER_FAVORITES_STORAGE_KEY, JSON.stringify(store));
}

function readStoredSymbols(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function writeStoredSymbols(key: string, symbols: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(symbols));
  } catch {
    // Ignore storage failures and keep the workspace usable.
  }
}

interface MarketPanelProps {
  snapshot: MarketSnapshot | null;
  screener: ScreenerSnapshot | null;
  connected: boolean;
  error: string | null;
  busy: boolean;
  databaseLoading: boolean;
  databaseError: string;
  onBuy: () => Promise<void>;
  onSell: () => Promise<void>;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  message: string;
  stocks: StockItem[];
  stocksLoading: boolean;
  stocksError: string;
  selectedSymbol: string;
  selectedRange: string;
  rangeOptions: ReadonlyArray<{ key: string; label: string }>;
  onSelectSymbol: (symbol: string) => void;
  onSelectRange: (range: string) => void;
}

function formatCompactNumber(value?: number, digits = 2) {
  if (value === undefined || value === null) {
    return "-";
  }
  return new Intl.NumberFormat("zh-CN", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(value);
}

function formatSignedPercent(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPriceSourceLabel(value?: string) {
  if (!value) {
    return "-";
  }
  if (value === "forward") {
    return "前复权";
  }
  if (value === "unadjusted") {
    return "未复权";
  }
  if (value === "kline") {
    return "旧原始表";
  }
  return value;
}

function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildFavoriteLabel(group: FavoriteGroup) {
  return PLAN_GROUP_OPTIONS.find((item) => item.value === group)?.label ?? group;
}

function parsePlanPrice(value?: string) {
  if (!value) {
    return null;
  }
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function computeDistancePct(reference?: number | null, target?: number | null) {
  if (!reference || !target) {
    return null;
  }
  return ((target - reference) / reference) * 100;
}

function sortCandlesByTime(candles: CandlePoint[]) {
  return [...candles].sort((left, right) => String(left.time).localeCompare(String(right.time)));
}

function computeCandleStats(candles: CandlePoint[]) {
  if (candles.length === 0) {
    return null;
  }

  const latest = candles[candles.length - 1];
  let periodHigh = candles[0].high;
  let periodLow = candles[0].low;

  for (const candle of candles) {
    periodHigh = Math.max(periodHigh, candle.high);
    periodLow = Math.min(periodLow, candle.low);
  }

  return {
    latest,
    periodHigh,
    periodLow,
    amplitude: latest.close > 0 ? ((latest.high - latest.low) / latest.close) * 100 : 0,
  };
}

function computeReturnStats(candles: CandlePoint[]) {
  if (candles.length === 0) {
    return {
      curve: [] as EquityPoint[],
      totalReturnPct: 0,
      maxDrawdownPct: 0,
      startClose: 0,
      latestClose: 0,
    };
  }

  const firstClose = candles[0].close || 0;
  let peakNav = 1;
  let maxDrawdownPct = 0;

  const curve = candles.map((candle) => {
    const nav = firstClose > 0 ? candle.close / firstClose : 0;
    peakNav = Math.max(peakNav, nav || 0);
    const drawdownPct = peakNav > 0 ? ((nav - peakNav) / peakNav) * 100 : 0;
    maxDrawdownPct = Math.min(maxDrawdownPct, drawdownPct);

    return {
      date: candle.time,
      value: Number((((nav || 0) - 1) * 100).toFixed(2)),
    };
  });

  return {
    curve,
    totalReturnPct: curve[curve.length - 1]?.value ?? 0,
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    startClose: firstClose,
    latestClose: candles[candles.length - 1]?.close ?? 0,
  };
}

function computeInsightStats(candles: CandlePoint[]) {
  if (candles.length === 0) {
    return {
      avgVolume: 0,
      avgAmount: 0,
      recent20ReturnPct: 0,
      rangePositionPct: 0,
      realizedVolatilityPct: 0,
    };
  }

  const recentWindow = candles.slice(-20);
  const firstRecentClose = recentWindow[0]?.close || 0;
  const latestClose = candles[candles.length - 1]?.close || 0;
  const totalVolume = recentWindow.reduce((sum, candle) => sum + (candle.volume || 0), 0);
  const totalAmount = recentWindow.reduce((sum, candle) => sum + (candle.amount || 0), 0);
  const rangeHigh = Math.max(...candles.map((candle) => candle.high));
  const rangeLow = Math.min(...candles.map((candle) => candle.low));
  const rangeSpan = rangeHigh - rangeLow;
  const dailyReturns: number[] = [];

  for (let index = 1; index < recentWindow.length; index += 1) {
    const previousClose = recentWindow[index - 1]?.close || 0;
    const currentClose = recentWindow[index]?.close || 0;
    if (previousClose > 0 && currentClose > 0) {
      dailyReturns.push((currentClose - previousClose) / previousClose);
    }
  }

  const meanReturn = dailyReturns.length > 0 ? dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length : 0;
  const variance =
    dailyReturns.length > 0
      ? dailyReturns.reduce((sum, value) => sum + (value - meanReturn) ** 2, 0) / dailyReturns.length
      : 0;

  return {
    avgVolume: recentWindow.length > 0 ? totalVolume / recentWindow.length : 0,
    avgAmount: recentWindow.length > 0 ? totalAmount / recentWindow.length : 0,
    recent20ReturnPct: firstRecentClose > 0 ? ((latestClose - firstRecentClose) / firstRecentClose) * 100 : 0,
    rangePositionPct: rangeSpan > 0 ? ((latestClose - rangeLow) / rangeSpan) * 100 : 0,
    realizedVolatilityPct: Math.sqrt(variance) * Math.sqrt(252) * 100,
  };
}

function getSecurityTypeLabel(type?: string | null) {
  if (type === "fund") {
    return "基金";
  }
  if (type === "stock") {
    return "股票";
  }
  if (type === "index") {
    return "指数";
  }
  return type || "股票";
}

function getListStatusLabel(status?: string | null) {
  if (status === "L") {
    return "上市";
  }
  if (status === "D") {
    return "退市";
  }
  if (status === "P") {
    return "停牌";
  }
  if (status === "I") {
    return "发行中";
  }
  return status || "-";
}

function coalesceText(...values: Array<string | number | null | undefined>) {
  for (const value of values) {
    if (value === undefined || value === null) {
      continue;
    }
    const text = String(value).trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function formatProfileValue(value: string | number | null | undefined, empty = "待同步") {
  if (value === undefined || value === null) {
    return empty;
  }
  const text = String(value).trim();
  return text ? text : empty;
}

function mergeProfile(
  activeStock: StockItem | null,
  snapshotProfile: StockProfile | undefined,
  snapshot: MarketSnapshot | null,
  selectedSymbol: string
) {
  return {
    symbol: coalesceText(activeStock?.symbol, snapshotProfile?.symbol, snapshot?.symbol, selectedSymbol),
    name: coalesceText(activeStock?.name, snapshotProfile?.name, snapshot?.name),
    securityType: coalesceText(activeStock?.securityType, snapshotProfile?.securityType),
    exchange: coalesceText(activeStock?.exchange, snapshotProfile?.exchange),
    market: coalesceText(activeStock?.market, snapshotProfile?.market),
    indexName: coalesceText(activeStock?.indexName, snapshotProfile?.indexName),
    industry: coalesceText(activeStock?.industry, snapshotProfile?.industry),
    area: coalesceText(activeStock?.area, snapshotProfile?.area),
    listStatus: coalesceText(activeStock?.listStatus, snapshotProfile?.listStatus),
    listDate: coalesceText(activeStock?.listDate, snapshotProfile?.listDate),
    boardNames: coalesceText(activeStock?.boardNames, snapshotProfile?.boardNames),
    boardCount: activeStock?.boardCount ?? snapshotProfile?.boardCount ?? 0,
  };
}

function buildProfileMeta(profile: ReturnType<typeof mergeProfile>, updatedAt?: string) {
  return [
    profile.symbol,
    getSecurityTypeLabel(profile.securityType),
    profile.exchange,
    profile.market,
    updatedAt ? `更新于 ${updatedAt}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function buildFamilyLabel(value: "LONG_TERM" | "STOCK_PICKING") {
  return value === "LONG_TERM" ? "长线策略" : "选股策略";
}

function buildStockDescriptor(item: StockItem) {
  return [getSecurityTypeLabel(item.securityType), item.market, item.exchange, item.industry, item.area]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" / ");
}

function buildStrategySourceMatches(screener: ScreenerSnapshot | null, symbol: string) {
  if (!screener || !symbol) {
    return [] as StrategySourceMatch[];
  }

  const buckets = [
    ...(screener.longTermStrategies ?? []).map((bucket) => ({ ...bucket, family: "LONG_TERM" as const })),
    ...(screener.stockPickers ?? []).map((bucket) => ({ ...bucket, family: "STOCK_PICKING" as const })),
  ];

  return buckets
    .flatMap((bucket) =>
      bucket.topCandidates
        .filter((candidate) => candidate.symbol === symbol)
        .map((candidate) => ({
          bucketId: bucket.id,
          bucketName: bucket.name,
          familyLabel: buildFamilyLabel(bucket.family),
          category: bucket.category,
          horizon: bucket.horizon,
          rank: candidate.rank,
          fitScore: candidate.fitScore,
          overallScore: candidate.overallScore,
          signal: candidate.signal,
          summary: candidate.summary || bucket.summary,
        }))
    )
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        right.fitScore - left.fitScore ||
        right.overallScore - left.overallScore ||
        left.bucketName.localeCompare(right.bucketName, "zh-CN")
    );
}

function summarizeStrategySignals(items: StrategyCard[]): StrategySignalSummary {
  return items.reduce(
    (summary, item) => {
      if (item.signal === "PASS") {
        summary.passCount += 1;
      } else if (item.signal === "WATCH") {
        summary.watchCount += 1;
      } else if (item.signal === "AVOID") {
        summary.avoidCount += 1;
      }
      return summary;
    },
    {
      passCount: 0,
      watchCount: 0,
      avoidCount: 0,
    } satisfies StrategySignalSummary
  );
}

function buildWorkspaceShortcutItems(
  symbols: string[],
  stockMap: Map<string, StockItem>,
  favoriteStore: FavoriteStore,
  activeSymbol: string
) {
  return symbols
    .filter((symbol) => symbol && symbol !== activeSymbol)
    .map<WorkspaceShortcutItem | null>((symbol) => {
      const stock = stockMap.get(symbol);
      if (!stock) {
        return null;
      }
      const favorite = favoriteStore[symbol];
      return {
        symbol,
        name: stock.name || symbol,
        descriptor: buildStockDescriptor(stock),
        groupLabel: favorite ? buildFavoriteLabel(favorite.group) : undefined,
        holdingHorizon: favorite?.holdingHorizon || "",
        targetPrice: favorite?.targetPrice || "",
        stopPrice: favorite?.stopPrice || "",
        updatedAt: favorite?.updatedAt,
      } satisfies WorkspaceShortcutItem;
    })
    .filter((item): item is WorkspaceShortcutItem => item !== null);
}

function WorkspaceShortcutSection({
  title,
  caption,
  items,
  emptyCopy,
  onSelectSymbol,
}: {
  title: string;
  caption: string;
  items: WorkspaceShortcutItem[];
  emptyCopy: string;
  onSelectSymbol: (symbol: string) => void;
}) {
  return (
    <div className="workspace-shortcut-card">
      <div className="workspace-shortcut-head">
        <div>
          <div className="workspace-shortcut-title">{title}</div>
          <div className="workspace-shortcut-caption">{caption}</div>
        </div>
        <span className="badge">{items.length}</span>
      </div>

      {items.length > 0 ? (
        <div className="workspace-shortcut-list">
          {items.map((item) => (
            <button
              key={`${title}-${item.symbol}`}
              type="button"
              className="workspace-symbol-item"
              onClick={() => onSelectSymbol(item.symbol)}
            >
              <div className="workspace-symbol-row">
                <div>
                  <div className="workspace-symbol-name">{item.name}</div>
                  <div className="workspace-symbol-meta">{item.symbol}</div>
                </div>
                {item.groupLabel ? <span className="stock-meta-pill">{item.groupLabel}</span> : null}
              </div>
              {item.descriptor ? <div className="workspace-symbol-submeta">{item.descriptor}</div> : null}
              {item.holdingHorizon || item.targetPrice || item.stopPrice ? (
                <div className="workspace-symbol-tags">
                  {item.holdingHorizon ? <span className="selector-filter-pill">周期 {item.holdingHorizon}</span> : null}
                  {item.targetPrice ? <span className="selector-filter-pill">目标价 {item.targetPrice}</span> : null}
                  {item.stopPrice ? <span className="selector-filter-pill">止损价 {item.stopPrice}</span> : null}
                </div>
              ) : null}
              {item.updatedAt ? <div className="workspace-symbol-time">更新于 {formatDateTime(item.updatedAt)}</div> : null}
            </button>
          ))}
        </div>
      ) : (
        <div className="workspace-shortcut-empty">{emptyCopy}</div>
      )}
    </div>
  );
}

export default function MarketPanel({
  snapshot,
  screener,
  connected,
  error,
  busy,
  databaseLoading,
  databaseError,
  onBuy,
  onSell,
  onStart,
  onStop,
  message,
  stocks,
  stocksLoading,
  stocksError,
  selectedSymbol,
  selectedRange,
  rangeOptions,
  onSelectSymbol,
  onSelectRange,
}: MarketPanelProps) {
  const summary = snapshot?.summary;
  const analysis = snapshot?.analysis ?? null;
  const forecast = analysis?.forecast;
  const database = snapshot?.database;
  const longTermStrategies = analysis?.longTermStrategies ?? EMPTY_STRATEGY_CARDS;
  const stockPickingStrategies = analysis?.stockPickers ?? EMPTY_STRATEGY_CARDS;
  const longTermSummary = useMemo(() => summarizeStrategySignals(longTermStrategies), [longTermStrategies]);
  const stockPickingSummary = useMemo(() => summarizeStrategySignals(stockPickingStrategies), [stockPickingStrategies]);
  const totalStrategySummary = useMemo(
    () => summarizeStrategySignals([...longTermStrategies, ...stockPickingStrategies]),
    [longTermStrategies, stockPickingStrategies]
  );
  const [overlayMode, setOverlayMode] = useState<OverlayMode>("ma");
  const [subChartMode, setSubChartMode] = useState<SubChartMode>("volume");
  const [favoriteStore, setFavoriteStore] = useState<FavoriteStore>({});
  const [recentSymbols, setRecentSymbols] = useState<string[]>(() => readStoredSymbols(RECENT_SYMBOLS_KEY));
  const activeSymbol = snapshot?.symbol || selectedSymbol || "";
  const stockMap = useMemo(() => new Map(stocks.map((item) => [item.symbol, item])), [stocks]);

  const activeStock = useMemo(() => {
    if (!activeSymbol) {
      return null;
    }
    return stockMap.get(activeSymbol) ?? null;
  }, [activeSymbol, stockMap]);

  const activeProfile = useMemo(
    () => mergeProfile(activeStock, snapshot?.profile, snapshot, selectedSymbol),
    [activeStock, selectedSymbol, snapshot]
  );

  const orderedCandles = useMemo(() => sortCandlesByTime(snapshot?.candles ?? []), [snapshot?.candles]);
  const candleStats = useMemo(() => computeCandleStats(orderedCandles), [orderedCandles]);
  const returnStats = useMemo(() => computeReturnStats(orderedCandles), [orderedCandles]);
  const insightStats = useMemo(() => computeInsightStats(orderedCandles), [orderedCandles]);
  const forecast20 = forecast?.horizons.find((item) => item.days === 20);
  const forecast60 = forecast?.horizons.find((item) => item.days === 60);
  const databaseSections = database?.sections ?? [];
  const latestSignal = snapshot?.signal;
  const latestChange = snapshot?.dailyChangePct ?? 0;
  const priceSourceBadges = useMemo(() => {
    const items: string[] = [];
    if (snapshot?.priceSources?.display) {
      items.push(`展示价 ${formatPriceSourceLabel(snapshot.priceSources.display)}`);
    }
    if (snapshot?.priceSources?.signal) {
      items.push(`信号价 ${formatPriceSourceLabel(snapshot.priceSources.signal)}`);
    }
    return items;
  }, [snapshot?.priceSources?.display, snapshot?.priceSources?.signal]);
  const currentPlan = activeSymbol ? favoriteStore[activeSymbol] : undefined;
  const currentPlanTarget = parsePlanPrice(currentPlan?.targetPrice);
  const currentPlanStop = parsePlanPrice(currentPlan?.stopPrice);
  const targetDistancePct = computeDistancePct(snapshot?.lastClose, currentPlanTarget);
  const stopDistancePct = computeDistancePct(snapshot?.lastClose, currentPlanStop);
  const planCompletenessCount = [currentPlan?.targetPrice, currentPlan?.stopPrice, currentPlan?.holdingHorizon, currentPlan?.note]
    .filter((value) => Boolean(value && value.trim()))
    .length;
  const strategySourceMatches = useMemo(() => buildStrategySourceMatches(screener, activeSymbol), [activeSymbol, screener]);
  const strategySourceFamilies = useMemo(
    () => Array.from(new Set(strategySourceMatches.map((item) => item.familyLabel))),
    [strategySourceMatches]
  );
  const bestStrategyFit = strategySourceMatches.length > 0 ? Math.max(...strategySourceMatches.map((item) => item.fitScore)) : null;
  const averageStrategyModel =
    strategySourceMatches.length > 0
      ? strategySourceMatches.reduce((sum, item) => sum + item.overallScore, 0) / strategySourceMatches.length
      : null;
  const alignmentLabel =
    longTermSummary.passCount > 0 && stockPickingSummary.passCount > 0
      ? "跨策略一致"
      : totalStrategySummary.passCount > 0
      ? "部分一致"
      : totalStrategySummary.watchCount > 0
      ? "继续观察"
      : "一致性偏弱";
  const alignmentCopy =
    longTermSummary.passCount > 0 && stockPickingSummary.passCount > 0
      ? "长线策略和选股策略同时给出积极信号，说明当前方向具备较强共识。"
      : totalStrategySummary.passCount > 0
      ? "已有部分框架给出积极判断，但整体确认度还不够高。"
      : totalStrategySummary.watchCount > 0
      ? "模型开始关注这只股票，但还需要更多确认信号才适合转为积极判断。"
      : "当前大多数已加载策略并不支持这只股票，参与前需要更高证据强度。";
  const holdingSymbols = useMemo(
    () =>
      Object.entries(favoriteStore)
        .filter(([, value]) => value.group === "HOLDING")
        .sort((left, right) => new Date(right[1].updatedAt).getTime() - new Date(left[1].updatedAt).getTime())
        .map(([symbol]) => symbol),
    [favoriteStore]
  );
  const buylistSymbols = useMemo(
    () =>
      Object.entries(favoriteStore)
        .filter(([, value]) => value.group === "BUYLIST")
        .sort((left, right) => new Date(right[1].updatedAt).getTime() - new Date(left[1].updatedAt).getTime())
        .map(([symbol]) => symbol),
    [favoriteStore]
  );
  const watchSymbols = useMemo(
    () =>
      Object.entries(favoriteStore)
        .filter(([, value]) => value.group === "WATCH")
        .sort((left, right) => new Date(right[1].updatedAt).getTime() - new Date(left[1].updatedAt).getTime())
        .map(([symbol]) => symbol),
    [favoriteStore]
  );
  const holdingShortcutItems = useMemo(
    () => buildWorkspaceShortcutItems(holdingSymbols.slice(0, 5), stockMap, favoriteStore, activeSymbol),
    [activeSymbol, favoriteStore, holdingSymbols, stockMap]
  );
  const buylistShortcutItems = useMemo(
    () => buildWorkspaceShortcutItems(buylistSymbols.slice(0, 5), stockMap, favoriteStore, activeSymbol),
    [activeSymbol, buylistSymbols, favoriteStore, stockMap]
  );
  const watchShortcutItems = useMemo(
    () => buildWorkspaceShortcutItems(watchSymbols.slice(0, 5), stockMap, favoriteStore, activeSymbol),
    [activeSymbol, favoriteStore, stockMap, watchSymbols]
  );
  const recentShortcutItems = useMemo(
    () => buildWorkspaceShortcutItems(recentSymbols.slice(0, 6), stockMap, favoriteStore, activeSymbol),
    [activeSymbol, favoriteStore, recentSymbols, stockMap]
  );
  const profileBadges = [
    getSecurityTypeLabel(activeProfile.securityType),
    activeProfile.market,
    activeProfile.exchange,
    activeProfile.listStatus ? getListStatusLabel(activeProfile.listStatus) : "",
    activeProfile.boardCount ? `${activeProfile.boardCount} 个板块` : "",
  ].filter(Boolean);
  const boardItems = useMemo(
    () => activeProfile.boardNames.split(" / ").filter(Boolean).slice(0, 12),
    [activeProfile.boardNames]
  );
  const profileFacts = [
    {
      label: "资产类型",
      value: activeProfile.securityType ? getSecurityTypeLabel(activeProfile.securityType) : "待同步",
      ready: Boolean(activeProfile.securityType),
    },
    { label: "市场", value: formatProfileValue(activeProfile.market), ready: Boolean(activeProfile.market) },
    { label: "交易所", value: formatProfileValue(activeProfile.exchange), ready: Boolean(activeProfile.exchange) },
    { label: "行业", value: formatProfileValue(activeProfile.industry), ready: Boolean(activeProfile.industry) },
    { label: "地区", value: formatProfileValue(activeProfile.area), ready: Boolean(activeProfile.area) },
    { label: "上市日期", value: formatProfileValue(activeProfile.listDate), ready: Boolean(activeProfile.listDate) },
    {
      label: "上市状态",
      value: activeProfile.listStatus ? getListStatusLabel(activeProfile.listStatus) : "待同步",
      ready: Boolean(activeProfile.listStatus),
    },
    {
      label: "所属板块",
      value: boardItems.length > 0 || activeProfile.boardCount ? String(activeProfile.boardCount || boardItems.length) : "待同步",
      ready: boardItems.length > 0 || Boolean(activeProfile.boardCount),
    },
  ];
  const profileCoverage = profileFacts.filter((item) => item.ready).length;
  const pulseStats = [
    {
      label: "连接状态",
      value: connected ? "已连接" : "等待中",
      tone: "",
      note: "接口轮询与策略运行状态。",
    },
    {
      label: "模型观点",
      value: formatStanceLabel(analysis?.stance),
      tone: "",
      note: "基于趋势、波动与历史相似样本的综合判断。",
    },
    {
      label: "预测置信度",
      value: `${forecast?.confidencePct ?? 0}%`,
      tone: "",
      note: "由样本数量与未来收益离散度共同推导。",
    },
    {
      label: "风险等级",
      value: formatRiskLevelLabel(analysis?.riskLevel),
      tone: "",
      note: "波动越大、历史回撤越深，风险分级通常越高。",
    },
  ];
  const insightCards = [
    {
      label: "20 根K线收益",
      value: formatSignedPercent(insightStats.recent20ReturnPct),
      tone: insightStats.recent20ReturnPct >= 0 ? "metric-positive" : "metric-negative",
      note: "最近 20 根K线区间内的短线涨跌表现。",
    },
    {
      label: "区间位置",
      value: `${insightStats.rangePositionPct.toFixed(1)}%`,
      tone: "",
      note: "最新收盘价位于当前区间高低点之间的相对位置。",
    },
    {
      label: "20日预测",
      value: forecast20 ? formatSignedPercent(forecast20.expectedReturnPct) : "-",
      tone: (forecast20?.expectedReturnPct ?? 0) >= 0 ? "metric-positive" : "metric-negative",
      note: "基于历史相似样本推导出的 20 日前瞻预期。",
    },
    {
      label: "60日预测",
      value: forecast60 ? formatSignedPercent(forecast60.expectedReturnPct) : "-",
      tone: (forecast60?.expectedReturnPct ?? 0) >= 0 ? "metric-positive" : "metric-negative",
      note: "基于同一组历史相似样本推导出的中期预期。",
    },
  ];

  useEffect(() => {
    const store = readFavoriteStore();
    setFavoriteStore(store);
  }, []);

  useEffect(() => {
    writeStoredSymbols(RECENT_SYMBOLS_KEY, recentSymbols);
  }, [recentSymbols]);

  useEffect(() => {
    if (!activeSymbol) {
      return;
    }
    setRecentSymbols((previous) => [activeSymbol, ...previous.filter((item) => item !== activeSymbol)].slice(0, 12));
  }, [activeSymbol]);

  const updateFavoriteStore = (updater: (previous: FavoriteStore) => FavoriteStore) => {
    setFavoriteStore((previous) => {
      const next = updater(previous);
      writeFavoriteStore(next);
      return next;
    });
  };

  const handleToggleCurrentPlan = () => {
    if (!activeSymbol) {
      return;
    }
    updateFavoriteStore((previous) => {
      if (previous[activeSymbol]) {
        const next = { ...previous };
        delete next[activeSymbol];
        return next;
      }
      return {
        ...previous,
        [activeSymbol]: {
          group: "WATCH",
          note: "",
          targetPrice: "",
          stopPrice: "",
          holdingHorizon: "",
          addedAt: nowIso(),
          updatedAt: nowIso(),
        },
      };
    });
  };

  const handlePlanGroupChange = (group: FavoriteGroup) => {
    if (!activeSymbol || !currentPlan) {
      return;
    }
    updateFavoriteStore((previous) => ({
      ...previous,
      [activeSymbol]: {
        ...previous[activeSymbol],
        group,
        updatedAt: nowIso(),
      },
    }));
  };

  const handlePlanFieldChange = (field: "targetPrice" | "stopPrice" | "holdingHorizon" | "note", value: string) => {
    if (!activeSymbol || !currentPlan) {
      return;
    }
    updateFavoriteStore((previous) => ({
      ...previous,
      [activeSymbol]: {
        ...previous[activeSymbol],
        [field]: value,
        updatedAt: nowIso(),
      },
    }));
  };

  return (
    <div className="page-stack stock-page-stack">
      {error ? (
        <Card>
          <CardContent>
            <div className="error-text">{error}</div>
          </CardContent>
        </Card>
      ) : null}

      {message ? (
        <Card>
          <CardContent>
            <div className="success-text">{message}</div>
          </CardContent>
        </Card>
      ) : null}

      {snapshot?.error ? (
        <Card>
          <CardContent>
            <div className="error-text">{snapshot.error}</div>
          </CardContent>
        </Card>
      ) : null}

      <section className="market-hero">
        <div className="market-hero-main">
          <div className="market-hero-kicker">行情总览</div>
          <div className="market-hero-title-row">
            <h1 className="market-hero-title">{activeProfile.name || "尚未选择股票名称"}</h1>
            <span className={`market-status-pill ${connected ? "online" : "offline"}`}>
              {connected ? "实时" : "轮询中"}
            </span>
          </div>
          <div className="market-hero-meta">{buildProfileMeta(activeProfile, snapshot?.updatedAt)}</div>
          {profileBadges.length > 0 || priceSourceBadges.length > 0 ? (
            <div className="market-hero-badges">
              {profileBadges.map((item) => (
                <span key={item} className="stock-meta-pill">
                  {item}
                </span>
              ))}
              {priceSourceBadges.map((item) => (
                <span key={item} className="selector-filter-pill">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
          <div className="market-hero-price-row">
            <div className="market-price-block">
              <span className="market-price-label">最新收盘</span>
              <span className="market-price-value">{snapshot?.lastClose?.toFixed(3) ?? "-"}</span>
            </div>
            <div className={`market-change-block ${latestChange >= 0 ? "metric-positive" : "metric-negative"}`}>
              <span className="market-price-label">当日涨跌</span>
              <span className="market-price-value">{formatSignedPercent(latestChange)}</span>
            </div>
          </div>
        </div>

        <div className="market-hero-side">
          <div className="hero-signal-card">
            <span className="hero-signal-label">策略信号</span>
            <strong className="hero-signal-value">
              {formatSignalMarketLabel(latestSignal?.market)} / {formatSignalActionLabel(latestSignal?.action)}
            </strong>
            <p className="hero-signal-copy">{translateStrategyText(latestSignal?.reason) || "等待下一次策略更新。"}</p>
          </div>
          <div className="hero-mini-stats">
            <div className="hero-mini-stat">
              <span>成交量</span>
              <strong>{formatCompactNumber(snapshot?.latestVolume, 1)}</strong>
            </div>
            <div className="hero-mini-stat">
              <span>成交额</span>
              <strong>{formatCompactNumber(snapshot?.latestAmount, 1)}</strong>
            </div>
            <div className="hero-mini-stat">
              <span>20日预测</span>
              <strong className={(forecast20?.expectedReturnPct ?? 0) >= 0 ? "metric-positive" : "metric-negative"}>
                {forecast20 ? formatSignedPercent(forecast20.expectedReturnPct) : "-"}
              </strong>
            </div>
            <div className="hero-mini-stat">
              <span>置信度</span>
              <strong>{forecast?.confidencePct ?? 0}%</strong>
            </div>
          </div>

          <div className="market-plan-card">
            <div className="market-plan-head">
              <div>
                <div className="market-plan-label">工作区跟踪</div>
                <div className="market-plan-title">当前股票的筛选计划</div>
              </div>
              {currentPlan ? <span className="stock-meta-pill">{buildFavoriteLabel(currentPlan.group)}</span> : null}
            </div>

            {activeSymbol ? (
              currentPlan ? (
                <>
                  <div className="market-plan-meta">
                    创建于 {formatDateTime(currentPlan.addedAt)} / 更新于 {formatDateTime(currentPlan.updatedAt)}
                  </div>
                  <div className="market-plan-grid">
                    <label className="market-plan-field">
                      <span>分组</span>
                      <select
                        className="market-plan-select"
                        value={currentPlan.group}
                        onChange={(event) => handlePlanGroupChange(event.target.value as FavoriteGroup)}
                      >
                        {PLAN_GROUP_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="market-plan-field">
                      <span>目标价</span>
                      <input
                        className="market-plan-input"
                        value={currentPlan.targetPrice}
                        onChange={(event) => handlePlanFieldChange("targetPrice", event.target.value)}
                        placeholder="填写目标价"
                      />
                    </label>
                    <label className="market-plan-field">
                      <span>止损价</span>
                      <input
                        className="market-plan-input"
                        value={currentPlan.stopPrice}
                        onChange={(event) => handlePlanFieldChange("stopPrice", event.target.value)}
                        placeholder="填写止损价"
                      />
                    </label>
                    <label className="market-plan-field market-plan-field-wide">
                      <span>持有周期</span>
                      <input
                        className="market-plan-input"
                        value={currentPlan.holdingHorizon}
                        onChange={(event) => handlePlanFieldChange("holdingHorizon", event.target.value)}
                        placeholder="如 3 个月 / 1 年"
                      />
                    </label>
                  </div>

                  <div className="market-plan-stats">
                    <div className="hero-mini-stat">
                      <span>目标价偏离</span>
                      <strong className={(targetDistancePct ?? 0) >= 0 ? "metric-positive" : "metric-negative"}>
                        {targetDistancePct === null ? "-" : formatSignedPercent(targetDistancePct)}
                      </strong>
                    </div>
                    <div className="hero-mini-stat">
                      <span>止损价偏离</span>
                      <strong className={(stopDistancePct ?? 0) >= 0 ? "metric-positive" : "metric-negative"}>
                        {stopDistancePct === null ? "-" : formatSignedPercent(stopDistancePct)}
                      </strong>
                    </div>
                  </div>

                  <label className="market-plan-field">
                    <span>备注</span>
                    <textarea
                      className="market-plan-textarea"
                      value={currentPlan.note}
                      onChange={(event) => handlePlanFieldChange("note", event.target.value)}
                      placeholder="记录加入原因、待验证条件，以及什么情况下这笔计划失效。"
                      rows={3}
                    />
                  </label>

                  <div className="button-row market-plan-actions">
                    <button type="button" className="favorite-toggle active" onClick={handleToggleCurrentPlan}>
                      从计划中移除
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="market-plan-empty">
                    当前股票还不在你的筛选自选列表里。添加后，它也会同步显示在上方的分组自选区。
                  </div>
                  <div className="button-row market-plan-actions">
                    <button type="button" className="favorite-toggle" onClick={handleToggleCurrentPlan}>
                      加入观察
                    </button>
                  </div>
                </>
              )
            ) : (
              <div className="market-plan-empty">请先选择一个股票名称，再为它补充本地跟踪计划和价格位。</div>
            )}
          </div>
        </div>
      </section>

      <section className="workspace-shortcuts">
        <div className="section-head chart-section-head">
          <div>
            <div className="section-kicker">工作区快捷跳转</div>
            <h2 className="section-title">快速切换已跟踪股票</h2>
            <div className="muted">
              在同一条复盘流程里直接切换持仓、买入清单、观察列表和最近浏览过的股票。
            </div>
          </div>
          <div className="database-overview-pills">
            <span className="badge">{Object.keys(favoriteStore).length} 只已跟踪股票</span>
            <span className="badge">{recentShortcutItems.length} 个最近浏览</span>
          </div>
        </div>

        <div className="workspace-shortcuts-grid">
          <WorkspaceShortcutSection
            title="持仓"
            caption="已经进入组合的股票"
            items={holdingShortcutItems}
            emptyCopy="还没有记录持仓股票。"
            onSelectSymbol={onSelectSymbol}
          />
          <WorkspaceShortcutSection
            title="买入清单"
            caption="短期逻辑更强的候选股票"
            items={buylistShortcutItems}
            emptyCopy="买入清单里还没有股票。"
            onSelectSymbol={onSelectSymbol}
          />
          <WorkspaceShortcutSection
            title="观察"
            caption="还需要继续验证的想法"
            items={watchShortcutItems}
            emptyCopy="观察列表里还没有股票。"
            onSelectSymbol={onSelectSymbol}
          />
          <WorkspaceShortcutSection
            title="最近查看"
            caption="最近打开过的股票"
            items={recentShortcutItems}
            emptyCopy="开始浏览后，这里会显示最近打开的股票。"
            onSelectSymbol={onSelectSymbol}
          />
        </div>
      </section>

      <section className="strategy-provenance-section">
        <div className="section-head chart-section-head">
          <div>
            <div className="section-kicker">策略来源</div>
            <h2 className="section-title">这只股票为什么出现在这里</h2>
            <div className="muted">查看当前有哪些策略池命中了这只股票、它的跨策略重合度，以及本次复盘背后的匹配画像。</div>
          </div>
          {strategySourceMatches.length > 0 ? <span className="badge">{strategySourceMatches.length} 次策略命中</span> : null}
        </div>

        {strategySourceMatches.length > 0 ? (
          <>
            <div className="strategy-provenance-overview">
              <div className="research-stat-card">
                <div className="metric-label">命中策略池</div>
                <div className="metric-value">{strategySourceMatches.length}</div>
                <div className="metric-footnote">当前已加载结果中，包含这只股票的策略池数量。</div>
              </div>
              <div className="research-stat-card research-stat-card-soft">
                <div className="metric-label">最高匹配分</div>
                <div className="metric-value">{bestStrategyFit ?? 0}%</div>
                <div className="metric-footnote">这只股票在所有命中策略池里的最高匹配分。</div>
              </div>
              <div className="research-stat-card">
                <div className="metric-label">平均模型分</div>
                <div className="metric-value">{averageStrategyModel?.toFixed(2) ?? "-"}</div>
                <div className="metric-footnote">当前已加载策略范围内的综合平均模型分。</div>
              </div>
              <div className="research-stat-card research-stat-card-soft">
                <div className="metric-label">策略家族</div>
                <div className="metric-value">{strategySourceFamilies.length}</div>
                <div className="metric-footnote">
                  {strategySourceFamilies.length > 0 ? strategySourceFamilies.join(" / ") : "暂无可用的家族分类。"}
                </div>
              </div>
            </div>

            <div className="strategy-provenance-grid">
              {strategySourceMatches.map((item) => (
                <div key={`${item.bucketId}-${item.rank}`} className="strategy-provenance-card">
                  <div className="strategy-provenance-head">
                    <div>
                      <div className="strategy-provenance-name">{translateStrategyText(item.bucketName) || item.bucketName}</div>
                      <div className="strategy-provenance-meta">
                        {translateStrategyText(item.familyLabel)} / {translateStrategyText(item.category)} / {translateStrategyText(item.horizon)}
                      </div>
                    </div>
                    <div className={`strategy-fit-badge strategy-fit-${item.signal.toLowerCase()}`}>
                      {formatStrategySignalLabel(item.signal)} / #{item.rank}
                    </div>
                  </div>

                  <div className="strategy-provenance-chip-row">
                    <span className="stock-meta-pill">匹配分 {item.fitScore}%</span>
                    <span className="stock-meta-pill">模型分 {item.overallScore.toFixed(2)}</span>
                    <span className="selector-filter-pill">{translateStrategyText(item.familyLabel) || item.familyLabel}</span>
                  </div>

                  <div className="strategy-provenance-copy">{translateStrategyText(item.summary) || "当前这条策略命中暂无额外说明。"}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="strategy-provenance-empty">
            当前这只股票不在已加载的筛选列表中。你可以提高筛选深度或刷新股票池，再重新查看更广范围的策略覆盖。
          </div>
        )}
      </section>

      <section className="decision-radar-section">
        <div className="section-head chart-section-head">
          <div>
            <div className="section-kicker">决策雷达</div>
            <h2 className="section-title">一眼看懂策略一致性</h2>
            <div className="muted">把当前加载的策略观点压缩到一块，方便你在进入详细策略卡片前先判断整体方向是否一致。</div>
          </div>
          <span className="badge">{alignmentLabel}</span>
        </div>

        <div className="decision-radar-grid">
          <div className="strategy-summary-card">
            <span className="strategy-summary-label">一致性状态</span>
            <strong className="strategy-summary-value">{alignmentLabel}</strong>
            <div className="strategy-summary-meta">
              {formatStrategySignalLabel("PASS")} {totalStrategySummary.passCount} / {formatStrategySignalLabel("WATCH")}{" "}
              {totalStrategySummary.watchCount} / {formatStrategySignalLabel("AVOID")} {totalStrategySummary.avoidCount}
            </div>
            <div className="strategy-summary-note">{alignmentCopy}</div>
            <div className="strategy-summary-chip-row">
              <span className="stock-meta-pill">长线 {formatStrategySignalLabel("PASS")} {longTermSummary.passCount}</span>
              <span className="stock-meta-pill">选股 {formatStrategySignalLabel("PASS")} {stockPickingSummary.passCount}</span>
            </div>
          </div>

          <div className="research-stat-card research-stat-card-soft">
            <div className="metric-label">计划完整度</div>
            <div className="metric-value">{planCompletenessCount}/4</div>
            <div className="metric-footnote">当前股票在目标价、止损价、持有周期和备注四项上的填写完成度。</div>
          </div>

          <div className="research-stat-card">
            <div className="metric-label">预测方向</div>
            <div className="metric-value">{formatForecastDirectionLabel(forecast?.direction)}</div>
            <div className="metric-footnote">置信度 {forecast?.confidencePct ?? 0}% ，历史相似样本 {forecast?.sampleSize ?? 0} 个。</div>
          </div>

          <div className="research-stat-card research-stat-card-soft">
            <div className="metric-label">筛选共振度</div>
            <div className="metric-value">{strategySourceMatches.length}</div>
            <div className="metric-footnote">
              {strategySourceFamilies.length > 0
                ? `${strategySourceFamilies.join(" / ")} 当前都在命中这只股票。`
                : "当前没有已加载的策略池在命中这只股票。"}
            </div>
          </div>
        </div>

        <div className="decision-radar-family-grid">
          <div className="decision-radar-family-card">
            <div className="strategy-section-head">
              <div>
                <div className="section-kicker">长线视角</div>
                <h3 className="strategy-section-title">长线策略判断</h3>
              </div>
              <span className="badge">{longTermStrategies.length}</span>
            </div>
            {longTermStrategies.length > 0 ? (
              <div className="decision-radar-chip-list">
                {longTermStrategies.map((item) => (
                  <div key={item.id} className="decision-radar-chip-card">
                    <div className="decision-radar-chip-head">
                      <div>
                        <div className="decision-radar-chip-name">{translateStrategyText(item.name)}</div>
                        <div className="decision-radar-chip-meta">
                          {translateStrategyText(item.category)} / {translateStrategyText(item.horizon)}
                        </div>
                      </div>
                      <div className={`strategy-fit-badge strategy-fit-${item.signal.toLowerCase()}`}>
                        {formatStrategySignalLabel(item.signal)} / {item.fitScore}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="strategy-provenance-empty">当前股票暂无长线策略结果。</div>
            )}
          </div>

          <div className="decision-radar-family-card">
            <div className="strategy-section-head">
              <div>
                <div className="section-kicker">选股视角</div>
                <h3 className="strategy-section-title">选股策略判断</h3>
              </div>
              <span className="badge">{stockPickingStrategies.length}</span>
            </div>
            {stockPickingStrategies.length > 0 ? (
              <div className="decision-radar-chip-list">
                {stockPickingStrategies.map((item) => (
                  <div key={item.id} className="decision-radar-chip-card">
                    <div className="decision-radar-chip-head">
                      <div>
                        <div className="decision-radar-chip-name">{translateStrategyText(item.name)}</div>
                        <div className="decision-radar-chip-meta">
                          {translateStrategyText(item.category)} / {translateStrategyText(item.horizon)}
                        </div>
                      </div>
                      <div className={`strategy-fit-badge strategy-fit-${item.signal.toLowerCase()}`}>
                        {formatStrategySignalLabel(item.signal)} / {item.fitScore}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="strategy-provenance-empty">当前股票暂无选股策略结果。</div>
            )}
          </div>
        </div>
      </section>

      <Suspense fallback={<Card><CardContent><div className="muted">加载股票切换器中...</div></CardContent></Card>}>
        <StockSelectorPanel
          stocks={stocks}
          stocksLoading={stocksLoading}
          stocksError={stocksError}
          activeSymbol={activeSymbol}
          activeStock={activeStock}
          onSelectSymbol={onSelectSymbol}
        />
      </Suspense>

      <section className="research-grid">
        <Card>
          <CardContent className="chart-card-content">
            <div className="section-head chart-section-head">
              <div>
                <div className="section-kicker">股票画像</div>
                <h2 className="section-title">已同步基础信息</h2>
                <div className="muted">这里会读取同步任务拉回来的股票、基金、指数和板块扩展元数据。</div>
              </div>
              {activeProfile.indexName ? <div className="badge">{activeProfile.indexName}</div> : null}
            </div>

            <div className="profile-summary-strip">
              <div className="profile-summary-card">
                <span className="profile-summary-label">资料完整度</span>
                <strong className="profile-summary-value">{profileCoverage}/8 项</strong>
                <span className="profile-summary-meta">表示当前股票已有多少基础资料已经同步到位。</span>
              </div>
              <div className="profile-summary-card">
                <span className="profile-summary-label">指数或主题</span>
                <strong className="profile-summary-value">{activeProfile.indexName || "待同步"}</strong>
                <span className="profile-summary-meta">
                  {boardItems.length > 0 ? `已匹配 ${boardItems.length} 个板块标签，便于快速阅读。` : "同步完成后，这里会显示板块和主题信息。"}
                </span>
              </div>
            </div>

            <div className="kline-stats-grid kline-stats-grid-wide">
              {profileFacts.map((item) => (
                <div key={item.label} className="kline-stat-card">
                  <span className="kline-stat-label">{item.label}</span>
                  <span className={`kline-stat-value ${item.ready ? "" : "muted-value"}`}>{item.value}</span>
                </div>
              ))}
            </div>

            {boardItems.length > 0 ? (
              <div className="profile-tag-list">
                {boardItems.map((item) => (
                  <span key={item} className="stock-meta-pill">
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <div className="profile-empty-note">当前股票暂时还没有板块归属信息。</div>
            )}
          </CardContent>
        </Card>

        <div className="research-side-stack">
          <Card>
            <CardContent className="chart-card-content">
              <div className="section-head chart-section-head">
                <div>
                  <div className="section-kicker">会话快照</div>
                  <h2 className="section-title">市场脉搏</h2>
                  <div className="muted">把交易会话状态和策略背景信息压缩到一个紧凑区块里。</div>
                </div>
              </div>

              <div className="research-stat-grid">
                {pulseStats.map((item) => (
                  <div key={item.label} className="research-stat-card">
                    <div className="metric-label">{item.label}</div>
                    <div className={`metric-value ${item.tone}`}>{item.value}</div>
                    <div className="metric-footnote">{item.note}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="chart-card-content">
              <div className="section-head chart-section-head">
                <div>
                  <div className="section-kicker">派生解读</div>
                  <h2 className="section-title">交易上下文</h2>
                  <div className="muted">提炼最近区间里的关键信号，不让页面显得过于卡片化。</div>
                </div>
              </div>

              <div className="research-stat-grid">
                {insightCards.map((item) => (
                  <div key={item.label} className="research-stat-card research-stat-card-soft">
                    <div className="metric-label">{item.label}</div>
                    <div className={`metric-value ${item.tone}`}>{item.value}</div>
                    <div className="metric-footnote">{item.note}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <Suspense fallback={<Card><CardContent><div className="muted">加载策略控制区中...</div></CardContent></Card>}>
        <StrategyPanel
          snapshot={snapshot}
          analysis={analysis}
          connected={connected}
          busy={busy}
          onBuy={onBuy}
          onSell={onSell}
          onStart={onStart}
          onStop={onStop}
        />
      </Suspense>

      {databaseLoading || databaseError || databaseSections.length > 0 ? (
        <section className="database-intelligence-section">
          <div className="database-intelligence-head">
            <div>
              <div className="section-kicker">数据库信息</div>
              <h2 className="section-title">已同步股票数据库明细</h2>
              <div className="muted">
                下方卡片会展示数据库里已经存在的扩展记录，让股票页不仅只有 K 线和板块标签。
              </div>
            </div>
            <div className="database-overview-pills">
              <span className="badge">{database?.sectionCount ?? 0} 个分区</span>
              <span className="badge">{database?.dataPointCount ?? 0} 个数据点</span>
            </div>
          </div>

          {databaseLoading && databaseSections.length === 0 ? (
            <Card>
              <CardContent className="database-card-content">
                <div className="muted">正在加载数据库扩展信息...</div>
              </CardContent>
            </Card>
          ) : null}

          {databaseError ? (
            <Card>
              <CardContent className="database-card-content">
                <div className="error-text">{databaseError}</div>
              </CardContent>
            </Card>
          ) : null}

          {databaseSections.length > 0 ? (
            <div className="database-grid">
              {databaseSections.map((section) => (
                <Card key={section.id}>
                  <CardContent className="database-card-content">
                    <div className="database-card-head">
                      <div>
                        <div className="database-card-title">{section.title}</div>
                        {section.subtitle ? <div className="database-card-subtitle">{section.subtitle}</div> : null}
                      </div>
                      <div className="database-card-meta">
                        <span className="stock-meta-pill">{section.source}</span>
                        {section.updatedAt ? <span className="stock-meta-pill">更新于 {section.updatedAt}</span> : null}
                      </div>
                    </div>

                    <div className="database-item-grid">
                      {section.items.map((item) => (
                        <div key={`${section.id}-${item.label}`} className="database-item-card">
                          <span className="database-item-label">{item.label}</span>
                          <strong className="database-item-value">{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <Card>
        <CardContent className="chart-card-content">
          <div className="section-head chart-section-head">
            <div>
              <div className="section-kicker">价格行为</div>
              <h2 className="section-title">K线图</h2>
              <div className="muted">可以在均线和布林带叠加层之间切换，并对比主图下方的成交量与成交额。</div>
            </div>
            <div className="chart-toolbar">
              <div className="range-switcher">
                {rangeOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`range-pill ${selectedRange === option.key ? "active" : ""}`}
                    onClick={() => onSelectRange(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="range-switcher">
                <button
                  type="button"
                  className={`range-pill ${overlayMode === "ma" ? "active" : ""}`}
                  onClick={() => setOverlayMode("ma")}
                >
                  均线
                </button>
                <button
                  type="button"
                  className={`range-pill ${overlayMode === "boll" ? "active" : ""}`}
                  onClick={() => setOverlayMode("boll")}
                >
                  布林带
                </button>
                <button
                  type="button"
                  className={`range-pill ${subChartMode === "volume" ? "active" : ""}`}
                  onClick={() => setSubChartMode("volume")}
                >
                  成交量
                </button>
                <button
                  type="button"
                  className={`range-pill ${subChartMode === "amount" ? "active" : ""}`}
                  onClick={() => setSubChartMode("amount")}
                >
                  成交额
                </button>
              </div>
            </div>
          </div>

          {candleStats ? (
            <div className="kline-stats-grid kline-stats-grid-wide">
              <div className="kline-stat-card">
                <span className="kline-stat-label">开盘</span>
                <span className="kline-stat-value">{candleStats.latest.open.toFixed(3)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">最高</span>
                <span className="kline-stat-value">{candleStats.latest.high.toFixed(3)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">最低</span>
                <span className="kline-stat-value">{candleStats.latest.low.toFixed(3)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">收盘</span>
                <span className="kline-stat-value">{candleStats.latest.close.toFixed(3)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">成交量</span>
                <span className="kline-stat-value">{formatCompactNumber(candleStats.latest.volume, 1)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">成交额</span>
                <span className="kline-stat-value">{formatCompactNumber(candleStats.latest.amount, 1)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">振幅</span>
                <span className="kline-stat-value">{candleStats.amplitude.toFixed(2)}%</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">区间最高</span>
                <span className="kline-stat-value">{candleStats.periodHigh.toFixed(3)}</span>
              </div>
              <div className="kline-stat-card">
                <span className="kline-stat-label">区间最低</span>
                <span className="kline-stat-value">{candleStats.periodLow.toFixed(3)}</span>
              </div>
            </div>
          ) : null}

          <Suspense fallback={<div className="muted">加载 K 线图中...</div>}>
            <KLineChart candles={orderedCandles} overlayMode={overlayMode} subChartMode={subChartMode} />
          </Suspense>
        </CardContent>
      </Card>

      <div className="analytics-grid">
        <Card>
          <CardContent className="chart-card-content">
            <div className="section-head chart-section-head">
              <div>
                <div className="section-kicker">动能</div>
                <h2 className="section-title">MACD</h2>
                <div className="muted">跟踪 DIF、DEA 和柱状图，观察动能变化与可能的拐点。</div>
              </div>
            </div>

            <Suspense fallback={<div className="muted">加载 MACD 图中...</div>}>
              <MacdChart candles={orderedCandles} />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="chart-card-content">
            <div className="section-head chart-section-head">
              <div>
                <div className="section-kicker">收益曲线</div>
                <h2 className="section-title">区间表现</h2>
                <div className="muted">基于所选时间窗口内的真实收盘价，构建标准化收益曲线。</div>
              </div>
              <div className="badge">{summary?.bars ?? snapshot?.candles?.length ?? 0} 根K线</div>
            </div>

            <div className="return-stats-grid">
              <div className="return-stat-card">
                <span className="return-stat-label">起始收盘</span>
                <span className="return-stat-value">{returnStats.startClose ? returnStats.startClose.toFixed(3) : "-"}</span>
              </div>
              <div className="return-stat-card">
                <span className="return-stat-label">最新收盘</span>
                <span className="return-stat-value">{returnStats.latestClose ? returnStats.latestClose.toFixed(3) : "-"}</span>
              </div>
              <div className="return-stat-card">
                <span className={`return-stat-value ${returnStats.totalReturnPct >= 0 ? "metric-positive" : "metric-negative"}`}>
                  {formatSignedPercent(returnStats.totalReturnPct)}
                </span>
                <span className="return-stat-label">累计收益</span>
              </div>
              <div className="return-stat-card">
                <span className="return-stat-value metric-negative">{formatSignedPercent(returnStats.maxDrawdownPct)}</span>
                <span className="return-stat-label">最大回撤</span>
              </div>
            </div>

            <Suspense fallback={<div className="muted">加载收益曲线中...</div>}>
              <EquityChart equity={returnStats.curve} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

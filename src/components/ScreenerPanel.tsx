import { useEffect, useMemo, useState } from "react";
import type {
  ScreenerBucket,
  ScreenerCandidate,
  ScreenerPreset,
  ScreenerQueryOptions,
  ScreenerSnapshot,
} from "../types/type";
import { Button, Card, CardContent } from "./ui";
import {
  formatStanceLabel,
  formatStrategySignalLabel,
  translateStrategyText,
} from "../utils/marketI18n";

type Props = {
  screener: ScreenerSnapshot | null;
  loading: boolean;
  error: string;
  currentTop: number;
  screenerFilters: ScreenerQueryOptions;
  onRefresh: () => Promise<void>;
  onChangeTop: (top: number) => void;
  onChangeScreenerFilters: (filters: ScreenerQueryOptions) => void;
  onResetScreenerFilters: () => void;
  onSelectSymbol: (symbol: string) => void;
};

type ScreenerFamily = "LONG_TERM" | "STOCK_PICKING";
type FavoriteGroup = "WATCH" | "BUYLIST" | "HOLDING";
type SignalFilter = "ALL" | "PASS" | "WATCH" | "AVOID";
type FlowFilter =
  | "ALL"
  | "STRONG_INFLOW"
  | "INFLOW"
  | "NEUTRAL"
  | "OUTFLOW"
  | "STRONG_OUTFLOW";
type StyleFilter =
  | "ALL"
  | "CAPACITY_CORE"
  | "THEME_MOMENTUM"
  | "ACTIVE_TRADER"
  | "STEADY_ACCUMULATION"
  | "STANDARD";
type SortMode =
  | "FIT"
  | "MODEL"
  | "CHANGE"
  | "PRICE"
  | "LIQUIDITY"
  | "PRIORITY"
  | "ALIGNMENT"
  | "MONEYFLOW"
  | "THEME"
  | "NAME";
type ScreenerBucketEntry = ScreenerBucket & { family: ScreenerFamily };

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
type ScreenerWorkspaceState = {
  scopeFilter: "ALL" | ScreenerFamily;
  strategyFilter: string;
  signalFilter: SignalFilter;
  exchangeFilter: string;
  marketFilter: string;
  flowFilter: FlowFilter;
  styleFilter: StyleFilter;
  industryFilter: string;
  areaFilter: string;
  searchText: string;
  favoritesOnly: boolean;
  sortMode: SortMode;
  compactMode: boolean;
  tradeFilterExpanded: boolean;
  workspaceFilterExpanded: boolean;
};

type FavoriteCandidate = ScreenerCandidate & {
  familyLabel: string;
  strategyName: string;
  favorite: FavoriteRecord;
};

type IntersectionCandidate = ScreenerCandidate & {
  matches: number;
  strategyNames: string[];
  familyLabels: string[];
  bestFitScore: number;
  averageModelScore: number;
};

type ActionBoardTone = "positive" | "warm" | "alert" | "neutral";

type ActionBoardCard = {
  id: string;
  title: string;
  count: number;
  copy: string;
  symbols: string[];
  tone: ActionBoardTone;
};

type ScreenerPulseCard = {
  id: string;
  title: string;
  value: string;
  detail: string;
  tone: ActionBoardTone;
};

type BoardResonanceCard = {
  boardName: string;
  candidateCount: number;
  passCount: number;
  avgFitScore: number;
  avgPriorityScore: number;
  avgFlowStrength: number;
  avgDailyChange: number;
  avgThemeHeat: number;
  hotCount: number;
  overheatCount: number;
  rotationSignal: string;
  boardRisk: string;
  historySignal: string;
  deltaPriorityScore: number;
  deltaFlowStrength: number;
  previousCandidateCount: number;
  tone: ActionBoardTone;
  symbols: string[];
};

type BoardResonanceSnapshot = {
  candidateCount: number;
  passCount: number;
  avgFitScore: number;
  avgPriorityScore: number;
  avgFlowStrength: number;
  avgDailyChange: number;
  avgThemeHeat: number;
  hotCount: number;
  overheatCount: number;
  rotationSignal: string;
  boardRisk: string;
  symbols: string[];
};

type BoardHistoryStore = {
  latestUpdatedAt?: string;
  previousUpdatedAt?: string;
  latestBoards: Record<string, BoardResonanceSnapshot>;
  previousBoards: Record<string, BoardResonanceSnapshot>;
};

const FAVORITES_STORAGE_KEY = "quant.screener.favorites.v3";
const LEGACY_FAVORITES_STORAGE_KEY = "quant.screener.favorites.v2";
const SCREENER_WORKSPACE_STORAGE_KEY = "quant.screener.workspace.v1";
const BOARD_HISTORY_STORAGE_KEY = "quant.screener.board-history.v1";
const TOP_OPTIONS = [6, 12, 20] as const;
const DEFAULT_WORKSPACE_STATE: ScreenerWorkspaceState = {
  scopeFilter: "ALL",
  strategyFilter: "ALL",
  signalFilter: "ALL",
  exchangeFilter: "ALL",
  marketFilter: "ALL",
  flowFilter: "ALL",
  styleFilter: "ALL",
  industryFilter: "ALL",
  areaFilter: "ALL",
  searchText: "",
  favoritesOnly: false,
  sortMode: "FIT",
  compactMode: true,
  tradeFilterExpanded: false,
  workspaceFilterExpanded: false,
};

const FAVORITE_GROUP_OPTIONS: Array<{ value: FavoriteGroup; label: string }> = [
  { value: "WATCH", label: "观察" },
  { value: "BUYLIST", label: "买入清单" },
  { value: "HOLDING", label: "持仓" },
];

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: "FIT", label: "匹配分" },
  { value: "MODEL", label: "模型分" },
  { value: "CHANGE", label: "当日涨跌" },
  { value: "PRICE", label: "最新价" },
  { value: "LIQUIDITY", label: "流动性" },
  { value: "PRIORITY", label: "综合优先" },
  { value: "ALIGNMENT", label: "策略契合" },
  { value: "MONEYFLOW", label: "资金流向" },
  { value: "THEME", label: "题材热度" },
  { value: "NAME", label: "名称" },
];

const SCREENER_PRESET_OPTIONS: Array<{ value: ScreenerPreset; label: string }> =
  [
    { value: "aggressive", label: "激进" },
    { value: "balanced", label: "均衡" },
    { value: "conservative", label: "稳健" },
    { value: "custom", label: "自定义" },
  ];

function buildPresetLabel(value?: ScreenerPreset | string | null) {
  return (
    SCREENER_PRESET_OPTIONS.find((item) => item.value === value)?.label ??
    "均衡"
  );
}

const SCREENER_PRESET_FILTERS: Record<
  Exclude<ScreenerPreset, "custom">,
  ScreenerQueryOptions
> = {
  aggressive: {
    preset: "aggressive",
    minAvgAmountK: 150000,
    minLatestAmountK: 80000,
    minFloatMarketCapW: 200000,
    minTotalMarketCapW: 0,
    minListedDays: 60,
    excludeSt: true,
    excludeBse: true,
    excludeSuspended: true,
    excludeNonListingStatus: true,
  },
  balanced: {
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
  },
  conservative: {
    preset: "conservative",
    minAvgAmountK: 500000,
    minLatestAmountK: 300000,
    minFloatMarketCapW: 1000000,
    minTotalMarketCapW: 0,
    minListedDays: 180,
    excludeSt: true,
    excludeBse: true,
    excludeSuspended: true,
    excludeNonListingStatus: true,
  },
};

function nowIso() {
  return new Date().toISOString();
}

function formatSignedPercent(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatPrice(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }
  return value.toFixed(3);
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

function getSecurityTypeLabel(type?: string | null) {
  if (type === "fund") {
    return "基金";
  }
  if (type === "index") {
    return "指数";
  }
  if (type === "bond") {
    return "债券";
  }
  if (type === "etf") {
    return "ETF";
  }
  if (type === "stock") {
    return "股票";
  }
  return type || "未知";
}

function formatNumber(value?: number, digits = 2) {
  if (value === undefined || value === null) {
    return "-";
  }
  return value.toFixed(digits);
}

function formatCompactFlow(value?: number) {
  if (value === undefined || value === null) {
    return "-";
  }
  const absolute = Math.abs(value);
  if (absolute >= 100000000) {
    return `${(value / 100000000).toFixed(2)}亿`;
  }
  if (absolute >= 10000) {
    return `${(value / 10000).toFixed(2)}万`;
  }
  return value.toFixed(0);
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

function buildFlowLabel(value?: string) {
  if (value === "STRONG_INFLOW") {
    return "强流入";
  }
  if (value === "INFLOW") {
    return "流入";
  }
  if (value === "OUTFLOW") {
    return "流出";
  }
  if (value === "STRONG_OUTFLOW") {
    return "强流出";
  }
  if (value === "NEUTRAL") {
    return "中性";
  }
  return "未知";
}

function buildStyleLabel(value?: string) {
  if (value === "CAPACITY_CORE") {
    return "容量核心";
  }
  if (value === "THEME_MOMENTUM") {
    return "题材联动";
  }
  if (value === "ACTIVE_TRADER") {
    return "活跃弹性";
  }
  if (value === "STEADY_ACCUMULATION") {
    return "稳步吸筹";
  }
  if (value === "STANDARD") {
    return "常规跟踪";
  }
  return "未分类";
}

function buildThemeTierLabel(value?: string) {
  if (value === "HOT") {
    return "热";
  }
  if (value === "WARM") {
    return "温";
  }
  return "冷";
}

function buildCrowdingLabel(value?: string) {
  if (value === "OVERCROWDED") {
    return "过热拥挤";
  }
  if (value === "ACTIVE") {
    return "活跃";
  }
  return "平稳";
}

function buildTrendBiasLabel(value?: string) {
  if (value === "BULLISH") {
    return "多头";
  }
  if (value === "STABLE") {
    return "偏强";
  }
  if (value === "WEAK") {
    return "偏弱";
  }
  if (value === "NEUTRAL") {
    return "中性";
  }
  return value || "未知";
}

function buildValuationBandLabel(value?: string) {
  if (value === "VALUE") {
    return "价值区";
  }
  if (value === "BALANCED") {
    return "均衡区";
  }
  if (value === "PREMIUM") {
    return "溢价区";
  }
  return value || "未知";
}

function buildRotationLabel(value?: string) {
  if (value === "HEATING_UP") {
    return "升温扩散";
  }
  if (value === "FLOW_BACK") {
    return "资金回流";
  }
  if (value === "OVERHEATED") {
    return "高位拥挤";
  }
  if (value === "COOLING_DOWN") {
    return "热度回落";
  }
  return "轮动观察";
}

function buildBoardRiskLabel(value?: string) {
  if (value === "CHASING_RISK") {
    return "追高风险";
  }
  if (value === "TRACKABLE") {
    return "可跟踪";
  }
  return "分歧观察";
}

function buildHistorySignalLabel(value?: string) {
  if (value === "NEW_ENTRY") {
    return "新上榜";
  }
  if (value === "STRENGTHENING") {
    return "趋势增强";
  }
  if (value === "WEAKENING") {
    return "趋势转弱";
  }
  if (value === "STABLE_STRONG") {
    return "持续强势";
  }
  return "横向观察";
}

function formatFilterRuleLabel(key: string, fallback: string) {
  const mapping: Record<string, string> = {
    minAvgAmountK: "20日均成交额",
    minLatestAmountK: "最新成交额",
    minFloatMarketCapW: "流通市值",
    minTotalMarketCapW: "总市值",
    minListedDays: "最少上市天数",
    excludeSt: "剔除 ST",
    excludeBse: "剔除北交所",
    excludeSuspended: "剔除停牌",
    excludeNonListingStatus: "剔除异常上市状态",
  };
  return mapping[key] || fallback;
}

function formatFilterReasonLabel(key: string, fallback: string) {
  const mapping: Record<string, string> = {
    avg_amount: "20日均成交额不足",
    latest_amount: "最新成交额不足",
    float_market_cap: "流通市值过小",
    total_market_cap: "总市值过小",
    listed_days: "上市时间过短",
    st: "ST 已剔除",
    bse: "北交所已剔除",
    suspended: "停牌已剔除",
    list_status: "异常上市状态已剔除",
  };
  return mapping[key] || fallback;
}

function formatStrategyMetricLabel(value: string) {
  const mapping: Record<string, string> = {
    "Price vs MA250": "价格偏离 MA250",
    "250-bar return": "250日回报",
    "60-day forecast": "60日预测",
    Volatility: "波动率",
    Trend: "趋势",
    "Vs MA20": "偏离 MA20",
    "Vs MA60": "偏离 MA60",
    Valuation: "估值",
    "20d avg amount": "20日均成交额",
    "Float mcap": "流通市值",
    Turnover: "换手率",
    "Volume ratio": "量比",
    "Net money flow": "净流入",
    "Flow strength": "资金强度",
    "Theme heat": "题材热度",
  };
  return mapping[value] || value;
}

function addLabelCount(
  counts: Map<string, number>,
  rawValue: string | null | undefined,
) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return;
  }
  counts.set(value, (counts.get(value) || 0) + 1);
}

function pickMostFrequentCount(counts: Map<string, number>) {
  let topLabel = "";
  let topCount = 0;
  for (const [label, count] of counts.entries()) {
    if (count > topCount) {
      topLabel = label;
      topCount = count;
    }
  }

  return {
    label: topLabel,
    count: topCount,
  };
}

function buildCandidateMeta(candidate: ScreenerCandidate) {
  const boardMeta =
    candidate.boardCount && candidate.boardCount > 0
      ? `${candidate.boardCount} 个同花顺板块`
      : "";
  return [
    candidate.symbol,
    candidate.exchange,
    candidate.market,
    candidate.industry,
    candidate.area,
    boardMeta,
  ]
    .filter(Boolean)
    .join(" / ");
}

function splitBoardNames(boardNames?: string | null) {
  return String(boardNames || "")
    .split(" / ")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildFamilyLabel(family: ScreenerFamily) {
  return family === "LONG_TERM" ? "长线策略" : "选股策略";
}

function buildFavoriteLabel(group: FavoriteGroup) {
  return (
    FAVORITE_GROUP_OPTIONS.find((item) => item.value === group)?.label ?? group
  );
}

function addTrimmedOption(target: Set<string>, value?: string | number | null) {
  const normalized = String(value ?? "").trim();
  if (normalized) {
    target.add(normalized);
  }
}

function buildCsvValue(value: string | number | null | undefined) {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function buildBoardSnapshotMap(items: BoardResonanceCard[]) {
  const snapshotEntries = items.map((item) => [
    item.boardName,
    {
      candidateCount: item.candidateCount,
      passCount: item.passCount,
      avgFitScore: item.avgFitScore,
      avgPriorityScore: item.avgPriorityScore,
      avgFlowStrength: item.avgFlowStrength,
      avgDailyChange: item.avgDailyChange,
      avgThemeHeat: item.avgThemeHeat,
      hotCount: item.hotCount,
      overheatCount: item.overheatCount,
      rotationSignal: item.rotationSignal,
      boardRisk: item.boardRisk,
      symbols: item.symbols,
    } satisfies BoardResonanceSnapshot,
  ]);
  return Object.fromEntries(snapshotEntries) as Record<
    string,
    BoardResonanceSnapshot
  >;
}

function exportCandidatesToCsv(rows: Array<Record<string, string | number>>) {
  const headers = [
    "family",
    "strategy",
    "rank",
    "symbol",
    "name",
    "exchange",
    "market",
    "industry",
    "area",
    "boardNames",
    "boardCount",
    "latestClose",
    "dailyChangePct",
    "fitScore",
    "signal",
    "overallScore",
    "latestAmount",
    "avgAmount20d",
    "floatMarketCap",
    "totalMarketCap",
    "turnoverRate",
    "volumeRatio",
    "netMoneyFlow",
    "capitalFlowStrengthPct",
    "capitalFlowLabel",
    "marketStyle",
    "themeHeatScore",
    "themeHeatTier",
    "crowdingRisk",
    "strategyAlignmentScore",
    "priorityScore",
    "liquidityScore",
    "liquidityTier",
    "stance",
    "favoriteGroup",
    "favoriteNote",
    "favoriteTargetPrice",
    "favoriteStopPrice",
    "favoriteHoldingHorizon",
    "favoriteAddedAt",
    "favoriteUpdatedAt",
    "summary",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => buildCsvValue(row[header])).join(","),
    ),
  ];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `stock-screener-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function readFavoriteStore(): FavoriteStore {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Partial<FavoriteRecord>>;
      if (parsed && typeof parsed === "object") {
        const next: FavoriteStore = {};
        for (const [symbol, value] of Object.entries(parsed)) {
          const group = value?.group;
          if (group !== "WATCH" && group !== "BUYLIST" && group !== "HOLDING") {
            continue;
          }
          next[symbol] = {
            group,
            note: typeof value?.note === "string" ? value.note : "",
            targetPrice:
              typeof value?.targetPrice === "string" ? value.targetPrice : "",
            stopPrice:
              typeof value?.stopPrice === "string" ? value.stopPrice : "",
            holdingHorizon:
              typeof value?.holdingHorizon === "string"
                ? value.holdingHorizon
                : "",
            addedAt:
              typeof value?.addedAt === "string" && value.addedAt
                ? value.addedAt
                : nowIso(),
            updatedAt:
              typeof value?.updatedAt === "string" && value.updatedAt
                ? value.updatedAt
                : nowIso(),
          };
        }
        return next;
      }
    }

    const legacyRaw = localStorage.getItem(LEGACY_FAVORITES_STORAGE_KEY);
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

function writeJsonStorageIfChanged(key: string, value: unknown) {
  const serialized = JSON.stringify(value);
  if (localStorage.getItem(key) !== serialized) {
    localStorage.setItem(key, serialized);
  }
}

function writeFavoriteStore(store: FavoriteStore) {
  writeJsonStorageIfChanged(FAVORITES_STORAGE_KEY, store);
}

function readBoardHistoryStore(): BoardHistoryStore {
  try {
    const raw = localStorage.getItem(BOARD_HISTORY_STORAGE_KEY);
    if (!raw) {
      return {
        latestBoards: {},
        previousBoards: {},
      };
    }
    const parsed = JSON.parse(raw) as Partial<BoardHistoryStore>;
    return {
      latestUpdatedAt:
        typeof parsed.latestUpdatedAt === "string"
          ? parsed.latestUpdatedAt
          : undefined,
      previousUpdatedAt:
        typeof parsed.previousUpdatedAt === "string"
          ? parsed.previousUpdatedAt
          : undefined,
      latestBoards:
        parsed.latestBoards && typeof parsed.latestBoards === "object"
          ? parsed.latestBoards
          : {},
      previousBoards:
        parsed.previousBoards && typeof parsed.previousBoards === "object"
          ? parsed.previousBoards
          : {},
    };
  } catch {
    return {
      latestBoards: {},
      previousBoards: {},
    };
  }
}

function writeBoardHistoryStore(store: BoardHistoryStore) {
  writeJsonStorageIfChanged(BOARD_HISTORY_STORAGE_KEY, store);
}

function readWorkspaceState(): ScreenerWorkspaceState {
  try {
    const raw = localStorage.getItem(SCREENER_WORKSPACE_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_WORKSPACE_STATE;
    }
    const parsed = JSON.parse(raw) as Partial<ScreenerWorkspaceState>;
    return {
      scopeFilter:
        parsed.scopeFilter === "LONG_TERM" ||
        parsed.scopeFilter === "STOCK_PICKING"
          ? parsed.scopeFilter
          : "ALL",
      strategyFilter:
        typeof parsed.strategyFilter === "string" && parsed.strategyFilter
          ? parsed.strategyFilter
          : "ALL",
      signalFilter:
        parsed.signalFilter === "PASS" ||
        parsed.signalFilter === "WATCH" ||
        parsed.signalFilter === "AVOID"
          ? parsed.signalFilter
          : "ALL",
      exchangeFilter:
        typeof parsed.exchangeFilter === "string" && parsed.exchangeFilter
          ? parsed.exchangeFilter
          : "ALL",
      marketFilter:
        typeof parsed.marketFilter === "string" && parsed.marketFilter
          ? parsed.marketFilter
          : "ALL",
      flowFilter:
        parsed.flowFilter === "STRONG_INFLOW" ||
        parsed.flowFilter === "INFLOW" ||
        parsed.flowFilter === "NEUTRAL" ||
        parsed.flowFilter === "OUTFLOW" ||
        parsed.flowFilter === "STRONG_OUTFLOW"
          ? parsed.flowFilter
          : "ALL",
      styleFilter:
        parsed.styleFilter === "CAPACITY_CORE" ||
        parsed.styleFilter === "THEME_MOMENTUM" ||
        parsed.styleFilter === "ACTIVE_TRADER" ||
        parsed.styleFilter === "STEADY_ACCUMULATION" ||
        parsed.styleFilter === "STANDARD"
          ? parsed.styleFilter
          : "ALL",
      industryFilter:
        typeof parsed.industryFilter === "string" && parsed.industryFilter
          ? parsed.industryFilter
          : "ALL",
      areaFilter:
        typeof parsed.areaFilter === "string" && parsed.areaFilter
          ? parsed.areaFilter
          : "ALL",
      searchText:
        typeof parsed.searchText === "string" ? parsed.searchText : "",
      favoritesOnly: Boolean(parsed.favoritesOnly),
      sortMode:
        parsed.sortMode === "MODEL" ||
        parsed.sortMode === "CHANGE" ||
        parsed.sortMode === "PRICE" ||
        parsed.sortMode === "LIQUIDITY" ||
        parsed.sortMode === "PRIORITY" ||
        parsed.sortMode === "ALIGNMENT" ||
        parsed.sortMode === "MONEYFLOW" ||
        parsed.sortMode === "THEME" ||
        parsed.sortMode === "NAME"
          ? parsed.sortMode
          : "FIT",
      compactMode:
        typeof parsed.compactMode === "boolean"
          ? parsed.compactMode
          : DEFAULT_WORKSPACE_STATE.compactMode,
      tradeFilterExpanded:
        typeof parsed.tradeFilterExpanded === "boolean"
          ? parsed.tradeFilterExpanded
          : DEFAULT_WORKSPACE_STATE.tradeFilterExpanded,
      workspaceFilterExpanded:
        typeof parsed.workspaceFilterExpanded === "boolean"
          ? parsed.workspaceFilterExpanded
          : DEFAULT_WORKSPACE_STATE.workspaceFilterExpanded,
    };
  } catch {
    return DEFAULT_WORKSPACE_STATE;
  }
}

function writeWorkspaceState(state: ScreenerWorkspaceState) {
  writeJsonStorageIfChanged(SCREENER_WORKSPACE_STORAGE_KEY, state);
}

function compareCandidates(
  left: ScreenerCandidate,
  right: ScreenerCandidate,
  sortMode: SortMode,
) {
  if (sortMode === "FIT") {
    return (
      right.fitScore - left.fitScore ||
      (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
      (right.strategyAlignmentScore ?? 0) -
        (left.strategyAlignmentScore ?? 0) ||
      right.overallScore - left.overallScore ||
      left.symbol.localeCompare(right.symbol)
    );
  }
  if (sortMode === "MODEL") {
    return (
      (right.overallScoreNormalized ?? right.overallScore) -
        (left.overallScoreNormalized ?? left.overallScore) ||
      right.overallScore - left.overallScore ||
      (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
      (right.strategyAlignmentScore ?? 0) -
        (left.strategyAlignmentScore ?? 0) ||
      right.fitScore - left.fitScore ||
      left.symbol.localeCompare(right.symbol)
    );
  }
  if (sortMode === "CHANGE") {
    return (
      right.dailyChangePct - left.dailyChangePct ||
      right.fitScore - left.fitScore ||
      left.symbol.localeCompare(right.symbol)
    );
  }
  if (sortMode === "PRICE") {
    return (
      right.latestClose - left.latestClose ||
      right.fitScore - left.fitScore ||
      left.symbol.localeCompare(right.symbol)
    );
  }
  if (sortMode === "LIQUIDITY") {
    return (
      (right.liquidityScore ?? 0) - (left.liquidityScore ?? 0) ||
      (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
      (right.strategyAlignmentScore ?? 0) -
        (left.strategyAlignmentScore ?? 0) ||
      right.fitScore - left.fitScore ||
      right.overallScore - left.overallScore ||
      left.symbol.localeCompare(right.symbol)
    );
  }
  if (sortMode === "PRIORITY") {
    return (
      (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
      (right.strategyAlignmentScore ?? 0) -
        (left.strategyAlignmentScore ?? 0) ||
      right.fitScore - left.fitScore ||
      right.overallScore - left.overallScore ||
      left.symbol.localeCompare(right.symbol)
    );
  }
  if (sortMode === "ALIGNMENT") {
    return (
      (right.strategyAlignmentScore ?? 0) -
        (left.strategyAlignmentScore ?? 0) ||
      (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
      (right.positionCapPct ?? 0) - (left.positionCapPct ?? 0) ||
      right.fitScore - left.fitScore ||
      right.overallScore - left.overallScore ||
      left.symbol.localeCompare(right.symbol)
    );
  }
  if (sortMode === "MONEYFLOW") {
    return (
      (right.capitalFlowStrengthPct ?? 0) -
        (left.capitalFlowStrengthPct ?? 0) ||
      (right.netMoneyFlow ?? 0) - (left.netMoneyFlow ?? 0) ||
      (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
      (right.strategyAlignmentScore ?? 0) -
        (left.strategyAlignmentScore ?? 0) ||
      right.fitScore - left.fitScore ||
      left.symbol.localeCompare(right.symbol)
    );
  }
  if (sortMode === "THEME") {
    return (
      (right.themeHeatScore ?? 0) - (left.themeHeatScore ?? 0) ||
      (right.boardCount ?? 0) - (left.boardCount ?? 0) ||
      (right.volumeRatio ?? 0) - (left.volumeRatio ?? 0) ||
      (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
      right.fitScore - left.fitScore ||
      left.symbol.localeCompare(right.symbol)
    );
  }
  return (
    left.name.localeCompare(right.name, "zh-CN") ||
    left.symbol.localeCompare(right.symbol)
  );
}

function buildFavoriteCandidates(
  allBuckets: ScreenerBucketEntry[],
  favorites: FavoriteStore,
) {
  const lookup = new Map<string, FavoriteCandidate>();
  for (const bucket of allBuckets) {
    for (const candidate of bucket.topCandidates) {
      const favorite = favorites[candidate.symbol];
      if (!favorite || lookup.has(candidate.symbol)) {
        continue;
      }
      lookup.set(candidate.symbol, {
        ...candidate,
        familyLabel: buildFamilyLabel(bucket.family),
        strategyName: translateStrategyText(bucket.name) || bucket.name,
        favorite,
      });
    }
  }

  const values = Array.from(lookup.values()).sort(
    (left, right) =>
      new Date(right.favorite.updatedAt).getTime() -
        new Date(left.favorite.updatedAt).getTime() ||
      left.symbol.localeCompare(right.symbol),
  );

  return {
    WATCH: values.filter((item) => item.favorite.group === "WATCH"),
    BUYLIST: values.filter((item) => item.favorite.group === "BUYLIST"),
    HOLDING: values.filter((item) => item.favorite.group === "HOLDING"),
  };
}

function buildIntersectionCandidates(buckets: ScreenerBucketEntry[]) {
  const lookup = new Map<
    string,
    {
      base: ScreenerCandidate;
      strategyNames: Set<string>;
      familyLabels: Set<string>;
      fitScores: number[];
      modelScores: number[];
    }
  >();

  for (const bucket of buckets) {
    for (const candidate of bucket.topCandidates) {
      const current = lookup.get(candidate.symbol);
      if (!current) {
        lookup.set(candidate.symbol, {
          base: candidate,
          strategyNames: new Set([
            translateStrategyText(bucket.name) || bucket.name,
          ]),
          familyLabels: new Set([buildFamilyLabel(bucket.family)]),
          fitScores: [candidate.fitScore],
          modelScores: [candidate.overallScore],
        });
        continue;
      }

      current.strategyNames.add(
        translateStrategyText(bucket.name) || bucket.name,
      );
      current.familyLabels.add(buildFamilyLabel(bucket.family));
      current.fitScores.push(candidate.fitScore);
      current.modelScores.push(candidate.overallScore);
      if (
        candidate.fitScore > current.base.fitScore ||
        (candidate.fitScore === current.base.fitScore &&
          (candidate.priorityScore ?? 0) > (current.base.priorityScore ?? 0)) ||
        (candidate.fitScore === current.base.fitScore &&
          (candidate.priorityScore ?? 0) ===
            (current.base.priorityScore ?? 0) &&
          candidate.overallScore > current.base.overallScore)
      ) {
        current.base = candidate;
      }
    }
  }

  return Array.from(lookup.values())
    .filter((item) => item.strategyNames.size >= 2)
    .map<IntersectionCandidate>((item) => ({
      ...item.base,
      matches: item.strategyNames.size,
      strategyNames: Array.from(item.strategyNames),
      familyLabels: Array.from(item.familyLabels),
      bestFitScore: Math.max(...item.fitScores),
      averageModelScore:
        item.modelScores.reduce((sum, value) => sum + value, 0) /
        Math.max(1, item.modelScores.length),
    }))
    .sort(
      (left, right) =>
        right.matches - left.matches ||
        right.bestFitScore - left.bestFitScore ||
        right.averageModelScore - left.averageModelScore ||
        left.symbol.localeCompare(right.symbol),
    );
}

function buildUniqueCandidates(buckets: ScreenerBucketEntry[]) {
  const lookup = new Map<string, ScreenerCandidate>();
  for (const bucket of buckets) {
    for (const candidate of bucket.topCandidates) {
      const current = lookup.get(candidate.symbol);
      if (
        !current ||
        candidate.fitScore > current.fitScore ||
        (candidate.fitScore === current.fitScore &&
          (candidate.priorityScore ?? 0) > (current.priorityScore ?? 0)) ||
        (candidate.fitScore === current.fitScore &&
          (candidate.priorityScore ?? 0) === (current.priorityScore ?? 0) &&
          candidate.overallScore > current.overallScore)
      ) {
        lookup.set(candidate.symbol, candidate);
      }
    }
  }
  return Array.from(lookup.values());
}

function FavoriteSection({
  title,
  items,
  onSelectSymbol,
  onUpdateFavoriteGroup,
  onRemoveFavorite,
  onUpdateFavoriteNote,
  onUpdateFavoriteField,
}: {
  title: string;
  items: FavoriteCandidate[];
  onSelectSymbol: (symbol: string) => void;
  onUpdateFavoriteGroup: (symbol: string, group: FavoriteGroup) => void;
  onRemoveFavorite: (symbol: string) => void;
  onUpdateFavoriteNote: (symbol: string, note: string) => void;
  onUpdateFavoriteField: (
    symbol: string,
    field: "targetPrice" | "stopPrice" | "holdingHorizon",
    value: string,
  ) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="favorite-group-card">
      <div className="favorite-group-head">
        <div>
          <div className="favorite-group-title">{title}</div>
          <div className="favorite-group-meta">{items.length} 只股票</div>
        </div>
      </div>

      <div className="favorite-group-list">
        {items.map((candidate) => (
          <div
            key={`favorite-${candidate.favorite.group}-${candidate.symbol}`}
            className="favorite-item-card"
          >
            <div className="favorite-item-copy">
              <div className="favorite-item-name">{candidate.name}</div>
              <div className="favorite-item-meta">
                {candidate.symbol} / {candidate.strategyName} /{" "}
                {candidate.familyLabel}
              </div>
              <div className="favorite-item-time">
                创建于 {formatDateTime(candidate.favorite.addedAt)} / 更新于{" "}
                {formatDateTime(candidate.favorite.updatedAt)}
              </div>
              <div className="favorite-track-grid">
                <label className="favorite-track-field">
                  <span>目标价</span>
                  <input
                    className="favorite-track-input"
                    value={candidate.favorite.targetPrice}
                    onChange={(event) =>
                      onUpdateFavoriteField(
                        candidate.symbol,
                        "targetPrice",
                        event.target.value,
                      )
                    }
                    placeholder="填写目标价"
                  />
                </label>
                <label className="favorite-track-field">
                  <span>止损价</span>
                  <input
                    className="favorite-track-input"
                    value={candidate.favorite.stopPrice}
                    onChange={(event) =>
                      onUpdateFavoriteField(
                        candidate.symbol,
                        "stopPrice",
                        event.target.value,
                      )
                    }
                    placeholder="填写止损价"
                  />
                </label>
                <label className="favorite-track-field">
                  <span>持有周期</span>
                  <input
                    className="favorite-track-input"
                    value={candidate.favorite.holdingHorizon}
                    onChange={(event) =>
                      onUpdateFavoriteField(
                        candidate.symbol,
                        "holdingHorizon",
                        event.target.value,
                      )
                    }
                    placeholder="如 1-3 个月 / 1 年"
                  />
                </label>
              </div>
              <textarea
                className="favorite-note-input"
                value={candidate.favorite.note}
                onChange={(event) =>
                  onUpdateFavoriteNote(candidate.symbol, event.target.value)
                }
                placeholder="记录这只股票的计划、验证点或风险提醒"
                rows={2}
              />
            </div>
            <div className="favorite-item-actions">
              <select
                className="screener-select favorite-group-select"
                value={candidate.favorite.group}
                onChange={(event) =>
                  onUpdateFavoriteGroup(
                    candidate.symbol,
                    event.target.value as FavoriteGroup,
                  )
                }
              >
                {FAVORITE_GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                onClick={() => onSelectSymbol(candidate.symbol)}
              >
                查看
              </Button>
              <button
                type="button"
                className="favorite-chip"
                onClick={() => onRemoveFavorite(candidate.symbol)}
              >
                移除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IntersectionSection({
  items,
  favorites,
  onSelectSymbol,
  onToggleFavorite,
}: {
  items: IntersectionCandidate[];
  favorites: FavoriteStore;
  onSelectSymbol: (symbol: string) => void;
  onToggleFavorite: (symbol: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="intersection-section">
      <div className="strategy-section-head">
        <div>
          <div className="section-kicker">高共识机会</div>
          <h3 className="strategy-section-title">多策略交集</h3>
          <div className="muted">
            这里展示在当前筛选条件下，同时出现在两个及以上策略池中的股票。
          </div>
        </div>
      </div>

      <div className="intersection-grid">
        {items.map((candidate) => {
          const favorite = favorites[candidate.symbol];
          return (
            <div
              key={`intersection-${candidate.symbol}`}
              className="intersection-card"
            >
              <div className="intersection-card-head">
                <div>
                  <div className="intersection-card-name">{candidate.name}</div>
                  <div className="intersection-card-meta">
                    {buildCandidateMeta(candidate) || candidate.symbol}
                  </div>
                </div>
                <span className="badge">{candidate.matches} 个命中</span>
              </div>

              <div className="intersection-stat-row">
                <div className="screener-stat-chip">
                  <span>最佳匹配分</span>
                  <strong>{candidate.bestFitScore}%</strong>
                </div>
                <div className="screener-stat-chip">
                  <span>平均模型分</span>
                  <strong>{candidate.averageModelScore.toFixed(2)}</strong>
                </div>
                <div className="screener-stat-chip">
                  <span>综合优先</span>
                  <strong>
                    {candidate.priorityScore !== undefined &&
                    candidate.priorityScore !== null
                      ? Math.round(candidate.priorityScore)
                      : "-"}
                  </strong>
                </div>
                <div className="screener-stat-chip">
                  <span>当日涨跌</span>
                  <strong
                    className={
                      candidate.dailyChangePct >= 0
                        ? "metric-positive"
                        : "metric-negative"
                    }
                  >
                    {formatSignedPercent(candidate.dailyChangePct)}
                  </strong>
                </div>
              </div>

              <div className="intersection-chip-row">
                {candidate.capitalFlowLabel ? (
                  <span className="stock-meta-pill">
                    {buildFlowLabel(candidate.capitalFlowLabel)}
                  </span>
                ) : null}
                {candidate.marketStyle ? (
                  <span className="stock-meta-pill">
                    {buildStyleLabel(candidate.marketStyle)}
                  </span>
                ) : null}
                {candidate.crowdingRisk ? (
                  <span className="selector-filter-pill">
                    {buildCrowdingLabel(candidate.crowdingRisk)}
                  </span>
                ) : null}
                {candidate.familyLabels.map((label) => (
                  <span
                    key={`${candidate.symbol}-${label}`}
                    className="stock-meta-pill"
                  >
                    {label}
                  </span>
                ))}
                {candidate.strategyNames.map((label) => (
                  <span
                    key={`${candidate.symbol}-${label}`}
                    className="selector-filter-pill"
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="button-row intersection-action-row">
                <Button
                  variant="ghost"
                  onClick={() => onSelectSymbol(candidate.symbol)}
                >
                  查看股票
                </Button>
                <button
                  type="button"
                  className={`favorite-chip ${favorite ? "active" : ""}`}
                  onClick={() => onToggleFavorite(candidate.symbol)}
                >
                  {favorite ? buildFavoriteLabel(favorite.group) : "加入观察"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActionBoardSection({
  items,
  onSelectSymbol,
}: {
  items: ActionBoardCard[];
  onSelectSymbol: (symbol: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="action-board">
      <div className="strategy-section-head">
        <div>
          <div className="section-kicker">行动面板</div>
          <h3 className="strategy-section-title">当前工作区的下一步动作</h3>
          <div className="muted">
            把筛选结果转换成可执行动作，方便你直接进入下一轮复盘或跟踪。
          </div>
        </div>
      </div>

      <div className="action-board-grid">
        {items.map((item) => (
          <div key={item.id} className={`action-board-card tone-${item.tone}`}>
            <div className="action-board-head">
              <div className="action-board-title">{item.title}</div>
              <div className="action-board-count">{item.count}</div>
            </div>
            <div className="action-board-copy">{item.copy}</div>
            <div className="action-board-symbol-row">
              {item.symbols.length > 0 ? (
                item.symbols.map((symbol) => (
                  <button
                    key={`${item.id}-${symbol}`}
                    type="button"
                    className="action-board-symbol"
                    onClick={() => onSelectSymbol(symbol)}
                  >
                    {symbol}
                  </button>
                ))
              ) : (
                <span className="selector-filter-pill muted-state">
                  当前范围内暂无股票
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BoardResonanceSection({
  items,
  onSelectSymbol,
}: {
  items: BoardResonanceCard[];
  onSelectSymbol: (symbol: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="action-board">
      <div className="strategy-section-head">
        <div>
          <div className="section-kicker">题材共振</div>
          <h3 className="strategy-section-title">当前板块热度</h3>
          <div className="muted">
            根据当前可见候选股票反推板块共振度，方便你从个股切换到题材视角。
          </div>
        </div>
      </div>

      <div className="action-board-grid">
        {items.map((item) => (
          <div
            key={item.boardName}
            className={`action-board-card tone-${item.tone}`}
          >
            <div className="action-board-head">
              <div className="action-board-title">{item.boardName}</div>
              <div className="action-board-count">{item.candidateCount}</div>
            </div>
            <div className="action-board-copy">
              通过 {item.passCount} / 平均匹配 {Math.round(item.avgFitScore)} /
              优先级 {Math.round(item.avgPriorityScore)} / 资金强度{" "}
              {item.avgFlowStrength >= 0 ? "+" : ""}
              {item.avgFlowStrength.toFixed(1)}%
            </div>
            <div className="intersection-chip-row">
              <span className="stock-meta-pill">
                {buildRotationLabel(item.rotationSignal)}
              </span>
              <span className="stock-meta-pill">
                {buildHistorySignalLabel(item.historySignal)}
              </span>
              <span className="stock-meta-pill">
                {buildBoardRiskLabel(item.boardRisk)}
              </span>
              <span className="selector-filter-pill">
                涨跌 {item.avgDailyChange >= 0 ? "+" : ""}
                {item.avgDailyChange.toFixed(2)}%
              </span>
              <span className="selector-filter-pill">
                热度 {Math.round(item.avgThemeHeat)}
              </span>
              <span className="selector-filter-pill">
                优先级 {item.deltaPriorityScore >= 0 ? "+" : ""}
                {item.deltaPriorityScore.toFixed(1)}
              </span>
              <span className="selector-filter-pill">
                资金 {item.deltaFlowStrength >= 0 ? "+" : ""}
                {item.deltaFlowStrength.toFixed(1)}%
              </span>
              <span className="selector-filter-pill">
                成员{" "}
                {item.previousCandidateCount > 0
                  ? `${item.previousCandidateCount}->${item.candidateCount}`
                  : `0->${item.candidateCount}`}
              </span>
              <span className="selector-filter-pill">
                {item.overheatCount > 0
                  ? `${item.overheatCount} 只过热`
                  : "无明显过热"}
              </span>
              <span className="selector-filter-pill">
                展示前 {item.symbols.length} 只
              </span>
            </div>
            <div className="action-board-symbol-row">
              {item.symbols.map((symbol) => (
                <button
                  key={`${item.boardName}-${symbol}`}
                  type="button"
                  className="action-board-symbol"
                  onClick={() => onSelectSymbol(symbol)}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderBucket(
  bucket: ScreenerBucketEntry,
  favorites: FavoriteStore,
  onToggleFavorite: (symbol: string) => void,
  onUpdateFavoriteGroup: (symbol: string, group: FavoriteGroup) => void,
  onViewSymbol: (symbol: string) => void,
  compactMode: boolean,
) {
  return (
    <div
      key={bucket.id}
      className={`screener-bucket-card ${compactMode ? "compact" : ""}`}
    >
      <div className="screener-bucket-head">
        <div>
          <div className="screener-bucket-name">
            {translateStrategyText(bucket.name) || bucket.name}
          </div>
          <div className="screener-bucket-meta">
            {buildFamilyLabel(bucket.family)} /{" "}
            {translateStrategyText(bucket.category) || bucket.category} /{" "}
            {translateStrategyText(bucket.horizon) || bucket.horizon} /{" "}
            {bucket.candidateCount} 个候选
          </div>
        </div>
        <span className="badge">展示 {bucket.topCandidates.length} 只</span>
      </div>

      <div className="screener-bucket-copy">
        {translateStrategyText(bucket.summary) || bucket.summary}
      </div>

      <div className="screener-candidate-list">
        {bucket.topCandidates.map((candidate) => {
          const favorite = favorites[candidate.symbol];
          const favorited = Boolean(favorite);
          const statItems = [
            { label: "模型分", value: candidate.overallScore.toFixed(2) },
            {
              label: "流动性",
              value: candidate.liquidityTier
                ? `${translateStrategyText(candidate.liquidityTier) || candidate.liquidityTier} / ${Math.round(candidate.liquidityScore ?? 0)}`
                : "-",
            },
            {
              label: "观点",
              value: formatStanceLabel(candidate.stance) || "-",
            },
            {
              label: "换手率",
              value:
                candidate.turnoverRate !== undefined &&
                candidate.turnoverRate !== null
                  ? `${formatNumber(candidate.turnoverRate)}%`
                  : "-",
            },
            { label: "量比", value: formatNumber(candidate.volumeRatio) },
            {
              label: "净流入",
              value: formatCompactFlow(candidate.netMoneyFlow),
              tone:
                candidate.netMoneyFlow === undefined ||
                candidate.netMoneyFlow === null
                  ? ""
                  : candidate.netMoneyFlow >= 0
                    ? "metric-positive"
                    : "metric-negative",
            },
            {
              label: "流向强度",
              value:
                candidate.capitalFlowStrengthPct !== undefined &&
                candidate.capitalFlowStrengthPct !== null
                  ? `${formatNumber(candidate.capitalFlowStrengthPct)}%`
                  : "-",
              tone:
                candidate.capitalFlowStrengthPct === undefined ||
                candidate.capitalFlowStrengthPct === null
                  ? ""
                  : candidate.capitalFlowStrengthPct >= 0
                    ? "metric-positive"
                    : "metric-negative",
            },
            {
              label: "题材热度",
              value: candidate.themeHeatTier
                ? `${buildThemeTierLabel(candidate.themeHeatTier)} / ${Math.round(candidate.themeHeatScore ?? 0)}`
                : "-",
            },
            {
              label: "策略契合",
              value:
                candidate.strategyAlignmentScore !== undefined &&
                candidate.strategyAlignmentScore !== null
                  ? Math.round(candidate.strategyAlignmentScore).toString()
                  : "-",
            },
            {
              label: "综合优先",
              value:
                candidate.priorityScore !== undefined &&
                candidate.priorityScore !== null
                  ? Math.round(candidate.priorityScore).toString()
                  : "-",
            },
          ];
          const visibleStats = compactMode ? statItems.slice(0, 6) : statItems;
          const visibleMetrics = candidate.metrics.slice(
            0,
            compactMode ? 4 : 6,
          );
          return (
            <div
              key={`${bucket.id}-${candidate.symbol}`}
              className={`screener-candidate-card ${compactMode ? "compact" : ""}`}
            >
              <div className="screener-candidate-head">
                <div className="screener-candidate-main">
                  <span className="screener-rank-badge">#{candidate.rank}</span>
                  <div className="screener-candidate-main-copy">
                    <div className="screener-candidate-name-row">
                      <div className="screener-candidate-name">
                        {candidate.name}
                      </div>
                      <span className="stock-meta-pill">
                        {candidate.symbol}
                      </span>
                    </div>
                    <div className="screener-candidate-meta">
                      {buildCandidateMeta(candidate) ||
                        getSecurityTypeLabel(candidate.securityType) ||
                        "-"}
                    </div>
                  </div>
                </div>
                <div className="screener-candidate-side">
                  <div className="screener-candidate-quote">
                    <strong>{formatPrice(candidate.latestClose)}</strong>
                    <span
                      className={
                        candidate.dailyChangePct >= 0
                          ? "metric-positive"
                          : "metric-negative"
                      }
                    >
                      {formatSignedPercent(candidate.dailyChangePct)}
                    </span>
                  </div>
                  <div className="screener-candidate-actions">
                    {favorited ? (
                      <select
                        className="screener-select favorite-group-select"
                        value={favorite.group}
                        onChange={(event) =>
                          onUpdateFavoriteGroup(
                            candidate.symbol,
                            event.target.value as FavoriteGroup,
                          )
                        }
                      >
                        {FAVORITE_GROUP_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      type="button"
                      className={`favorite-chip ${favorited ? "active" : ""}`}
                      onClick={() => onToggleFavorite(candidate.symbol)}
                    >
                      {favorited
                        ? buildFavoriteLabel(favorite.group)
                        : "加入观察"}
                    </button>
                    <div
                      className={`strategy-fit-badge strategy-fit-${candidate.signal.toLowerCase()}`}
                    >
                      {formatStrategySignalLabel(candidate.signal)} /{" "}
                      {candidate.fitScore}%
                    </div>
                  </div>
                </div>
              </div>

              <div className="screener-candidate-stats">
                {visibleStats.map((item) => (
                  <div
                    key={`${candidate.symbol}-${item.label}`}
                    className="screener-stat-chip"
                  >
                    <span>{item.label}</span>
                    <strong className={item.tone}>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div
                className={`screener-candidate-copy ${compactMode ? "compact" : ""}`}
              >
                {translateStrategyText(candidate.summary) ||
                  "暂无额外筛选备注。"}
              </div>

              <div className="intersection-chip-row">
                <span className="stock-meta-pill">
                  {buildFlowLabel(candidate.capitalFlowLabel)}
                </span>
                <span className="stock-meta-pill">
                  {buildStyleLabel(candidate.marketStyle)}
                </span>
                {candidate.themeHeatTier ? (
                  <span className="selector-filter-pill">
                    题材 {buildThemeTierLabel(candidate.themeHeatTier)}
                  </span>
                ) : null}
                {candidate.crowdingRisk ? (
                  <span className="selector-filter-pill">
                    {buildCrowdingLabel(candidate.crowdingRisk)}
                  </span>
                ) : null}
                {candidate.trendBias ? (
                  <span className="selector-filter-pill">
                    趋势 {buildTrendBiasLabel(candidate.trendBias)}
                  </span>
                ) : null}
                {candidate.valuationBand ? (
                  <span className="selector-filter-pill">
                    估值 {buildValuationBandLabel(candidate.valuationBand)}
                  </span>
                ) : null}
              </div>

              <div className="strategy-metric-row">
                {visibleMetrics.map((metric) => (
                  <div
                    key={`${candidate.symbol}-${metric.label}`}
                    className="strategy-metric-chip"
                  >
                    <span>
                      {translateStrategyText(
                        formatStrategyMetricLabel(metric.label),
                      ) || formatStrategyMetricLabel(metric.label)}
                    </span>
                    <strong
                      className={
                        metric.tone === "positive"
                          ? "metric-positive"
                          : metric.tone === "negative"
                            ? "metric-negative"
                            : ""
                      }
                    >
                      {translateStrategyText(metric.value) || metric.value}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="button-row screener-action-row">
                <Button
                  variant="ghost"
                  onClick={() => onViewSymbol(candidate.symbol)}
                >
                  查看个股
                </Button>
                <span className="stock-meta-pill">
                  {formatStrategySignalLabel(candidate.signal)}
                </span>
                <span className="stock-meta-pill">
                  契合 {candidate.fitScore}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ScreenerPanel({
  screener,
  loading,
  error,
  currentTop,
  screenerFilters,
  onRefresh,
  onChangeTop,
  onChangeScreenerFilters,
  onResetScreenerFilters,
  onSelectSymbol,
}: Props) {
  const initialWorkspace = useMemo(() => readWorkspaceState(), []);
  const [scopeFilter, setScopeFilter] = useState<"ALL" | ScreenerFamily>(
    initialWorkspace.scopeFilter,
  );
  const [strategyFilter, setStrategyFilter] = useState(
    initialWorkspace.strategyFilter,
  );
  const [signalFilter, setSignalFilter] = useState<SignalFilter>(
    initialWorkspace.signalFilter,
  );
  const [exchangeFilter, setExchangeFilter] = useState(
    initialWorkspace.exchangeFilter,
  );
  const [marketFilter, setMarketFilter] = useState(
    initialWorkspace.marketFilter,
  );
  const [flowFilter, setFlowFilter] = useState<FlowFilter>(
    initialWorkspace.flowFilter,
  );
  const [styleFilter, setStyleFilter] = useState<StyleFilter>(
    initialWorkspace.styleFilter,
  );
  const [industryFilter, setIndustryFilter] = useState(
    initialWorkspace.industryFilter,
  );
  const [areaFilter, setAreaFilter] = useState(initialWorkspace.areaFilter);
  const [searchText, setSearchText] = useState(initialWorkspace.searchText);
  const [debouncedSearchText, setDebouncedSearchText] = useState(
    initialWorkspace.searchText,
  );
  const [favoritesOnly, setFavoritesOnly] = useState(
    initialWorkspace.favoritesOnly,
  );
  const [sortMode, setSortMode] = useState<SortMode>(initialWorkspace.sortMode);
  const [compactMode, setCompactMode] = useState(initialWorkspace.compactMode);
  const [tradeFilterExpanded, setTradeFilterExpanded] = useState(
    initialWorkspace.tradeFilterExpanded,
  );
  const [workspaceFilterExpanded, setWorkspaceFilterExpanded] = useState(
    initialWorkspace.workspaceFilterExpanded,
  );
  const [favorites, setFavorites] = useState<FavoriteStore>({});
  const [boardHistoryStore, setBoardHistoryStore] = useState<BoardHistoryStore>(
    () => readBoardHistoryStore(),
  );

  const updateScreenerFilters = (
    patch: Partial<ScreenerQueryOptions>,
    mode: "preset" | "custom" = "custom",
  ) => {
    const nextPreset =
      mode === "preset"
        ? ((patch.preset as ScreenerPreset | undefined) ??
          screenerFilters.preset ??
          "balanced")
        : "custom";
    onChangeScreenerFilters({
      ...screenerFilters,
      ...patch,
      preset: nextPreset,
    });
  };

  const applyPreset = (preset: ScreenerPreset) => {
    if (preset === "custom") {
      onChangeScreenerFilters({
        ...screenerFilters,
        preset: "custom",
      });
      return;
    }
    onChangeScreenerFilters({
      ...SCREENER_PRESET_FILTERS[preset],
      preset,
    });
  };

  const updateNumericFilter = (
    key:
      | "minAvgAmountK"
      | "minLatestAmountK"
      | "minFloatMarketCapW"
      | "minTotalMarketCapW"
      | "minListedDays",
    value: string,
  ) => {
    const nextValue = value === "" ? 0 : Math.max(0, Number(value) || 0);
    updateScreenerFilters({ [key]: nextValue }, "custom");
  };

  const updateBooleanFilter = (
    key:
      | "excludeSt"
      | "excludeBse"
      | "excludeSuspended"
      | "excludeNonListingStatus",
    value: string,
  ) => {
    updateScreenerFilters({ [key]: value === "true" }, "custom");
  };

  useEffect(() => {
    const initial = readFavoriteStore();
    setFavorites(initial);
    writeFavoriteStore(initial);
  }, []);

  useEffect(() => {
    setBoardHistoryStore(readBoardHistoryStore());
  }, []);

  useEffect(() => {
    writeWorkspaceState({
      scopeFilter,
      strategyFilter,
      signalFilter,
      exchangeFilter,
      marketFilter,
      flowFilter,
      styleFilter,
      industryFilter,
      areaFilter,
      searchText,
      favoritesOnly,
      sortMode,
      compactMode,
      tradeFilterExpanded,
      workspaceFilterExpanded,
    });
  }, [
    areaFilter,
    compactMode,
    exchangeFilter,
    favoritesOnly,
    flowFilter,
    industryFilter,
    marketFilter,
    scopeFilter,
    searchText,
    signalFilter,
    sortMode,
    strategyFilter,
    styleFilter,
    tradeFilterExpanded,
    workspaceFilterExpanded,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const allBuckets = useMemo<ScreenerBucketEntry[]>(
    () => [
      ...(screener?.longTermStrategies ?? []).map((bucket) => ({
        ...bucket,
        family: "LONG_TERM" as const,
      })),
      ...(screener?.stockPickers ?? []).map((bucket) => ({
        ...bucket,
        family: "STOCK_PICKING" as const,
      })),
    ],
    [screener?.longTermStrategies, screener?.stockPickers],
  );

  const strategyOptions = useMemo(
    () =>
      allBuckets.map((bucket) => ({
        value: bucket.id,
        label: `${translateStrategyText(bucket.name) || bucket.name} / ${buildFamilyLabel(bucket.family)}`,
      })),
    [allBuckets],
  );

  const filterOptions = useMemo(() => {
    const industrySet = new Set<string>();
    const exchangeSet = new Set<string>();
    const marketSet = new Set<string>();
    const flowSet = new Set<string>();
    const styleSet = new Set<string>();
    const areaSet = new Set<string>();

    for (const bucket of allBuckets) {
      for (const candidate of bucket.topCandidates) {
        addTrimmedOption(industrySet, candidate.industry);
        addTrimmedOption(exchangeSet, candidate.exchange);
        addTrimmedOption(marketSet, candidate.market);
        addTrimmedOption(flowSet, candidate.capitalFlowLabel);
        addTrimmedOption(styleSet, candidate.marketStyle);
        addTrimmedOption(areaSet, candidate.area);
      }
    }

    const sortZh = (values: string[]) =>
      values.sort((left, right) => left.localeCompare(right, "zh-CN"));

    return {
      industryOptions: sortZh(Array.from(industrySet)),
      exchangeOptions: sortZh(Array.from(exchangeSet)),
      marketOptions: sortZh(Array.from(marketSet)),
      flowOptions: Array.from(flowSet),
      styleOptions: Array.from(styleSet),
      areaOptions: sortZh(Array.from(areaSet)),
    };
  }, [allBuckets]);
  const {
    areaOptions,
    exchangeOptions,
    flowOptions,
    industryOptions,
    marketOptions,
    styleOptions,
  } = filterOptions;

  const rawSearchKeyword = searchText.trim().toLowerCase();
  const searchKeyword = debouncedSearchText.trim().toLowerCase();
  const isSearchPending = rawSearchKeyword !== searchKeyword;

  useEffect(() => {
    if (
      strategyFilter !== "ALL" &&
      !strategyOptions.some((option) => option.value === strategyFilter)
    ) {
      setStrategyFilter("ALL");
    }
  }, [strategyFilter, strategyOptions]);

  useEffect(() => {
    if (exchangeFilter !== "ALL" && !exchangeOptions.includes(exchangeFilter)) {
      setExchangeFilter("ALL");
    }
  }, [exchangeFilter, exchangeOptions]);

  useEffect(() => {
    if (marketFilter !== "ALL" && !marketOptions.includes(marketFilter)) {
      setMarketFilter("ALL");
    }
  }, [marketFilter, marketOptions]);

  useEffect(() => {
    if (flowFilter !== "ALL" && !flowOptions.includes(flowFilter)) {
      setFlowFilter("ALL");
    }
  }, [flowFilter, flowOptions]);

  useEffect(() => {
    if (styleFilter !== "ALL" && !styleOptions.includes(styleFilter)) {
      setStyleFilter("ALL");
    }
  }, [styleFilter, styleOptions]);

  useEffect(() => {
    if (industryFilter !== "ALL" && !industryOptions.includes(industryFilter)) {
      setIndustryFilter("ALL");
    }
  }, [industryFilter, industryOptions]);

  useEffect(() => {
    if (areaFilter !== "ALL" && !areaOptions.includes(areaFilter)) {
      setAreaFilter("ALL");
    }
  }, [areaFilter, areaOptions]);

  const filteredBuckets = useMemo(() => {
    return allBuckets
      .filter(
        (bucket) => scopeFilter === "ALL" || bucket.family === scopeFilter,
      )
      .filter(
        (bucket) => strategyFilter === "ALL" || bucket.id === strategyFilter,
      )
      .map((bucket) => {
        const candidates = bucket.topCandidates
          .filter((candidate) => {
            if (signalFilter !== "ALL" && candidate.signal !== signalFilter) {
              return false;
            }
            if (
              exchangeFilter !== "ALL" &&
              String(candidate.exchange || "") !== exchangeFilter
            ) {
              return false;
            }
            if (
              marketFilter !== "ALL" &&
              String(candidate.market || "") !== marketFilter
            ) {
              return false;
            }
            if (
              flowFilter !== "ALL" &&
              String(candidate.capitalFlowLabel || "") !== flowFilter
            ) {
              return false;
            }
            if (
              styleFilter !== "ALL" &&
              String(candidate.marketStyle || "") !== styleFilter
            ) {
              return false;
            }
            if (
              industryFilter !== "ALL" &&
              String(candidate.industry || "") !== industryFilter
            ) {
              return false;
            }
            if (
              areaFilter !== "ALL" &&
              String(candidate.area || "") !== areaFilter
            ) {
              return false;
            }
            if (favoritesOnly && !favorites[candidate.symbol]) {
              return false;
            }
            if (searchKeyword) {
              const haystack = [
                candidate.symbol,
                candidate.name,
                candidate.exchange,
                candidate.market,
                candidate.industry,
                candidate.area,
                candidate.boardNames,
                candidate.boardCount,
                candidate.liquidityTier,
                candidate.capitalFlowLabel,
                buildFlowLabel(candidate.capitalFlowLabel),
                candidate.marketStyle,
                buildStyleLabel(candidate.marketStyle),
                candidate.themeHeatTier,
                buildThemeTierLabel(candidate.themeHeatTier),
                candidate.crowdingRisk,
                buildCrowdingLabel(candidate.crowdingRisk),
                bucket.name,
                favorites[candidate.symbol]?.note,
                favorites[candidate.symbol]?.targetPrice,
                favorites[candidate.symbol]?.stopPrice,
                favorites[candidate.symbol]?.holdingHorizon,
                favorites[candidate.symbol]
                  ? buildFavoriteLabel(favorites[candidate.symbol].group)
                  : "",
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              if (!haystack.includes(searchKeyword)) {
                return false;
              }
            }
            return true;
          })
          .slice()
          .sort((left, right) => compareCandidates(left, right, sortMode))
          .map((candidate, index) => ({
            ...candidate,
            rank: index + 1,
          }));

        return {
          ...bucket,
          topCandidates: candidates,
          candidateCount: candidates.length,
        };
      })
      .filter((bucket) => bucket.topCandidates.length > 0)
      .sort(
        (left, right) =>
          right.candidateCount - left.candidateCount ||
          (right.topCandidates[0]?.fitScore || 0) -
            (left.topCandidates[0]?.fitScore || 0) ||
          left.name.localeCompare(right.name, "zh-CN"),
      );
  }, [
    allBuckets,
    areaFilter,
    exchangeFilter,
    favorites,
    favoritesOnly,
    flowFilter,
    industryFilter,
    marketFilter,
    scopeFilter,
    searchKeyword,
    signalFilter,
    sortMode,
    strategyFilter,
    styleFilter,
  ]);

  const favoriteCandidates = useMemo(
    () => buildFavoriteCandidates(allBuckets, favorites),
    [allBuckets, favorites],
  );

  const filteredLongTerm = useMemo(
    () => filteredBuckets.filter((bucket) => bucket.family === "LONG_TERM"),
    [filteredBuckets],
  );
  const filteredStockPickers = useMemo(
    () => filteredBuckets.filter((bucket) => bucket.family === "STOCK_PICKING"),
    [filteredBuckets],
  );
  const intersectionCandidates = useMemo(
    () => buildIntersectionCandidates(filteredBuckets).slice(0, 8),
    [filteredBuckets],
  );
  const uniqueCandidates = useMemo(
    () => buildUniqueCandidates(filteredBuckets),
    [filteredBuckets],
  );
  const visibleCandidateCount = useMemo(
    () =>
      filteredBuckets.reduce(
        (sum, bucket) => sum + bucket.topCandidates.length,
        0,
      ),
    [filteredBuckets],
  );
  const favoriteCount = Object.keys(favorites).length;
  const matchedFavoriteCount =
    favoriteCandidates.WATCH.length +
    favoriteCandidates.BUYLIST.length +
    favoriteCandidates.HOLDING.length;
  const activeFilterCount = [
    scopeFilter !== DEFAULT_WORKSPACE_STATE.scopeFilter,
    strategyFilter !== DEFAULT_WORKSPACE_STATE.strategyFilter,
    signalFilter !== DEFAULT_WORKSPACE_STATE.signalFilter,
    exchangeFilter !== DEFAULT_WORKSPACE_STATE.exchangeFilter,
    marketFilter !== DEFAULT_WORKSPACE_STATE.marketFilter,
    flowFilter !== DEFAULT_WORKSPACE_STATE.flowFilter,
    styleFilter !== DEFAULT_WORKSPACE_STATE.styleFilter,
    industryFilter !== DEFAULT_WORKSPACE_STATE.industryFilter,
    areaFilter !== DEFAULT_WORKSPACE_STATE.areaFilter,
    favoritesOnly !== DEFAULT_WORKSPACE_STATE.favoritesOnly,
    sortMode !== DEFAULT_WORKSPACE_STATE.sortMode,
    rawSearchKeyword.length > 0,
  ].filter(Boolean).length;
  const tradeFilterSummary = [
    `20日均额 ${formatCompactFlow((screenerFilters.minAvgAmountK ?? 0) * 1000)}`,
    `最新成交 ${formatCompactFlow((screenerFilters.minLatestAmountK ?? 0) * 1000)}`,
    `流通市值 ${(screenerFilters.minFloatMarketCapW ?? 0).toLocaleString("zh-CN")} 万`,
    `上市 ${(screenerFilters.minListedDays ?? 0).toLocaleString("zh-CN")} 天+`,
    (screenerFilters.excludeSt ?? true) ? "剔除 ST" : "保留 ST",
    (screenerFilters.excludeSuspended ?? true) ? "剔除停牌" : "保留停牌",
  ];
  const workspaceFilterSummary = [
    strategyFilter !== "ALL" ? "已锁定策略" : "全部策略",
    signalFilter !== "ALL"
      ? `信号 ${formatStrategySignalLabel(signalFilter)}`
      : "全部信号",
    favoritesOnly ? "仅看自选" : "全市场候选",
    rawSearchKeyword ? `搜索 ${rawSearchKeyword}` : "未搜索",
  ];
  const visiblePulseCards = useMemo<ScreenerPulseCard[]>(() => {
    if (uniqueCandidates.length === 0) {
      return [];
    }

    let passCount = 0;
    let watchCount = 0;
    let strongInflowCount = 0;
    let outflowCount = 0;
    let hotCount = 0;
    let overheatCount = 0;
    let prioritySum = 0;
    let liquiditySum = 0;
    let flowSum = 0;
    const styleCounts = new Map<string, number>();
    const industryCounts = new Map<string, number>();
    const boardCounts = new Map<string, number>();

    for (const candidate of uniqueCandidates) {
      if (candidate.signal === "PASS") {
        passCount += 1;
      } else if (candidate.signal === "WATCH") {
        watchCount += 1;
      }

      const flowStrength = candidate.capitalFlowStrengthPct ?? 0;
      if (flowStrength >= 4) {
        strongInflowCount += 1;
      }
      if (flowStrength <= -4) {
        outflowCount += 1;
      }
      if (candidate.themeHeatTier === "HOT") {
        hotCount += 1;
      }
      if (candidate.crowdingRisk === "OVERCROWDED") {
        overheatCount += 1;
      }

      prioritySum += candidate.priorityScore ?? 0;
      liquiditySum += candidate.liquidityScore ?? 0;
      flowSum += flowStrength;
      addLabelCount(styleCounts, buildStyleLabel(candidate.marketStyle));
      addLabelCount(industryCounts, candidate.industry);
      for (const boardName of splitBoardNames(candidate.boardNames)) {
        addLabelCount(boardCounts, boardName);
      }
    }

    const candidateCount = uniqueCandidates.length;
    const avgPriority = prioritySum / candidateCount;
    const avgLiquidity = liquiditySum / candidateCount;
    const avgFlow = flowSum / candidateCount;
    const dominantStyle = pickMostFrequentCount(styleCounts);
    const dominantIndustry = pickMostFrequentCount(industryCounts);
    const dominantBoard = pickMostFrequentCount(boardCounts);
    const passRate = (passCount / candidateCount) * 100;

    return [
      {
        id: "pass-rate",
        title: "信号通过率",
        value: `${Math.round(passRate)}%`,
        detail: `通过 ${passCount} 只，观察 ${watchCount} 只，当前可见 ${uniqueCandidates.length} 只。`,
        tone: passRate >= 55 ? "positive" : passRate >= 35 ? "warm" : "neutral",
      },
      {
        id: "capital-flow",
        title: "资金温度",
        value: formatSignedPercent(avgFlow),
        detail: `强流入 ${strongInflowCount} 只，流出压力 ${outflowCount} 只。`,
        tone: avgFlow >= 4 ? "positive" : avgFlow <= -4 ? "alert" : "neutral",
      },
      {
        id: "style-bias",
        title: "风格偏向",
        value: dominantStyle.label || "分散",
        detail: `平均优先级 ${formatNumber(avgPriority, 1)}，平均流动性 ${formatNumber(avgLiquidity, 1)}。`,
        tone:
          avgPriority >= 70
            ? "positive"
            : avgPriority >= 55
              ? "warm"
              : "neutral",
      },
      {
        id: "mainline-focus",
        title: "主线聚焦",
        value: dominantBoard.label || dominantIndustry.label || "分散",
        detail:
          dominantBoard.label && dominantBoard.count > 1
            ? `${dominantBoard.count} 只候选集中在该板块，行业重心 ${dominantIndustry.label || "分散"}。`
            : `热度偏高 ${hotCount} 只，过热拥挤 ${overheatCount} 只。`,
        tone:
          overheatCount > Math.max(1, uniqueCandidates.length / 4)
            ? "alert"
            : hotCount > 0
              ? "warm"
              : "positive",
      },
    ];
  }, [uniqueCandidates]);
  const actionBoardCards = useMemo<ActionBoardCard[]>(() => {
    const hasPlan = (favorite: FavoriteRecord) =>
      Boolean(
        favorite.targetPrice.trim() &&
          favorite.stopPrice.trim() &&
          favorite.holdingHorizon.trim(),
      );
    const intersectionSymbols = new Set(
      intersectionCandidates.map((item) => item.symbol),
    );
    const convictionPasses: ScreenerCandidate[] = [];
    const capacityInflow: ScreenerCandidate[] = [];
    const crowdingWatch: ScreenerCandidate[] = [];
    const priorityTrack: ScreenerCandidate[] = [];
    const coolDownAvoid: ScreenerCandidate[] = [];

    for (const candidate of uniqueCandidates) {
      const priorityScore = candidate.priorityScore ?? 0;
      const flowStrength = candidate.capitalFlowStrengthPct ?? 0;
      const isThemeHot = candidate.themeHeatTier === "HOT";
      const isOvercrowded = candidate.crowdingRisk === "OVERCROWDED";

      if (candidate.signal === "PASS") {
        convictionPasses.push(candidate);
      }
      if (
        candidate.signal !== "AVOID" &&
        (candidate.marketStyle === "CAPACITY_CORE" ||
          candidate.marketStyle === "STEADY_ACCUMULATION") &&
        flowStrength >= 4
      ) {
        capacityInflow.push(candidate);
      }
      if (isOvercrowded || isThemeHot) {
        crowdingWatch.push(candidate);
      }
      if (
        candidate.signal !== "AVOID" &&
        priorityScore >= 75 &&
        !isOvercrowded
      ) {
        priorityTrack.push(candidate);
      }
      if (isOvercrowded || (priorityScore < 55 && isThemeHot)) {
        coolDownAvoid.push(candidate);
      }
    }

    convictionPasses.sort(
      (left, right) =>
        Number(intersectionSymbols.has(right.symbol)) -
          Number(intersectionSymbols.has(left.symbol)) ||
        (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
        right.fitScore - left.fitScore ||
        right.overallScore - left.overallScore,
    );
    const allMatchedFavorites = [
      ...favoriteCandidates.WATCH,
      ...favoriteCandidates.BUYLIST,
      ...favoriteCandidates.HOLDING,
    ];
    const planNeeded = allMatchedFavorites
      .filter((item) => !hasPlan(item.favorite))
      .sort(
        (left, right) =>
          new Date(right.favorite.updatedAt).getTime() -
            new Date(left.favorite.updatedAt).getTime() ||
          left.symbol.localeCompare(right.symbol),
      );
    const holdingReview = favoriteCandidates.HOLDING.filter(
      (item) =>
        !item.favorite.stopPrice.trim() ||
        item.signal === "AVOID" ||
        item.dailyChangePct < 0,
    ).sort(
      (left, right) =>
        Number(!right.favorite.stopPrice.trim()) -
          Number(!left.favorite.stopPrice.trim()) ||
        left.dailyChangePct - right.dailyChangePct ||
        left.symbol.localeCompare(right.symbol),
    );
    const buylistReady = favoriteCandidates.BUYLIST.filter(
      (item) => hasPlan(item.favorite) && item.signal !== "AVOID",
    ).sort(
      (left, right) =>
        (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
        right.fitScore - left.fitScore ||
        right.overallScore - left.overallScore ||
        left.symbol.localeCompare(right.symbol),
    );
    capacityInflow.sort(
      (left, right) =>
        (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
        (right.capitalFlowStrengthPct ?? 0) -
          (left.capitalFlowStrengthPct ?? 0) ||
        (right.strategyAlignmentScore ?? 0) -
          (left.strategyAlignmentScore ?? 0) ||
        right.fitScore - left.fitScore,
    );
    crowdingWatch.sort(
      (left, right) =>
        Number(right.crowdingRisk === "OVERCROWDED") -
          Number(left.crowdingRisk === "OVERCROWDED") ||
        (right.themeHeatScore ?? 0) - (left.themeHeatScore ?? 0) ||
        (right.capitalFlowStrengthPct ?? 0) -
          (left.capitalFlowStrengthPct ?? 0),
    );
    priorityTrack.sort(
      (left, right) =>
        (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
        (right.strategyAlignmentScore ?? 0) -
          (left.strategyAlignmentScore ?? 0) ||
        right.fitScore - left.fitScore,
    );
    coolDownAvoid.sort(
      (left, right) =>
        Number(right.crowdingRisk === "OVERCROWDED") -
          Number(left.crowdingRisk === "OVERCROWDED") ||
        (left.priorityScore ?? 0) - (right.priorityScore ?? 0) ||
        (right.themeHeatScore ?? 0) - (left.themeHeatScore ?? 0),
    );

    return [
      {
        id: "priority-track",
        title: "优先跟踪",
        count: priorityTrack.length,
        copy: "综合优先级高、拥挤度可控的股票，更适合进入你的主跟踪池。",
        symbols: priorityTrack.slice(0, 4).map((item) => item.symbol),
        tone: "positive",
      },
      {
        id: "conviction",
        title: "高共识通过",
        count: convictionPasses.length,
        copy: "当前范围里优先级最高的机会，多策略共振的股票会自然排在前面。",
        symbols: convictionPasses.slice(0, 4).map((item) => item.symbol),
        tone: "positive",
      },
      {
        id: "plan-needed",
        title: "计划信息待补充",
        count: planNeeded.length,
        copy: "这些自选股还缺少目标价、止损价或持有周期，暂时还不能形成完整交易计划。",
        symbols: planNeeded.slice(0, 4).map((item) => item.symbol),
        tone: "warm",
      },
      {
        id: "holding-review",
        title: "持仓复查",
        count: holdingReview.length,
        copy: "当前持仓里风控偏弱或今日信号转弱的股票，建议优先复查。",
        symbols: holdingReview.slice(0, 4).map((item) => item.symbol),
        tone: "alert",
      },
      {
        id: "buylist-ready",
        title: "买入清单就绪",
        count: buylistReady.length,
        copy: "已补齐计划且当前没有出现回避信号的买入清单股票。",
        symbols: buylistReady.slice(0, 4).map((item) => item.symbol),
        tone: "neutral",
      },
      {
        id: "capacity-inflow",
        title: "容量强流入",
        count: capacityInflow.length,
        copy: "更偏机构或中线资金承接的容量型标的，适合优先做跟踪池。",
        symbols: capacityInflow.slice(0, 4).map((item) => item.symbol),
        tone: "positive",
      },
      {
        id: "crowding-watch",
        title: "题材过热观察",
        count: crowdingWatch.length,
        copy: "热度和资金同时抬升的票，适合重点盯节奏，不适合无差别追高。",
        symbols: crowdingWatch.slice(0, 4).map((item) => item.symbol),
        tone: "alert",
      },
      {
        id: "cooldown-avoid",
        title: "降温回避",
        count: coolDownAvoid.length,
        copy: "这些股票热度偏高但综合优先级不足，更适合等待降温而不是立刻参与。",
        symbols: coolDownAvoid.slice(0, 4).map((item) => item.symbol),
        tone: "alert",
      },
    ];
  }, [
    favoriteCandidates.BUYLIST,
    favoriteCandidates.HOLDING,
    favoriteCandidates.WATCH,
    intersectionCandidates,
    uniqueCandidates,
  ]);

  const rawBoardResonanceCards = useMemo<BoardResonanceCard[]>(() => {
    const boardMap = new Map<
      string,
      {
        candidates: ScreenerCandidate[];
        passCount: number;
        fitSum: number;
        prioritySum: number;
        flowSum: number;
        changeSum: number;
        themeHeatSum: number;
        hotCount: number;
        overheatCount: number;
      }
    >();

    for (const candidate of uniqueCandidates) {
      const boardNames = splitBoardNames(candidate.boardNames);
      if (boardNames.length === 0) {
        continue;
      }
      for (const boardName of boardNames) {
        const current = boardMap.get(boardName) ?? {
          candidates: [],
          passCount: 0,
          fitSum: 0,
          prioritySum: 0,
          flowSum: 0,
          changeSum: 0,
          themeHeatSum: 0,
          hotCount: 0,
          overheatCount: 0,
        };
        current.candidates.push(candidate);
        current.fitSum += candidate.fitScore;
        current.prioritySum +=
          candidate.priorityScore ?? candidate.strategyAlignmentScore ?? 0;
        current.flowSum += candidate.capitalFlowStrengthPct ?? 0;
        current.changeSum += candidate.dailyChangePct ?? 0;
        current.themeHeatSum += candidate.themeHeatScore ?? 0;
        if (candidate.signal === "PASS") {
          current.passCount += 1;
        }
        if (
          candidate.themeHeatTier === "HOT" ||
          candidate.crowdingRisk === "OVERCROWDED"
        ) {
          current.hotCount += 1;
        }
        if (candidate.crowdingRisk === "OVERCROWDED") {
          current.overheatCount += 1;
        }
        boardMap.set(boardName, current);
      }
    }

    return Array.from(boardMap.entries())
      .map(([boardName, entry]) => {
        const candidates = entry.candidates
          .slice()
          .sort(
            (left, right) =>
              (right.priorityScore ?? 0) - (left.priorityScore ?? 0) ||
              right.fitScore - left.fitScore ||
              left.symbol.localeCompare(right.symbol),
          );
        const candidateCount = candidates.length;
        const avgPriorityScore =
          entry.prioritySum / Math.max(1, candidateCount);
        const avgFlowStrength = entry.flowSum / Math.max(1, candidateCount);
        const avgDailyChange = entry.changeSum / Math.max(1, candidateCount);
        const avgThemeHeat = entry.themeHeatSum / Math.max(1, candidateCount);
        const passRate = entry.passCount / Math.max(1, candidateCount);
        let rotationSignal = "ROTATION_WATCH";
        let boardRisk = "MIXED";
        let tone: ActionBoardTone = "neutral";

        if (
          entry.overheatCount >= Math.max(1, Math.ceil(candidateCount / 2)) ||
          avgThemeHeat >= 78
        ) {
          rotationSignal = "OVERHEATED";
          boardRisk = "CHASING_RISK";
          tone = "alert";
        } else if (
          passRate >= 0.5 &&
          avgFlowStrength >= 4 &&
          avgPriorityScore >= 68 &&
          avgDailyChange >= 0
        ) {
          rotationSignal = "HEATING_UP";
          boardRisk = "TRACKABLE";
          tone = "positive";
        } else if (avgFlowStrength >= 2 && avgPriorityScore >= 60) {
          rotationSignal = "FLOW_BACK";
          boardRisk = "TRACKABLE";
          tone = "warm";
        } else if (avgFlowStrength < 0 && avgDailyChange < 0) {
          rotationSignal = "COOLING_DOWN";
          boardRisk = "MIXED";
          tone = "alert";
        }

        return {
          boardName,
          candidateCount,
          passCount: entry.passCount,
          avgFitScore: entry.fitSum / Math.max(1, candidateCount),
          avgPriorityScore,
          avgFlowStrength,
          avgDailyChange,
          avgThemeHeat,
          hotCount: entry.hotCount,
          overheatCount: entry.overheatCount,
          rotationSignal,
          boardRisk,
          historySignal: "STABLE_WATCH",
          deltaPriorityScore: 0,
          deltaFlowStrength: 0,
          previousCandidateCount: 0,
          tone,
          symbols: candidates.slice(0, 4).map((item) => item.symbol),
        };
      })
      .filter((item) => item.candidateCount >= 2)
      .sort(
        (left, right) =>
          Number(right.rotationSignal === "HEATING_UP") -
            Number(left.rotationSignal === "HEATING_UP") ||
          Number(left.boardRisk === "CHASING_RISK") -
            Number(right.boardRisk === "CHASING_RISK") ||
          right.candidateCount - left.candidateCount ||
          right.avgPriorityScore - left.avgPriorityScore ||
          right.passCount - left.passCount ||
          left.boardName.localeCompare(right.boardName, "zh-CN"),
      );
  }, [uniqueCandidates]);

  const boardResonanceCards = useMemo<BoardResonanceCard[]>(() => {
    const comparisonBoards =
      boardHistoryStore.latestUpdatedAt &&
      boardHistoryStore.latestUpdatedAt === screener?.updatedAt
        ? boardHistoryStore.previousBoards
        : boardHistoryStore.latestBoards;

    return rawBoardResonanceCards
      .map((item) => {
        const previous = comparisonBoards[item.boardName];
        if (!previous) {
          return {
            ...item,
            historySignal: "NEW_ENTRY",
            deltaPriorityScore: item.avgPriorityScore,
            deltaFlowStrength: item.avgFlowStrength,
            previousCandidateCount: 0,
          };
        }

        const deltaPriorityScore =
          item.avgPriorityScore - previous.avgPriorityScore;
        const deltaFlowStrength =
          item.avgFlowStrength - previous.avgFlowStrength;
        const candidateDelta = item.candidateCount - previous.candidateCount;
        let historySignal = "STABLE_WATCH";

        if (
          deltaPriorityScore >= 6 ||
          (deltaPriorityScore >= 3 && deltaFlowStrength >= 2) ||
          candidateDelta >= 2
        ) {
          historySignal = "STRENGTHENING";
        } else if (
          deltaPriorityScore <= -6 ||
          (deltaFlowStrength <= -2 && candidateDelta < 0)
        ) {
          historySignal = "WEAKENING";
        } else if (item.avgPriorityScore >= 70 && item.avgFlowStrength >= 4) {
          historySignal = "STABLE_STRONG";
        }

        return {
          ...item,
          historySignal,
          deltaPriorityScore,
          deltaFlowStrength,
          previousCandidateCount: previous.candidateCount,
        };
      })
      .sort(
        (left, right) =>
          Number(right.historySignal === "STRENGTHENING") -
            Number(left.historySignal === "STRENGTHENING") ||
          Number(right.historySignal === "STABLE_STRONG") -
            Number(left.historySignal === "STABLE_STRONG") ||
          Number(left.boardRisk === "CHASING_RISK") -
            Number(right.boardRisk === "CHASING_RISK") ||
          right.avgPriorityScore - left.avgPriorityScore ||
          right.candidateCount - left.candidateCount ||
          left.boardName.localeCompare(right.boardName, "zh-CN"),
      )
      .slice(0, 8);
  }, [
    boardHistoryStore.latestBoards,
    boardHistoryStore.latestUpdatedAt,
    boardHistoryStore.previousBoards,
    rawBoardResonanceCards,
    screener?.updatedAt,
  ]);

  useEffect(() => {
    const updatedAt = screener?.updatedAt;
    if (!updatedAt || rawBoardResonanceCards.length === 0) {
      return;
    }

    setBoardHistoryStore((previous) => {
      if (previous.latestUpdatedAt === updatedAt) {
        return previous;
      }
      const next: BoardHistoryStore = {
        latestUpdatedAt: updatedAt,
        previousUpdatedAt: previous.latestUpdatedAt,
        latestBoards: buildBoardSnapshotMap(rawBoardResonanceCards),
        previousBoards: previous.latestBoards,
      };
      writeBoardHistoryStore(next);
      return next;
    });
  }, [rawBoardResonanceCards, screener?.updatedAt]);

  const updateFavorites = (
    updater: (previous: FavoriteStore) => FavoriteStore,
  ) => {
    setFavorites((previous) => {
      const next = updater(previous);
      if (next === previous) {
        return previous;
      }
      writeFavoriteStore(next);
      return next;
    });
  };

  const handleToggleFavorite = (symbol: string) => {
    updateFavorites((previous) => {
      if (previous[symbol]) {
        const next = { ...previous };
        delete next[symbol];
        return next;
      }
      return {
        ...previous,
        [symbol]: {
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

  const handleUpdateFavoriteGroup = (symbol: string, group: FavoriteGroup) => {
    updateFavorites((previous) => {
      const existing = previous[symbol];
      if (!existing || existing.group === group) {
        return previous;
      }
      return {
        ...previous,
        [symbol]: {
          ...existing,
          group,
          updatedAt: nowIso(),
        },
      };
    });
  };

  const handleUpdateFavoriteNote = (symbol: string, note: string) => {
    updateFavorites((previous) => {
      const existing = previous[symbol];
      if (!existing || existing.note === note) {
        return previous;
      }
      return {
        ...previous,
        [symbol]: {
          ...existing,
          note,
          updatedAt: nowIso(),
        },
      };
    });
  };

  const handleUpdateFavoriteField = (
    symbol: string,
    field: "targetPrice" | "stopPrice" | "holdingHorizon",
    value: string,
  ) => {
    updateFavorites((previous) => {
      const existing = previous[symbol];
      if (!existing || existing[field] === value) {
        return previous;
      }
      return {
        ...previous,
        [symbol]: {
          ...existing,
          [field]: value,
          updatedAt: nowIso(),
        },
      };
    });
  };

  const handleRemoveFavorite = (symbol: string) => {
    updateFavorites((previous) => {
      if (!previous[symbol]) {
        return previous;
      }
      const next = { ...previous };
      delete next[symbol];
      return next;
    });
  };

  const handleResetWorkspace = () => {
    setScopeFilter(DEFAULT_WORKSPACE_STATE.scopeFilter);
    setStrategyFilter(DEFAULT_WORKSPACE_STATE.strategyFilter);
    setSignalFilter(DEFAULT_WORKSPACE_STATE.signalFilter);
    setExchangeFilter(DEFAULT_WORKSPACE_STATE.exchangeFilter);
    setMarketFilter(DEFAULT_WORKSPACE_STATE.marketFilter);
    setFlowFilter(DEFAULT_WORKSPACE_STATE.flowFilter);
    setStyleFilter(DEFAULT_WORKSPACE_STATE.styleFilter);
    setIndustryFilter(DEFAULT_WORKSPACE_STATE.industryFilter);
    setAreaFilter(DEFAULT_WORKSPACE_STATE.areaFilter);
    setSearchText(DEFAULT_WORKSPACE_STATE.searchText);
    setFavoritesOnly(DEFAULT_WORKSPACE_STATE.favoritesOnly);
    setSortMode(DEFAULT_WORKSPACE_STATE.sortMode);
    setCompactMode(DEFAULT_WORKSPACE_STATE.compactMode);
    setTradeFilterExpanded(DEFAULT_WORKSPACE_STATE.tradeFilterExpanded);
    setWorkspaceFilterExpanded(DEFAULT_WORKSPACE_STATE.workspaceFilterExpanded);
  };

  const handleExport = () => {
    const rows = filteredBuckets.flatMap((bucket) =>
      bucket.topCandidates.map((candidate) => ({
        family: buildFamilyLabel(bucket.family),
        strategy: bucket.name,
        rank: candidate.rank,
        symbol: candidate.symbol,
        name: candidate.name,
        exchange: candidate.exchange || "",
        market: candidate.market || "",
        industry: candidate.industry || "",
        area: candidate.area || "",
        boardNames: candidate.boardNames || "",
        boardCount: candidate.boardCount ?? "",
        latestClose: candidate.latestClose,
        dailyChangePct: candidate.dailyChangePct,
        fitScore: candidate.fitScore,
        signal: candidate.signal,
        overallScore: candidate.overallScore,
        latestAmount: candidate.latestAmount ?? "",
        avgAmount20d: candidate.avgAmount20d ?? "",
        floatMarketCap: candidate.floatMarketCap ?? "",
        totalMarketCap: candidate.totalMarketCap ?? "",
        turnoverRate: candidate.turnoverRate ?? "",
        volumeRatio: candidate.volumeRatio ?? "",
        netMoneyFlow: candidate.netMoneyFlow ?? "",
        capitalFlowStrengthPct: candidate.capitalFlowStrengthPct ?? "",
        capitalFlowLabel: candidate.capitalFlowLabel || "",
        marketStyle: candidate.marketStyle || "",
        themeHeatScore: candidate.themeHeatScore ?? "",
        themeHeatTier: candidate.themeHeatTier || "",
        crowdingRisk: candidate.crowdingRisk || "",
        strategyAlignmentScore: candidate.strategyAlignmentScore ?? "",
        priorityScore: candidate.priorityScore ?? "",
        liquidityScore: candidate.liquidityScore ?? "",
        liquidityTier: candidate.liquidityTier ?? "",
        stance: candidate.stance,
        favoriteGroup: favorites[candidate.symbol]
          ? buildFavoriteLabel(favorites[candidate.symbol].group)
          : "",
        favoriteNote: favorites[candidate.symbol]?.note || "",
        favoriteTargetPrice: favorites[candidate.symbol]?.targetPrice || "",
        favoriteStopPrice: favorites[candidate.symbol]?.stopPrice || "",
        favoriteHoldingHorizon:
          favorites[candidate.symbol]?.holdingHorizon || "",
        favoriteAddedAt: favorites[candidate.symbol]?.addedAt || "",
        favoriteUpdatedAt: favorites[candidate.symbol]?.updatedAt || "",
        summary: candidate.summary,
      })),
    );
    if (rows.length > 0) {
      exportCandidatesToCsv(rows);
    }
  };

  return (
    <Card>
      <CardContent className="screener-panel-card">
        <div className="section-head chart-section-head">
          <div>
            <div className="section-kicker">策略总览</div>
            <h2 className="section-title">股票池与候选排序</h2>
            <div className="muted">
              这里会批量运行长线与选股策略，帮助你从灵感筛选更快切到个股复盘。
            </div>
          </div>
          <div className="button-row">
            {screener?.updatedAt ? (
              <span className="badge">更新于 {screener.updatedAt}</span>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => void onRefresh()}
              disabled={loading}
            >
              {loading ? "刷新中..." : "刷新股票池"}
            </Button>
          </div>
        </div>

        {error ? <div className="error-text">{error}</div> : null}
        {loading ? (
          <div className="muted">
            筛选任务正在后台生成，股票范围较大时会比普通接口多等一会。
          </div>
        ) : null}

        <div className="screener-overview-grid">
          <div className="research-stat-card">
            <div className="metric-label">已扫描股票</div>
            <div className="metric-value">{screener?.screenedCount ?? 0}</div>
            <div className="metric-footnote">
              拥有足够历史数据，并进入可交易性检查的股票数量。
            </div>
          </div>
          <div className="research-stat-card research-stat-card-soft">
            <div className="metric-label">通过交易过滤</div>
            <div className="metric-value">
              {screener?.eligibleCount ?? screener?.screenedCount ?? 0}
            </div>
            <div className="metric-footnote">
              通过流动性、小票、ST、次新等底层过滤后的股票数量。
            </div>
          </div>
          <div className="research-stat-card">
            <div className="metric-label">当前候选</div>
            <div className="metric-value">{visibleCandidateCount}</div>
            <div className="metric-footnote">
              应用当前页面筛选条件后仍然可见的候选股票。
            </div>
          </div>
          <div className="research-stat-card research-stat-card-soft">
            <div className="metric-label">底层剔除</div>
            <div className="metric-value">
              {screener?.filteredOutCount ?? 0}
            </div>
            <div className="metric-footnote">
              在策略打分前被交易过滤规则直接剔除的股票数量。
            </div>
          </div>
        </div>

        {screener?.filters?.active ? (
          <div className="selector-filter-summary">
            <div className="selector-filter-pills">
              {screener.filters.activeRules.map((rule) => (
                <span key={rule.key} className="selector-filter-pill">
                  {formatFilterRuleLabel(rule.key, rule.label)}:{" "}
                  {rule.displayValue}
                </span>
              ))}
              {screener.filters.reasonBreakdown.map((reason) => (
                <span key={reason.key} className="selector-filter-pill">
                  {formatFilterReasonLabel(reason.key, reason.label)}:{" "}
                  {reason.count}
                </span>
              ))}
              {screener.filters.cheapPassCount !== undefined ? (
                <span className="selector-filter-pill">
                  预过滤通过 {screener.filters.cheapPassCount}
                </span>
              ) : null}
              {screener.filters.strategyAnalyzedCount !== undefined ? (
                <span className="selector-filter-pill">
                  进入策略分析 {screener.filters.strategyAnalyzedCount}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="screener-toolbar">
          <div className="strategy-section-head">
            <div>
              <div className="section-kicker">底层交易过滤</div>
              <h3 className="strategy-section-title">预设与阈值</h3>
              <div className="muted">
                先决定股票池入口强度，再看页面内的策略筛选会更稳定。
              </div>
            </div>
            <div className="button-row">
              <span className="badge">
                当前预设 {buildPresetLabel(screenerFilters.preset)}
              </span>
              <button
                type="button"
                className={`range-pill ${tradeFilterExpanded ? "active" : ""}`}
                onClick={() => setTradeFilterExpanded((previous) => !previous)}
              >
                {tradeFilterExpanded ? "收起阈值" : "展开阈值"}
              </button>
              <Button
                variant="ghost"
                onClick={onResetScreenerFilters}
                disabled={loading}
              >
                恢复均衡
              </Button>
            </div>
          </div>

          <div className="screener-pill-row">
            {SCREENER_PRESET_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`range-pill ${(screenerFilters.preset || "balanced") === item.value ? "active" : ""}`}
                onClick={() => applyPreset(item.value)}
                disabled={loading}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="selector-filter-summary screener-toolbar-summary">
            <div className="selector-filter-pills">
              {tradeFilterSummary.map((item) => (
                <span key={item} className="selector-filter-pill">
                  {item}
                </span>
              ))}
            </div>
          </div>

          {tradeFilterExpanded ? (
            <div className="screener-filter-grid screener-filter-grid-wide">
              <label className="screener-filter-field">
                <span>20日均成交额(千元)</span>
                <input
                  className="screener-search-input"
                  type="number"
                  min={0}
                  value={screenerFilters.minAvgAmountK ?? 0}
                  onChange={(event) =>
                    updateNumericFilter("minAvgAmountK", event.target.value)
                  }
                />
              </label>

              <label className="screener-filter-field">
                <span>最新成交额(千元)</span>
                <input
                  className="screener-search-input"
                  type="number"
                  min={0}
                  value={screenerFilters.minLatestAmountK ?? 0}
                  onChange={(event) =>
                    updateNumericFilter("minLatestAmountK", event.target.value)
                  }
                />
              </label>

              <label className="screener-filter-field">
                <span>流通市值(万元)</span>
                <input
                  className="screener-search-input"
                  type="number"
                  min={0}
                  value={screenerFilters.minFloatMarketCapW ?? 0}
                  onChange={(event) =>
                    updateNumericFilter(
                      "minFloatMarketCapW",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="screener-filter-field">
                <span>总市值(万元)</span>
                <input
                  className="screener-search-input"
                  type="number"
                  min={0}
                  value={screenerFilters.minTotalMarketCapW ?? 0}
                  onChange={(event) =>
                    updateNumericFilter(
                      "minTotalMarketCapW",
                      event.target.value,
                    )
                  }
                />
              </label>

              <label className="screener-filter-field">
                <span>最少上市天数</span>
                <input
                  className="screener-search-input"
                  type="number"
                  min={0}
                  value={screenerFilters.minListedDays ?? 0}
                  onChange={(event) =>
                    updateNumericFilter("minListedDays", event.target.value)
                  }
                />
              </label>

              <label className="screener-filter-field">
                <span>剔除 ST</span>
                <select
                  className="screener-select"
                  value={String(screenerFilters.excludeSt ?? true)}
                  onChange={(event) =>
                    updateBooleanFilter("excludeSt", event.target.value)
                  }
                >
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </label>

              <label className="screener-filter-field">
                <span>剔除北交所</span>
                <select
                  className="screener-select"
                  value={String(screenerFilters.excludeBse ?? true)}
                  onChange={(event) =>
                    updateBooleanFilter("excludeBse", event.target.value)
                  }
                >
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </label>

              <label className="screener-filter-field">
                <span>剔除停牌</span>
                <select
                  className="screener-select"
                  value={String(screenerFilters.excludeSuspended ?? true)}
                  onChange={(event) =>
                    updateBooleanFilter("excludeSuspended", event.target.value)
                  }
                >
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </label>

              <label className="screener-filter-field">
                <span>剔除异常上市状态</span>
                <select
                  className="screener-select"
                  value={String(
                    screenerFilters.excludeNonListingStatus ?? true,
                  )}
                  onChange={(event) =>
                    updateBooleanFilter(
                      "excludeNonListingStatus",
                      event.target.value,
                    )
                  }
                >
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>

        <ActionBoardSection
          items={actionBoardCards}
          onSelectSymbol={onSelectSymbol}
        />
        <BoardResonanceSection
          items={boardResonanceCards}
          onSelectSymbol={onSelectSymbol}
        />

        {favoriteCount > 0 ? (
          <div className="favorite-dashboard">
            <div className="strategy-section-head">
              <div>
                <div className="section-kicker">自选分组</div>
                <h3 className="strategy-section-title">我的关注列表</h3>
                {matchedFavoriteCount < favoriteCount ? (
                  <div className="muted">
                    还有 {favoriteCount - matchedFavoriteCount}{" "}
                    个已保存股票不在当前加载深度里，可以提高展示深度或刷新股票池再看。
                  </div>
                ) : (
                  <div className="muted">
                    你可以在这里给每个自选股票补充目标价、止损价和持有周期。
                  </div>
                )}
              </div>
              <span className="badge">
                已匹配 {matchedFavoriteCount}/{favoriteCount}
              </span>
            </div>
            <div className="favorite-dashboard-grid">
              <FavoriteSection
                title="观察"
                items={favoriteCandidates.WATCH}
                onSelectSymbol={onSelectSymbol}
                onUpdateFavoriteGroup={handleUpdateFavoriteGroup}
                onRemoveFavorite={handleRemoveFavorite}
                onUpdateFavoriteNote={handleUpdateFavoriteNote}
                onUpdateFavoriteField={handleUpdateFavoriteField}
              />
              <FavoriteSection
                title="买入清单"
                items={favoriteCandidates.BUYLIST}
                onSelectSymbol={onSelectSymbol}
                onUpdateFavoriteGroup={handleUpdateFavoriteGroup}
                onRemoveFavorite={handleRemoveFavorite}
                onUpdateFavoriteNote={handleUpdateFavoriteNote}
                onUpdateFavoriteField={handleUpdateFavoriteField}
              />
              <FavoriteSection
                title="持仓"
                items={favoriteCandidates.HOLDING}
                onSelectSymbol={onSelectSymbol}
                onUpdateFavoriteGroup={handleUpdateFavoriteGroup}
                onRemoveFavorite={handleRemoveFavorite}
                onUpdateFavoriteNote={handleUpdateFavoriteNote}
                onUpdateFavoriteField={handleUpdateFavoriteField}
              />
            </div>
          </div>
        ) : null}

        <IntersectionSection
          items={intersectionCandidates}
          favorites={favorites}
          onSelectSymbol={onSelectSymbol}
          onToggleFavorite={handleToggleFavorite}
        />

        <div className="screener-toolbar">
          <div className="screener-pill-row">
            {[
              { key: "ALL", label: "全部策略池" },
              { key: "LONG_TERM", label: "长线策略" },
              { key: "STOCK_PICKING", label: "选股策略" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`range-pill ${scopeFilter === item.key ? "active" : ""}`}
                onClick={() =>
                  setScopeFilter(item.key as "ALL" | ScreenerFamily)
                }
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="screener-toolbar-topline">
            <div className="screener-depth-group">
              <span className="screener-toolbar-label">深度</span>
              <div className="screener-pill-row">
                {TOP_OPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`range-pill ${currentTop === item ? "active" : ""}`}
                    onClick={() => onChangeTop(item)}
                    disabled={loading}
                  >
                    前 {item}
                  </button>
                ))}
              </div>
            </div>

            <label className="screener-search-field">
              <span>搜索</span>
              <input
                className="screener-search-input"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="代码 / 名称 / 交易所 / 市场 / 板块 / 行业 / 地区 / 风格 / 资金流向 / 策略 / 备注"
              />
              <div className="screener-search-meta">
                <span className="selector-filter-pill muted-state">
                  {isSearchPending
                    ? "正在更新搜索结果..."
                    : rawSearchKeyword
                      ? `当前命中 ${visibleCandidateCount} 只可见股票`
                      : "支持按代码、题材、备注和风格快速过滤"}
                </span>
                {searchText ? (
                  <button
                    type="button"
                    className="filter-clear-button"
                    onClick={() => setSearchText("")}
                  >
                    清空搜索
                  </button>
                ) : null}
              </div>
            </label>
          </div>

          <div className="screener-toolbar-quickline">
            <div className="selector-filter-pills">
              {workspaceFilterSummary.map((item) => (
                <span key={item} className="selector-filter-pill">
                  {item}
                </span>
              ))}
            </div>
            <div className="button-row screener-toolbar-toggle-row">
              <button
                type="button"
                className={`range-pill ${compactMode ? "active" : ""}`}
                onClick={() => setCompactMode((previous) => !previous)}
              >
                紧凑视图
              </button>
              <button
                type="button"
                className={`range-pill ${workspaceFilterExpanded ? "active" : ""}`}
                onClick={() =>
                  setWorkspaceFilterExpanded((previous) => !previous)
                }
              >
                {workspaceFilterExpanded ? "收起高级筛选" : "展开高级筛选"}
              </button>
            </div>
          </div>

          {workspaceFilterExpanded ? (
            <div className="screener-filter-grid screener-filter-grid-wide">
              <label className="screener-filter-field">
                <span>策略</span>
                <select
                  className="screener-select"
                  value={strategyFilter}
                  onChange={(event) => setStrategyFilter(event.target.value)}
                >
                  <option value="ALL">全部策略</option>
                  {strategyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="screener-filter-field">
                <span>信号</span>
                <select
                  className="screener-select"
                  value={signalFilter}
                  onChange={(event) =>
                    setSignalFilter(event.target.value as SignalFilter)
                  }
                >
                  <option value="ALL">全部信号</option>
                  <option value="PASS">仅通过</option>
                  <option value="WATCH">仅观察</option>
                  <option value="AVOID">仅回避</option>
                </select>
              </label>

              <label className="screener-filter-field">
                <span>排序方式</span>
                <select
                  className="screener-select"
                  value={sortMode}
                  onChange={(event) =>
                    setSortMode(event.target.value as SortMode)
                  }
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="screener-filter-field">
                <span>交易所</span>
                <select
                  className="screener-select"
                  value={exchangeFilter}
                  onChange={(event) => setExchangeFilter(event.target.value)}
                >
                  <option value="ALL">全部交易所</option>
                  {exchangeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="screener-filter-field">
                <span>市场</span>
                <select
                  className="screener-select"
                  value={marketFilter}
                  onChange={(event) => setMarketFilter(event.target.value)}
                >
                  <option value="ALL">全部市场</option>
                  {marketOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="screener-filter-field">
                <span>资金流向</span>
                <select
                  className="screener-select"
                  value={flowFilter}
                  onChange={(event) =>
                    setFlowFilter(event.target.value as FlowFilter)
                  }
                >
                  <option value="ALL">全部流向</option>
                  {flowOptions.map((option) => (
                    <option key={option} value={option}>
                      {buildFlowLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="screener-filter-field">
                <span>资金风格</span>
                <select
                  className="screener-select"
                  value={styleFilter}
                  onChange={(event) =>
                    setStyleFilter(event.target.value as StyleFilter)
                  }
                >
                  <option value="ALL">全部风格</option>
                  {styleOptions.map((option) => (
                    <option key={option} value={option}>
                      {buildStyleLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="screener-filter-field">
                <span>行业</span>
                <select
                  className="screener-select"
                  value={industryFilter}
                  onChange={(event) => setIndustryFilter(event.target.value)}
                >
                  <option value="ALL">全部行业</option>
                  {industryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="screener-filter-field">
                <span>地区</span>
                <select
                  className="screener-select"
                  value={areaFilter}
                  onChange={(event) => setAreaFilter(event.target.value)}
                >
                  <option value="ALL">全部地区</option>
                  {areaOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="button-row screener-toolbar-actions">
            <button
              type="button"
              className={`range-pill ${favoritesOnly ? "active" : ""}`}
              onClick={() => setFavoritesOnly((previous) => !previous)}
            >
              {favoritesOnly ? "仅看自选" : "显示自选"}
            </button>
            <button
              type="button"
              className="filter-clear-button"
              onClick={handleResetWorkspace}
              disabled={activeFilterCount === 0}
            >
              重置筛选
            </button>
            <span className="selector-filter-pill muted-state">
              工作区状态已保存在本地
            </span>
            <Button
              variant="ghost"
              onClick={handleExport}
              disabled={visibleCandidateCount === 0}
            >
              导出 CSV
            </Button>
          </div>
        </div>

        <div className="selector-filter-summary screener-sticky-summary">
          <div className="selector-filter-pills">
            <span className="selector-filter-pill">
              {filteredBuckets.length} 个可见策略池
            </span>
            <span className="selector-filter-pill">
              {visibleCandidateCount} 只可见股票
            </span>
            <span className="selector-filter-pill">已加载前 {currentTop}</span>
            <span className="selector-filter-pill">{favoriteCount} 个自选</span>
            <span className="selector-filter-pill">
              {compactMode ? "紧凑视图" : "舒展视图"}
            </span>
            {screener?.priceSources?.display ? (
              <span className="selector-filter-pill">
                展示价 {formatPriceSourceLabel(screener.priceSources.display)}
              </span>
            ) : null}
            {screener?.priceSources?.signal ? (
              <span className="selector-filter-pill">
                信号价 {formatPriceSourceLabel(screener.priceSources.signal)}
              </span>
            ) : null}
            {screener?.eligibleCount !== undefined ? (
              <span className="selector-filter-pill">
                底层通过 {screener.eligibleCount}
              </span>
            ) : null}
            {screener?.filteredOutCount !== undefined ? (
              <span className="selector-filter-pill">
                底层剔除 {screener.filteredOutCount}
              </span>
            ) : null}
            {screener?.filters?.cheapPassCount !== undefined ? (
              <span className="selector-filter-pill">
                预过滤通过 {screener.filters.cheapPassCount}
              </span>
            ) : null}
            {screener?.filters?.strategyAnalyzedCount !== undefined ? (
              <span className="selector-filter-pill">
                策略分析 {screener.filters.strategyAnalyzedCount}
              </span>
            ) : null}
            <span className="selector-filter-pill">
              {activeFilterCount} 个筛选条件生效
            </span>
            {exchangeFilter !== "ALL" ? (
              <span className="selector-filter-pill">{exchangeFilter}</span>
            ) : null}
            {marketFilter !== "ALL" ? (
              <span className="selector-filter-pill">{marketFilter}</span>
            ) : null}
            {flowFilter !== "ALL" ? (
              <span className="selector-filter-pill">
                {buildFlowLabel(flowFilter)}
              </span>
            ) : null}
            {styleFilter !== "ALL" ? (
              <span className="selector-filter-pill">
                {buildStyleLabel(styleFilter)}
              </span>
            ) : null}
            {industryFilter !== "ALL" ? (
              <span className="selector-filter-pill">{industryFilter}</span>
            ) : null}
            {areaFilter !== "ALL" ? (
              <span className="selector-filter-pill">{areaFilter}</span>
            ) : null}
            {strategyFilter !== "ALL" ? (
              <span className="selector-filter-pill">已锁定策略</span>
            ) : null}
            {favoritesOnly ? (
              <span className="selector-filter-pill">自选模式</span>
            ) : null}
            {rawSearchKeyword ? (
              <span className="selector-filter-pill">搜索中</span>
            ) : null}
            {isSearchPending ? (
              <span className="selector-filter-pill">结果更新中</span>
            ) : null}
          </div>
        </div>

        {visiblePulseCards.length > 0 ? (
          <div className="screener-pulse-section">
            <div className="strategy-section-head">
              <div>
                <div className="section-kicker">可见股票池画像</div>
                <h3 className="strategy-section-title">先看全局，再看个股</h3>
                <div className="muted">
                  把当前筛选结果浓缩成几条高信号观察，先判断主线和节奏，再决定往下看哪些票。
                </div>
              </div>
              <span className="badge">
                基于 {uniqueCandidates.length} 只股票
              </span>
            </div>
            <div className="screener-pulse-grid">
              {visiblePulseCards.map((card) => (
                <div
                  key={card.id}
                  className={`screener-pulse-card tone-${card.tone}`}
                >
                  <div className="screener-pulse-title">{card.title}</div>
                  <div className="screener-pulse-value">{card.value}</div>
                  <div className="screener-pulse-detail">{card.detail}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="screener-grid">
          <div className="screener-column">
            <div className="strategy-section-head">
              <div>
                <div className="section-kicker">长线视角</div>
                <h3 className="strategy-section-title">长线候选池</h3>
              </div>
            </div>
            {filteredLongTerm.length > 0 ? (
              <div className="screener-bucket-list">
                {filteredLongTerm.map((bucket) =>
                  renderBucket(
                    bucket,
                    favorites,
                    handleToggleFavorite,
                    handleUpdateFavoriteGroup,
                    onSelectSymbol,
                    compactMode,
                  ),
                )}
              </div>
            ) : (
              <div className="selector-empty-state">
                当前筛选条件下没有匹配的长线策略池。
              </div>
            )}
          </div>

          <div className="screener-column">
            <div className="strategy-section-head">
              <div>
                <div className="section-kicker">选股视角</div>
                <h3 className="strategy-section-title">选股候选池</h3>
              </div>
            </div>
            {filteredStockPickers.length > 0 ? (
              <div className="screener-bucket-list">
                {filteredStockPickers.map((bucket) =>
                  renderBucket(
                    bucket,
                    favorites,
                    handleToggleFavorite,
                    handleUpdateFavoriteGroup,
                    onSelectSymbol,
                    compactMode,
                  ),
                )}
              </div>
            ) : (
              <div className="selector-empty-state">
                当前筛选条件下没有匹配的选股策略池。
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

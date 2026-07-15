import type { PropsWithChildren } from "react";
import { Suspense, lazy, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import { routePaths } from "../router/routeAccess";
import type { MarketSnapshot, ScreenerQueryOptions, ScreenerSnapshot, StockItem } from "../types/type";

const MarketPanel = lazy(() => import("./MarketPanel"));
const ScreenerPanel = lazy(() => import("./ScreenerPanel"));
const LogsPanel = lazy(() => import("./LogsPanel"));
const NotificationsPanel = lazy(() => import("./NotificationsPanel"));
const ConfigPanel = lazy(() => import("./ConfigPanel"));

interface NavItem {
  id: string;
  label: string;
  title: string;
}
const navItems: NavItem[] = [
  { id: "market", label: "行情面板", title: "实时行情与同步元数据" },
  { id: "screener", label: "筛选器", title: "策略池、筛选条件、收藏与导出" },
  { id: "logs", label: "执行日志", title: "策略执行记录" },
  { id: "notifications", label: "通知提醒", title: "通知配置" },
  { id: "config", label: "策略参数", title: "交易参数配置" },
];

interface StockLayoutProps extends PropsWithChildren {
  snapshot?: MarketSnapshot | null;
  connected?: boolean;
  error?: string | null;
  busy?: boolean;
  message?: string;
  stocks?: StockItem[];
  stocksLoading?: boolean;
  stocksError?: string;
  selectedSymbol?: string;
  currentStockName?: string;
  currentStockCode?: string;
  databaseLoading?: boolean;
  databaseError?: string;
  screener?: ScreenerSnapshot | null;
  screenerLoading?: boolean;
  screenerError?: string;
  screenerTop?: number;
  screenerFilters?: ScreenerQueryOptions;
  selectedRange?: string;
  rangeOptions?: ReadonlyArray<{ key: string; label: string }>;
  onSelectSymbol?: (symbol: string) => void;
  onSelectRange?: (range: string) => void;
  onRefreshScreener?: () => Promise<void>;
  onChangeScreenerTop?: (top: number) => void;
  onChangeScreenerFilters?: (filters: ScreenerQueryOptions) => void;
  onResetScreenerFilters?: () => void;
  onBuy?: () => Promise<void>;
  onSell?: () => Promise<void>;
  onStart?: () => Promise<void>;
  onStop?: () => Promise<void>;
}

export default function StockLayout({
  children,
  snapshot,
  connected = false,
  error = null,
  busy = false,
  message = "",
  stocks = [],
  stocksLoading = false,
  stocksError = "",
  selectedSymbol = "",
  currentStockName = "",
  currentStockCode = "",
  databaseLoading = false,
  databaseError = "",
  screener = null,
  screenerLoading = false,
  screenerError = "",
  screenerTop = 6,
  screenerFilters = {},
  selectedRange = "",
  rangeOptions = [],
  onSelectSymbol,
  onSelectRange,
  onRefreshScreener,
  onChangeScreenerTop,
  onChangeScreenerFilters,
  onResetScreenerFilters,
  onBuy,
  onSell,
  onStart,
  onStop,
}: StockLayoutProps) {
  const [activeNav, setActiveNav] = useState("market");
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const currentTitle = useMemo(() => {
    if (activeNav === "market" && currentStockName) {
      return currentStockName;
    }
    return navItems.find((item) => item.id === activeNav)?.title ?? "实时行情与同步元数据";
  }, [activeNav, currentStockName]);

  const displayUsername = user?.username || localStorage.getItem("username") || "未登录用户";

  const handleLogout = async () => {
    await logout();
    navigate(routePaths.login);
  };

  const renderContent = () => {
    if (activeNav === "market") {
      return (
        <Suspense fallback={<div className="muted">正在加载行情面板...</div>}>
          <MarketPanel
            snapshot={snapshot ?? null}
            screener={screener}
            connected={connected}
            error={error}
            busy={busy}
            message={message}
            stocks={stocks}
            stocksLoading={stocksLoading}
            stocksError={stocksError}
            selectedSymbol={selectedSymbol}
            selectedRange={selectedRange}
            databaseLoading={databaseLoading}
            databaseError={databaseError}
            rangeOptions={rangeOptions}
            onSelectSymbol={onSelectSymbol || (() => {})}
            onSelectRange={onSelectRange || (() => {})}
            onBuy={onBuy || (async () => {})}
            onSell={onSell || (async () => {})}
            onStart={onStart || (async () => {})}
            onStop={onStop || (async () => {})}
          />
        </Suspense>
      );
    }

    if (activeNav === "screener") {
      return (
        <Suspense fallback={<div className="muted">正在加载筛选面板...</div>}>
          <ScreenerPanel
            screener={screener}
            loading={screenerLoading}
            error={screenerError}
            currentTop={screenerTop}
            screenerFilters={screenerFilters}
            onRefresh={onRefreshScreener || (async () => {})}
            onChangeTop={onChangeScreenerTop || (() => {})}
            onChangeScreenerFilters={onChangeScreenerFilters || (() => {})}
            onResetScreenerFilters={onResetScreenerFilters || (() => {})}
            onSelectSymbol={(symbol) => {
              setActiveNav("market");
              (onSelectSymbol || (() => {}))(symbol);
            }}
          />
        </Suspense>
      );
    }

    if (activeNav === "logs") {
      return (
        <Suspense fallback={<div className="muted">正在加载日志...</div>}>
          <LogsPanel />
        </Suspense>
      );
    }

    if (activeNav === "notifications") {
      return (
        <Suspense fallback={<div className="muted">正在加载通知设置...</div>}>
          <NotificationsPanel />
        </Suspense>
      );
    }

    if (activeNav === "config") {
      return (
        <Suspense fallback={<div className="muted">正在加载策略参数...</div>}>
          <ConfigPanel
            snapshot={snapshot ?? null}
            connected={connected}
            busy={busy}
            onBuy={onBuy || (async () => {})}
            onSell={onSell || (async () => {})}
            onStart={onStart || (async () => {})}
            onStop={onStop || (async () => {})}
          />
        </Suspense>
      );
    }

    return children;
  };

  return (
    <div className="app-shell stock-shell">
      <aside className="sidebar stock-sidebar">
        <div>
          <div className="brand">CTT Pro</div>
          <div className="brand-sub">量化交易工作台</div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeNav === item.id ? "active" : ""}`}
              onClick={() => setActiveNav(item.id)}
              aria-pressed={activeNav === item.id}
            >
              <span className="nav-item-label">{item.label}</span>
              <span className="nav-item-title">{item.title}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-user-card">
          <div className="sidebar-user-copy">
            <span className="sidebar-user-label">当前账号</span>
            <strong className="sidebar-user-name">{displayUsername}</strong>
          </div>
          <button className="sidebar-logout-button" onClick={() => void handleLogout()}>
            退出登录
          </button>
        </div>
      </aside>

      <div className="main-column stock-main-column">
        <header className="topbar stock-topbar">
          <div>
            <div className="topbar-eyebrow">股票工作台</div>
            <div className="topbar-title">{currentTitle || "实时行情与同步元数据"}</div>
            <div className="muted stock-topbar-copy">
              {activeNav === "market" && currentStockName
                ? `当前查看：${currentStockName}${currentStockCode ? ` / ${currentStockCode}` : ""}`
                : activeNav === "screener"
                ? "查看策略池结果，按条件筛选候选股票，并导出当前可见列表。"
                : "把行情、策略动作、同步基本面和执行记录集中在同一个工作区里。"}
            </div>
          </div>
          <div className="topbar-right stock-topbar-right">
            <span className={`dot ${connected ? "online" : "offline"}`} />
            <span>{connected ? "已连接" : "等待数据"}</span>
          </div>
        </header>

        <main className="content stock-content">{renderContent()}</main>
      </div>
    </div>
  );
}

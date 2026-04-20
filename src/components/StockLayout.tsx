import type { PropsWithChildren } from "react";
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/useAuth";
import type { MarketSnapshot, StockItem } from "../types/type";
import ConfigPanel from "./ConfigPanel";
import LogsPanel from "./LogsPanel";
import MarketPanel from "./MarketPanel";
import NotificationsPanel from "./NotificationsPanel";

interface NavItem {
  id: string;
  label: string;
  title: string;
}

const navItems: NavItem[] = [
  { id: "market", label: "行情总览", title: "实时策略与行情" },
  { id: "logs", label: "策略日志", title: "策略执行日志" },
  { id: "notifications", label: "邮件通知", title: "邮件通知设置" },
  { id: "config", label: "参数配置", title: "策略参数配置" },
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
  selectedRange?: string;
  rangeOptions?: ReadonlyArray<{ key: string; label: string }>;
  onSelectSymbol?: (symbol: string) => void;
  onSelectRange?: (range: string) => void;
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
  selectedRange = "",
  rangeOptions = [],
  onSelectSymbol,
  onSelectRange,
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
    return navItems.find((item) => item.id === activeNav)?.title ?? "实时策略与行情";
  }, [activeNav, currentStockName]);

  const displayUsername = user?.username || localStorage.getItem("username") || "用户";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const renderContent = () => {
    if (activeNav === "market") {
      return (
        <MarketPanel
          snapshot={snapshot}
          connected={connected}
          error={error}
          busy={busy}
          message={message}
          stocks={stocks}
          stocksLoading={stocksLoading}
          stocksError={stocksError}
          selectedSymbol={selectedSymbol}
          selectedRange={selectedRange}
          rangeOptions={rangeOptions}
          onSelectSymbol={onSelectSymbol || (() => {})}
          onSelectRange={onSelectRange || (() => {})}
          onBuy={onBuy || (async () => {})}
          onSell={onSell || (async () => {})}
          onStart={onStart || (async () => {})}
          onStop={onStop || (async () => {})}
        />
      );
    }

    if (activeNav === "logs") {
      return <LogsPanel />;
    }

    if (activeNav === "notifications") {
      return <NotificationsPanel />;
    }

    if (activeNav === "config") {
      return <ConfigPanel />;
    }

    return children;
  };

  return (
    <div className="app-shell stock-shell">
      <aside className="sidebar stock-sidebar">
        <div>
          <div className="brand">CTT Pro</div>
          <div className="brand-sub">股票与基金量化监控台</div>
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
            退出
          </button>
        </div>
      </aside>

      <div className="main-column stock-main-column">
        <header className="topbar stock-topbar">
          <div>
            <div className="topbar-eyebrow">股票页</div>
            <div className="topbar-title">{currentTitle || "实时策略与行情"}</div>
            <div className="muted stock-topbar-copy">
              {activeNav === "market" && currentStockName
                ? `当前展示 ${currentStockName}${currentStockCode ? ` · ${currentStockCode}` : ""}`
                : "Java 行情代理、轮询刷新与策略联动"}
            </div>
          </div>
          <div className="topbar-right stock-topbar-right">
            <span className={`dot ${connected ? "online" : "offline"}`} />
            <span>{connected ? "数据已连接" : "等待连接"}</span>
          </div>
        </header>

        <main className="content stock-content">{renderContent()}</main>
      </div>
    </div>
  );
}

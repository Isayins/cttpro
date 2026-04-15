import type { PropsWithChildren } from "react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import MarketPanel from "./MarketPanel";
import LogsPanel from "./LogsPanel";
import NotificationsPanel from "./NotificationsPanel";
import ConfigPanel from "./ConfigPanel";

interface NavItem {
  id: string;
  label: string;
  title: string;
}

const navItems: NavItem[] = [
  { id: "market", label: "行情面板", title: "实时策略与行情" },
  { id: "logs", label: "策略日志", title: "策略执行日志" },
  { id: "notifications", label: "邮件通知", title: "邮件通知设置" },
  { id: "config", label: "参数配置", title: "策略参数配置" },
];

interface StockLayoutProps extends PropsWithChildren {
  snapshot?: any;
  connected?: boolean;
  error?: string | null;
  busy?: boolean;
  message?: string;
  onBuy?: () => void;
  onSell?: () => void;
  onStart?: () => void;
  onStop?: () => void;
}

export default function StockLayout({ 
  children, 
  snapshot, 
  connected = false, 
  error = null, 
  busy = false, 
  message = "",
  onBuy,
  onSell,
  onStart,
  onStop
}: StockLayoutProps) {
  const [activeNav, setActiveNav] = useState<string>("market");
  const navigate = useNavigate();

  const handleNavClick = (navId: string) => {
    setActiveNav(navId);
  };

  const getCurrentTitle = () => {
    const currentItem = navItems.find(item => item.id === activeNav);
    return currentItem?.title || "实时策略与行情";
  };

  const handleLogout = () => {
    // 清除登录状态
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("username");
    // 重定向到登录页面
    navigate("/login");
  };

  const getUsername = () => {
    return localStorage.getItem("username") || "用户";
  };

  const renderContent = () => {
    switch (activeNav) {
      case "market":
        return (
          <MarketPanel 
            snapshot={snapshot}
            connected={connected}
            error={error}
            busy={busy}
            message={message}
            onBuy={onBuy || (() => {})}
            onSell={onSell || (() => {})}
            onStart={onStart || (() => {})}
            onStop={onStop || (() => {})}
          />
        );
      case "logs":
        return <LogsPanel />;
      case "notifications":
        return <NotificationsPanel />;
      case "config":
        return <ConfigPanel />;
      default:
        return children;
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">CTT Pro</div>
          <div className="brand-sub">量化交易控制台</div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <div
              key={item.id}
              className={`nav-item ${activeNav === item.id ? "active" : ""}`}
              onClick={() => handleNavClick(item.id)}
              style={{ cursor: "pointer" }}
            >
              {item.label}
            </div>
          ))}
        </nav>
        
        <div style={{ position: "absolute", bottom: "20px", width: "100%", padding: "0 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#666", fontSize: "14px" }}>欢迎, {getUsername()}</span>
            <button 
              onClick={handleLogout}
              style={{ 
                background: "none", 
                border: "1px solid #1890ff", 
                color: "#1890ff", 
                padding: "4px 12px", 
                borderRadius: "4px", 
                fontSize: "12px",
                cursor: "pointer"
              }}
            >
              登出
            </button>
          </div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <div className="topbar-title">{getCurrentTitle()}</div>
            <div className="muted">TuShare 数据 + 邮件提醒 + WebSocket 推送</div>
          </div>
          <div className="topbar-right">
            <span className="dot" />
            <span>运行中</span>
          </div>
        </header>

        <main className="content">{renderContent()}</main>
      </div>
    </div>
  );
}
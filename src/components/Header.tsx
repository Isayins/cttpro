import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, Badge, Button, Drawer, Dropdown, Empty, List, Space, Spin, Tag, message } from "antd";
import {
  BellOutlined,
  LoginOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  SettingOutlined,
  StockOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";

import logo from "../store/images/idncar.png";
import { useAuth } from "../context/useAuth";
import { resolveAssetUrl } from "../lib/media";
import { notificationApi, siteNoticeApi } from "../services/api";
import type { SiteNotice, UserNotification } from "../types/app";

interface NavItem {
  label: string;
  to: string;
  requiresAuth?: boolean;
  adminOnly?: boolean;
}

const baseItems: NavItem[] = [
  { label: "首页", to: "/" },
  { label: "关于", to: "/about" },
  { label: "下载中心", to: "/downloads" },
  { label: "实用工具", to: "/tools" },
  { label: "随便聊聊", to: "/randomtalk" },
  { label: "聊天室", to: "/chat" },
];

interface NotificationListItem {
  key: string;
  title: string;
  content: string;
  createTime?: string | null;
  path?: string | null;
  read: boolean;
  source: "notice" | "message";
  notificationId?: number;
}

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationItems, setNotificationItems] = useState<NotificationListItem[]>([]);

  const navItems = useMemo(
    () =>
      [
        ...baseItems,
        ...(isAuthenticated
          ? [
              { label: "股票页面", to: "/stock", requiresAuth: true },
              { label: "论坛交流", to: "/forum", requiresAuth: true },
              { label: "个人资料", to: "/profile", requiresAuth: true },
            ]
          : []),
        ...(isAdmin ? [{ label: "管理后台", to: "/admin", requiresAuth: true, adminOnly: true }] : []),
      ].filter((item) => (!item.requiresAuth || isAuthenticated) && (!item.adminOnly || isAdmin)),
    [isAdmin, isAuthenticated],
  );

  async function handleLogout() {
    await logout();
    message.success("已退出登录");
    navigate("/");
  }

  const loadNotificationCenter = useCallback(async () => {
    if (!isAuthenticated) {
      setNotificationItems([]);
      setUnreadCount(0);
      return;
    }

    setNotificationsLoading(true);
    try {
      const [notifications, unread, notices] = await Promise.all([
        notificationApi.getNotifications(20),
        notificationApi.getUnreadCount(),
        siteNoticeApi.getSiteNotices().catch(() => [] as SiteNotice[]),
      ]);

      const personalItems: NotificationListItem[] = notifications.map((item: UserNotification) => ({
        key: `message-${item.id}`,
        title: item.title,
        content: item.content,
        createTime: item.createTime,
        path: item.relatedPath,
        read: item.read,
        source: "message",
        notificationId: item.id,
      }));

      const noticeItems: NotificationListItem[] = notices.slice(0, 6).map((item) => ({
        key: `notice-${item.id}`,
        title: item.title,
        content: item.content,
        createTime: item.updateTime ?? item.createTime,
        path: "/#site-notices",
        read: true,
        source: "notice",
      }));

      setNotificationItems(
        [...personalItems, ...noticeItems].sort(
          (a, b) => new Date(b.createTime ?? 0).getTime() - new Date(a.createTime ?? 0).getTime(),
        ),
      );
      setUnreadCount(unread.count ?? 0);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载消息中心失败");
    } finally {
      setNotificationsLoading(false);
    }
  }, [isAuthenticated]);

  const navigateToNotificationPath = useCallback(
    (path: string) => {
      if (/^https?:\/\//.test(path)) {
        window.location.assign(path);
        return;
      }

      navigate(path);
      if (!path.includes("#")) {
        return;
      }

      const hash = path.slice(path.indexOf("#") + 1);
      window.setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    },
    [navigate],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setNotificationItems([]);
      setUnreadCount(0);
      return;
    }
    void loadNotificationCenter();
  }, [isAuthenticated, loadNotificationCenter]);

  async function handleNotificationClick(item: NotificationListItem) {
    if (item.source === "message" && item.notificationId && !item.read) {
      try {
        await notificationApi.markRead(item.notificationId);
        setUnreadCount((current) => Math.max(0, current - 1));
        setNotificationItems((current) =>
          current.map((entry) => (entry.key === item.key ? { ...entry, read: true } : entry)),
        );
      } catch {
        // ignore read failures so navigation still works
      }
    }

    setNotificationsOpen(false);
    if (item.path) {
      navigateToNotificationPath(item.path);
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationApi.markAllRead();
      setUnreadCount(0);
      setNotificationItems((current) => current.map((item) => (item.source === "message" ? { ...item, read: true } : item)));
      message.success("消息已全部标记为已读");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "操作失败");
    }
  }

  const userMenuItems = isAuthenticated
    ? [
        {
          key: "profile",
          icon: <UserOutlined />,
          label: <Link to="/profile">个人资料</Link>,
        },
        {
          key: "stock",
          icon: <StockOutlined />,
          label: <Link to="/stock">股票页面</Link>,
        },
        {
          key: "forum",
          icon: <MessageOutlined />,
          label: <Link to="/forum">论坛交流</Link>,
        },
        ...(isAdmin
          ? [
              {
                key: "admin",
                icon: <SettingOutlined />,
                label: <Link to="/admin">管理后台</Link>,
              },
            ]
          : []),
        {
          key: "logout",
          icon: <LogoutOutlined />,
          label: <span onClick={() => void handleLogout()}>退出登录</span>,
        },
      ]
    : [
        {
          key: "login",
          icon: <LoginOutlined />,
          label: <Link to="/login">登录 / 注册</Link>,
        },
      ];

  function renderDrawerAction(
    key: string,
    label: string,
    icon: ReactNode,
    onClick: () => void,
    danger = false,
  ) {
    return (
      <button
        key={key}
        className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left transition ${
          danger
            ? "border-slate-200 text-rose-600 hover:border-rose-200 hover:bg-rose-50"
            : "border-slate-200 text-slate-700 hover:border-[#b9d6ff] hover:bg-[#eff6ff]"
        }`}
        onClick={onClick}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/45 bg-white/60 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src={logo}
              alt="IDNCAR"
              className="h-10 w-10 rounded-2xl border border-white/70 bg-white/80 p-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
            />
            <div className="min-w-0">
              <div className="text-lg font-semibold tracking-[0.08em] text-slate-900">IDNCAR</div>
              <div className="text-[11px] text-slate-500"></div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative py-1 text-sm transition ${
                    isActive ? "font-medium text-slate-900" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute -bottom-[18px] left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-[#2586ff]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {isAdmin && (
              <Tag color={user?.role === "OWNER" ? "purple" : "blue"}>
                {user?.role === "OWNER" ? "网站拥有者" : "管理员"}
              </Tag>
            )}
            {isAuthenticated ? (
              <button
                type="button"
                className="rounded-full border border-white/80 bg-white/75 p-2 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:bg-white"
                onClick={() => {
                  setNotificationsOpen(true);
                  void loadNotificationCenter();
                }}
              >
                <Badge count={unreadCount} size="small">
                  <BellOutlined className="text-slate-700" />
                </Badge>
              </button>
            ) : null}
            {isAuthenticated ? (
              <Dropdown menu={{ items: userMenuItems }} trigger={["click"]}>
                <button className="flex items-center gap-2 rounded-full border border-white/80 bg-white/75 px-3 py-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:bg-white">
                  <Avatar src={resolveAssetUrl(user?.avatarUrl)} size="small" icon={<UserOutlined />}>
                    {user?.nickname?.[0]}
                  </Avatar>
                  <span className="max-w-28 truncate text-sm text-slate-700">{user?.nickname ?? "访客"}</span>
                </button>
              </Dropdown>
            ) : (
              <Link to="/login">
                <Button type="text" className="rounded-full border border-white/80 bg-white/75 shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                  登录
                </Button>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-1 md:hidden">
            {isAuthenticated ? (
              <Button
                type="text"
                icon={
                  <Badge count={unreadCount} size="small">
                    <BellOutlined />
                  </Badge>
                }
                onClick={() => {
                  setNotificationsOpen(true);
                  void loadNotificationCenter();
                }}
              />
            ) : null}
            <Button className="md:hidden" type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} />
          </div>
        </div>
      </header>

      <Drawer title="导航菜单" placement="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <Avatar src={resolveAssetUrl(user?.avatarUrl)} icon={<UserOutlined />}>
                {user?.nickname?.[0]}
              </Avatar>
              <div>
                <div className="font-medium text-slate-900">{user?.nickname ?? "访客"}</div>
                <div className="text-sm text-slate-500">{user?.username ?? "点击登录"}</div>
              </div>
            </div>
          </div>

          <Space direction="vertical" className="w-full">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setDrawerOpen(false)}
                className={`block rounded-2xl border px-4 py-3 text-sm transition ${
                  location.pathname === item.to
                    ? "border-[#b9d6ff] bg-[#eff6ff] text-[#2586ff]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-[#b9d6ff] hover:bg-[#eff6ff]"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </Space>

          <div className="space-y-2 rounded-3xl border border-slate-200 bg-white p-4">
            {isAuthenticated ? (
              <>
                {renderDrawerAction("stock", "股票页面", <StockOutlined />, () => {
                  setDrawerOpen(false);
                  navigate("/stock");
                })}
                {renderDrawerAction("forum", "论坛交流", <MessageOutlined />, () => {
                  setDrawerOpen(false);
                  navigate("/forum");
                })}
                {renderDrawerAction("profile", "个人资料", <UserOutlined />, () => {
                  setDrawerOpen(false);
                  navigate("/profile");
                })}
                {renderDrawerAction("tools", "实用工具", <ToolOutlined />, () => {
                  setDrawerOpen(false);
                  navigate("/tools");
                })}
                {renderDrawerAction("notifications", "消息中心", <BellOutlined />, () => {
                  setDrawerOpen(false);
                  setNotificationsOpen(true);
                  void loadNotificationCenter();
                })}
                {isAdmin
                  ? renderDrawerAction("admin", "管理后台", <SettingOutlined />, () => {
                      setDrawerOpen(false);
                      navigate("/admin");
                    })
                  : null}
                {renderDrawerAction("logout", "退出登录", <LogoutOutlined />, () => {
                  setDrawerOpen(false);
                  void handleLogout();
                }, true)}
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setDrawerOpen(false)}
                className="block rounded-2xl bg-[#2586ff] px-4 py-3 text-center text-white"
              >
                登录 / 注册
              </Link>
            )}
          </div>
        </div>
      </Drawer>

      <Drawer
        title="消息中心"
        placement="right"
        width={380}
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        extra={
          isAuthenticated ? (
            <Button type="link" className="px-0" onClick={() => void handleMarkAllRead()}>
              全部已读
            </Button>
          ) : null
        }
      >
        {notificationsLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spin />
          </div>
        ) : notificationItems.length === 0 ? (
          <Empty description="暂时还没有消息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={notificationItems}
            renderItem={(item) => (
              <List.Item className="px-0">
                <button
                  type="button"
                  onClick={() => void handleNotificationClick(item)}
                  className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                    item.source === "message" && !item.read
                      ? "border-[#cfe0ff] bg-[#f6f9ff]"
                      : "border-slate-200 bg-white hover:border-[#d5e3ff] hover:bg-[#f8fbff]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Tag color={item.source === "notice" ? "blue" : item.read ? "default" : "gold"}>
                        {item.source === "notice" ? "站点公告" : item.read ? "已读消息" : "未读消息"}
                      </Tag>
                      <div className="font-medium text-slate-900">{item.title}</div>
                    </div>
                    <span className="text-xs text-slate-400">{item.createTime || ""}</span>
                  </div>
                  <div className="mt-2 line-clamp-3 text-sm leading-7 text-slate-600">{item.content}</div>
                </button>
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </>
  );
}

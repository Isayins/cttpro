import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, Badge, Button, Dropdown, Tag, message } from "antd";
import {
  BellOutlined,
  LoginOutlined,
  LogoutOutlined,
  MenuOutlined,
  UserOutlined,
} from "@ant-design/icons";

import logo from "../store/images/idncar.png";
import { useAuth } from "../context/useAuth";
import {
  layoutContentWidthClass,
  type LayoutContentWidth,
} from "../layouts/layoutWidth";
import { resolveAssetUrl } from "../lib/media";
import { homeAnchors, routePaths } from "../router/routeAccess";
import {
  accountMenuActions,
  adminNavItems,
  authenticatedNavItems,
  cleanItems,
  isNavItemActive,
  isVisibleForUser,
  primaryNavItems,
  publicHomeItems,
} from "./headerNavigation";

const HeaderMobileDrawer = lazy(() => import("./HeaderMobileDrawer"));
const NotificationCenterDrawer = lazy(
  () => import("./NotificationCenterDrawer"),
);

interface HeaderProps {
  variant?: "default" | "clean";
  contentWidth?: LayoutContentWidth;
}

export default function Header({
  variant = "default",
  contentWidth = "default",
}: HeaderProps) {
  const isClean = variant === "clean";
  const contentWidthClass = layoutContentWidthClass[contentWidth];
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRequested, setDrawerRequested] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const navItems = useMemo(() => {
    if (isClean) {
      return cleanItems;
    }

    return [
      ...primaryNavItems,
      ...(!isAuthenticated && location.pathname === routePaths.home ? publicHomeItems : []),
      ...(isAuthenticated ? authenticatedNavItems : []),
      ...adminNavItems,
    ].filter((item) => isVisibleForUser(item, isAuthenticated, isAdmin));
  }, [isAdmin, isAuthenticated, isClean, location.pathname]);

  async function handleLogout() {
    await logout();
    message.success("已退出登录");
    navigate(routePaths.home);
  }

  useEffect(() => {
    if (isClean || !isAuthenticated) {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    void import("../services/api/notification")
      .then(({ notificationApi }) => notificationApi.getUnreadCount())
      .then((unread) => {
        if (!cancelled) {
          setUnreadCount(unread.count ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnreadCount(0);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isClean]);

  const userMenuItems = isAuthenticated
    ? [
        ...accountMenuActions
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => ({
            key: item.key,
            icon: item.icon,
            label: <Link to={item.to}>{item.label}</Link>,
          })),
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
          label: <Link to={routePaths.login}>登录 / 注册</Link>,
        },
      ];

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/45 bg-white/60 backdrop-blur-2xl">
        <div
          className={`mx-auto flex h-16 ${contentWidthClass} items-center justify-between gap-4 px-4 md:px-6`}
        >
          <Link to={routePaths.home} className="flex min-w-0 items-center gap-3">
            <img
              src={logo}
              alt="IDNCAR"
              className="h-10 w-10 rounded-lg border border-white/70 bg-white/80 p-1 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
            />
            <div className="min-w-0">
              <div className="text-lg font-semibold tracking-[0.08em] text-slate-900">
                IDNCAR
              </div>
              <div className="text-[11px] text-slate-500"></div>
            </div>
          </Link>

          <nav className="hidden items-center gap-5 xl:flex">
            {navItems.map((item) => {
              const isActive = isNavItemActive(
                item,
                location.pathname,
                location.hash,
              );
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`relative py-1 text-sm transition ${
                    isActive
                      ? "font-medium text-slate-900"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute -bottom-[18px] left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-[#2586ff]" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 xl:flex">
            {isClean ? (
              <a
                href={homeAnchors.notes}
                className="rounded-lg border border-slate-200 bg-white/75 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:bg-white"
              >
                学习记录
              </a>
            ) : null}
            {!isClean && isAdmin && (
              <Tag color={user?.role === "OWNER" ? "purple" : "blue"}>
                {user?.role === "OWNER" ? "网站拥有者" : "管理员"}
              </Tag>
            )}
            {!isClean && isAuthenticated ? (
              <button
                type="button"
                aria-label="打开消息中心"
                title="打开消息中心"
                className="rounded-lg border border-white/80 bg-white/75 p-2 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:bg-white"
                onClick={() => {
                  setNotificationsOpen(true);
                }}
              >
                <Badge count={unreadCount} size="small">
                  <BellOutlined className="text-slate-700" />
                </Badge>
              </button>
            ) : null}
            {!isClean && isAuthenticated ? (
              <Dropdown menu={{ items: userMenuItems }} trigger={["click"]}>
                <button
                  type="button"
                  aria-label="打开账号菜单"
                  title="打开账号菜单"
                  className="flex items-center gap-2 rounded-lg border border-white/80 bg-white/75 px-3 py-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition hover:bg-white"
                >
                  <Avatar
                    src={resolveAssetUrl(user?.avatarUrl)}
                    size="small"
                    icon={<UserOutlined />}
                  >
                    {user?.nickname?.[0]}
                  </Avatar>
                  <span className="max-w-28 truncate text-sm text-slate-700">
                    {user?.nickname ?? "访客"}
                  </span>
                </button>
              </Dropdown>
            ) : !isClean ? (
              <Link to={routePaths.login}>
                <Button
                  type="text"
                  className="rounded-lg border border-white/80 bg-white/75 shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
                >
                  登录
                </Button>
              </Link>
            ) : null}
          </div>

          <div className="flex items-center gap-1 xl:hidden">
            {!isClean && isAuthenticated ? (
              <Button
                type="text"
                aria-label="打开消息中心"
                title="打开消息中心"
                icon={
                  <Badge count={unreadCount} size="small">
                    <BellOutlined />
                  </Badge>
                }
                onClick={() => {
                  setNotificationsOpen(true);
                }}
              />
            ) : null}
            <Button
              className="xl:hidden"
              type="text"
              aria-label="打开导航菜单"
              title="打开导航菜单"
              icon={<MenuOutlined />}
              onClick={() => {
                setDrawerRequested(true);
                setDrawerOpen(true);
              }}
            />
          </div>
        </div>
      </header>

      {drawerRequested ? (
        <Suspense fallback={null}>
          <HeaderMobileDrawer
            open={drawerOpen}
            isClean={isClean}
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
            user={user}
            navItems={navItems}
            pathname={location.pathname}
            hash={location.hash}
            onClose={() => setDrawerOpen(false)}
            onAfterOpenChange={(open) => {
              if (!open) {
                setDrawerRequested(false);
              }
            }}
            onOpenNotifications={() => setNotificationsOpen(true)}
            onLogout={() => void handleLogout()}
          />
        </Suspense>
      ) : null}

      {!isClean && isAuthenticated && notificationsOpen ? (
        <Suspense fallback={null}>
          <NotificationCenterDrawer
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
            onUnreadCountChange={setUnreadCount}
          />
        </Suspense>
      ) : null}
    </>
  );
}

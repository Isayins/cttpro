import { type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, Drawer } from "antd";
import {
  BellOutlined,
  LoginOutlined,
  LogoutOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { resolveAssetUrl } from "../lib/media";
import { routePaths } from "../router/routeAccess";
import type { User } from "../types/app";
import {
  drawerShortcutActions,
  isNavItemActive,
  type NavItem,
} from "./headerNavigation";

interface HeaderMobileDrawerProps {
  open: boolean;
  isClean: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: User | null;
  navItems: NavItem[];
  pathname: string;
  hash: string;
  onClose: () => void;
  onAfterOpenChange: (open: boolean) => void;
  onOpenNotifications: () => void;
  onLogout: () => void;
}

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
      type="button"
      className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
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

export default function HeaderMobileDrawer({
  open,
  isClean,
  isAuthenticated,
  isAdmin,
  user,
  navItems,
  pathname,
  hash,
  onClose,
  onAfterOpenChange,
  onOpenNotifications,
  onLogout,
}: HeaderMobileDrawerProps) {
  const navigate = useNavigate();

  function handleNavigate(to: string) {
    onClose();
    navigate(to);
  }

  return (
    <Drawer
      title={isClean ? "学习导航" : "导航菜单"}
      placement="right"
      open={open}
      onClose={onClose}
      afterOpenChange={onAfterOpenChange}
    >
      <div className="space-y-4">
        {!isClean ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <Avatar
                src={resolveAssetUrl(user?.avatarUrl)}
                icon={<UserOutlined />}
              >
                {user?.nickname?.[0]}
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-900">
                  {user?.nickname ?? "访客"}
                </div>
                <div className="truncate text-sm text-slate-500">
                  {user?.username ?? "点击登录"}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {navItems.map((item) => {
            const isActive = isNavItemActive(item, pathname, hash);

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`block rounded-lg border px-4 py-3 text-sm transition ${
                  isActive
                    ? "border-[#b9d6ff] bg-[#eff6ff] text-[#2586ff]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-[#b9d6ff] hover:bg-[#eff6ff]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {!isClean ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            {isAuthenticated ? (
              <>
                {drawerShortcutActions
                  .filter((item) => !item.adminOnly || isAdmin)
                  .map((item) =>
                    renderDrawerAction(item.key, item.label, item.icon, () =>
                      handleNavigate(item.to),
                    ),
                  )}
                {renderDrawerAction(
                  "notifications",
                  "消息中心",
                  <BellOutlined />,
                  () => {
                    onClose();
                    onOpenNotifications();
                  },
                )}
                {renderDrawerAction(
                  "logout",
                  "退出登录",
                  <LogoutOutlined />,
                  () => {
                    onClose();
                    onLogout();
                  },
                  true,
                )}
              </>
            ) : (
              <Link
                to={routePaths.login}
                onClick={onClose}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#2586ff] px-4 py-3 text-center text-white"
              >
                <LoginOutlined />
                登录 / 注册
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}

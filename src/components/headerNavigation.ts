import { createElement, type ReactNode } from "react";
import {
  CreditCardOutlined,
  MailOutlined,
  MessageOutlined,
  SettingOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { homeAnchors, routePaths } from "../router/routeAccess";

type HeaderIcon = typeof UserOutlined;

export interface NavItem {
  label: string;
  to: string;
  requiresAuth?: boolean;
  adminOnly?: boolean;
}

export interface HeaderAction {
  key: string;
  label: string;
  to: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

function icon(Icon: HeaderIcon) {
  return createElement(Icon);
}

export const primaryNavItems: NavItem[] = [
  { label: "首页", to: routePaths.home },
  { label: "关于", to: routePaths.about, requiresAuth: true },
  { label: "下载中心", to: routePaths.downloads, requiresAuth: true },
  { label: "商品中心", to: routePaths.products, requiresAuth: true },
  { label: "实用工具", to: routePaths.tools, requiresAuth: true },
  { label: "随便聊聊", to: routePaths.randomTalk, requiresAuth: true },
  { label: "聊天室", to: routePaths.chat, requiresAuth: true },
  { label: "论坛交流", to: routePaths.forum, requiresAuth: true },
];

export const authenticatedNavItems: NavItem[] = [
  { label: "我的订单", to: routePaths.orders, requiresAuth: true },
  { label: "个人资料", to: routePaths.profile, requiresAuth: true },
];

export const adminNavItems: NavItem[] = [
  { label: "管理后台", to: routePaths.admin, requiresAuth: true, adminOnly: true },
];

export const cleanItems: NavItem[] = [
  { label: "首页", to: routePaths.home },
  { label: "学习记录", to: homeAnchors.notes },
  { label: "本周计划", to: homeAnchors.plan },
];

export const publicHomeItems: NavItem[] = [
  { label: "学习记录", to: homeAnchors.notes },
  { label: "本周计划", to: homeAnchors.plan },
];

const profileAction: HeaderAction = { key: "profile", label: "个人资料", to: routePaths.profile, icon: icon(UserOutlined) };
const ordersAction: HeaderAction = { key: "orders", label: "我的订单", to: routePaths.orders, icon: icon(CreditCardOutlined) };
const forumAction: HeaderAction = { key: "forum", label: "论坛交流", to: routePaths.forum, icon: icon(MessageOutlined) };
const mailcodeAction: HeaderAction = { key: "mailcode", label: "邮箱接码", to: routePaths.mailcode, icon: icon(MailOutlined) };
const toolsAction: HeaderAction = { key: "tools", label: "实用工具", to: routePaths.tools, icon: icon(ToolOutlined) };
const adminAction: HeaderAction = {
  key: "admin",
  label: "管理后台",
  to: routePaths.admin,
  icon: icon(SettingOutlined),
  adminOnly: true,
};

export const accountMenuActions: HeaderAction[] = [
  profileAction,
  ordersAction,
  forumAction,
  mailcodeAction,
  adminAction,
];

export const drawerShortcutActions: HeaderAction[] = [
  ordersAction,
  mailcodeAction,
  profileAction,
  toolsAction,
  adminAction,
];

export function isVisibleForUser(
  item: Pick<NavItem, "requiresAuth" | "adminOnly">,
  isAuthenticated: boolean,
  isAdmin: boolean,
) {
  return (!item.requiresAuth || isAuthenticated) && (!item.adminOnly || isAdmin);
}

export function isNavItemActive(item: Pick<NavItem, "to">, pathname: string, hash: string) {
  if (item.to.includes("#")) {
    return `${pathname}${hash}` === item.to;
  }

  const itemPath = item.to.split("#")[0] || "/";
  return pathname === itemPath && !(item.to === "/" && hash);
}

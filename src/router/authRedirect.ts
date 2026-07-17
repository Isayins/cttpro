import { routePaths } from "./routeAccess";

interface RedirectLocation {
  pathname: string;
  search?: string;
  hash?: string;
}

export const defaultAuthenticatedPath = routePaths.lc;

const redirectPageTitleMap: Record<string, string> = {
  [routePaths.lc]: "学习记录",
  [routePaths.about]: "关于",
  [routePaths.downloads]: "下载中心",
  [routePaths.products]: "商品中心",
  [routePaths.orders]: "我的订单",
  [routePaths.tools]: "实用工具",
  [routePaths.mailcode]: "邮箱接码",
  [routePaths.randomTalk]: "随便聊聊",
  [routePaths.chat]: "聊天室",
  [routePaths.forum]: "论坛交流",
  [routePaths.profile]: "个人资料",
  [routePaths.admin]: "管理后台",
  [routePaths.adminDemos]: "管理演示",
  [routePaths.adminEnterpriseDemo]: "企业后台演示",
  [routePaths.adminQrCodes]: "二维码管理",
};

export function buildRedirectFromLocation({ pathname, search = "", hash = "" }: RedirectLocation) {
  return `${pathname}${search}${hash}`;
}

export function resolveRedirectPath(from: unknown) {
  if (typeof from !== "string") {
    return defaultAuthenticatedPath;
  }

  const path = from.trim();
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith(routePaths.login)) {
    return defaultAuthenticatedPath;
  }

  return path;
}

export function resolveRedirectPageTitle(path: string) {
  const pathname = path.split(/[?#]/, 1)[0];
  return redirectPageTitleMap[pathname] ?? redirectPageTitleMap[defaultAuthenticatedPath];
}

export const routePaths = {
  home: "/",
  verify: "/verify",
  publicMailCode: "/code/fetch",
  qrAccess: "/q/:shortCode",
  login: "/login",
  forbidden: "/403",
  wheel: "/wheel",
  rps: "/rps",
  lc: "/lc",
  about: "/about",
  downloads: "/downloads",
  products: "/products",
  orders: "/orders",
  tools: "/tools",
  mailcode: "/mailcode",
  randomTalk: "/randomtalk",
  chat: "/chat",
  forum: "/forum",
  profile: "/profile",
  admin: "/admin",
  adminQrCodes: "/admin/qrcodes",
} as const;

export const homeAnchors = {
  notes: `${routePaths.home}#notes`,
  plan: `${routePaths.home}#plan`,
} as const;

export const lcAnchors = {
  siteNotices: `${routePaths.lc}#site-notices`,
} as const;

export const publicRoutePaths = [
  routePaths.home,
  routePaths.verify,
  routePaths.publicMailCode,
  routePaths.qrAccess,
  routePaths.login,
  routePaths.forbidden,
  routePaths.wheel,
  routePaths.rps,
] as const;

export const protectedRoutePaths = [
  routePaths.lc,
  routePaths.about,
  routePaths.downloads,
  routePaths.products,
  routePaths.orders,
  routePaths.tools,
  routePaths.mailcode,
  routePaths.randomTalk,
  routePaths.chat,
  routePaths.forum,
  routePaths.profile,
] as const;

export const adminRoutePaths = [
  routePaths.admin,
  routePaths.adminQrCodes,
] as const;

import { lazy, Suspense, type ReactNode } from "react";
import { Spin } from "antd";
import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import logo from "../store/images/idncar.png";
import { routePaths } from "./routeAccess";

const Home = lazy(() => import("../pages/Home"));
const LcHome = lazy(() => import("../pages/LcHome"));
const About = lazy(() => import("../pages/About"));
const Download = lazy(() => import("../pages/Download"));
const Products = lazy(() => import("../pages/Products"));
const Orders = lazy(() => import("../pages/Orders"));
const Tools = lazy(() => import("../pages/Tools"));
const RandomTalk = lazy(() => import("../pages/RandomTalk"));
const ChatRoom = lazy(() => import("../pages/ChatRoom"));
const VerifyDownload = lazy(() => import("../pages/VerifyDownload"));
const QrAccess = lazy(() => import("../pages/QrAccess"));
const Login = lazy(() => import("../pages/Login"));
const Forbidden = lazy(() => import("../pages/Forbidden"));
const Forum = lazy(() => import("../pages/Forum"));
const Profile = lazy(() => import("../pages/Profile"));
const Admin = lazy(() => import("../pages/Admin"));
const QrManage = lazy(() => import("../pages/QrManage"));
const MailCode = lazy(() => import("../pages/MailCode"));
const PublicMailCode = lazy(() => import("../pages/PublicMailCode"));
const NotFound = lazy(() => import("../pages/NotFound"));

function requireAuth(children: ReactNode, adminOnly = false) {
  return <ProtectedRoute adminOnly={adminOnly}>{children}</ProtectedRoute>;
}

interface AppRoute {
  path: string;
  element: ReactNode;
}

const publicRoutes: AppRoute[] = [
  { path: routePaths.home, element: <Home /> },
  { path: routePaths.verify, element: <VerifyDownload /> },
  { path: routePaths.publicMailCode, element: <PublicMailCode /> },
  { path: routePaths.qrAccess, element: <QrAccess /> },
  { path: routePaths.login, element: <Login /> },
  { path: routePaths.forbidden, element: <Forbidden /> },
];

const protectedRoutes: AppRoute[] = [
  { path: routePaths.lc, element: <LcHome /> },
  { path: routePaths.about, element: <About /> },
  { path: routePaths.downloads, element: <Download /> },
  { path: routePaths.products, element: <Products /> },
  { path: routePaths.orders, element: <Orders /> },
  { path: routePaths.tools, element: <Tools /> },
  { path: routePaths.mailcode, element: <MailCode /> },
  { path: routePaths.randomTalk, element: <RandomTalk /> },
  { path: routePaths.chat, element: <ChatRoom /> },
  { path: routePaths.forum, element: <Forum /> },
  { path: routePaths.profile, element: <Profile /> },
];

const adminRoutes: AppRoute[] = [
  { path: routePaths.admin, element: <Admin /> },
  { path: routePaths.adminQrCodes, element: <QrManage /> },
];

function renderRoute({ path, element }: AppRoute) {
  return <Route key={path} path={path} element={element} />;
}

function renderProtectedRoute({ path, element }: AppRoute, adminOnly = false) {
  return <Route key={path} path={path} element={requireAuth(element, adminOnly)} />;
}

function RouteLoadingFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(69,139,255,0.16),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,183,77,0.14),transparent_20%),linear-gradient(180deg,#eef5ff_0%,#f6f9fd_36%,#edf3fb_100%)] px-4 text-center text-slate-700"
      role="status"
      aria-live="polite"
      aria-label="页面加载中"
    >
      <div className="flex flex-col items-center gap-4">
        <img
          src={logo}
          alt="IDNCAR"
          className="h-14 w-14 rounded-lg border border-white/70 bg-white/80 p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
        />
        <Spin size="large" />
        <div>
          <div className="text-sm font-medium text-slate-900">页面加载中</div>
          <div className="mt-1 text-xs tracking-[0.16em] text-slate-500">IDNCAR</div>
        </div>
      </div>
    </div>
  );
}

export default function RouterConfig() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {publicRoutes.map(renderRoute)}
        {protectedRoutes.map((route) => renderProtectedRoute(route))}
        {adminRoutes.map((route) => renderProtectedRoute(route, true))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

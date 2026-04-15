import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Image, Drawer, Button } from "antd";
import { MenuOutlined, CloseOutlined } from "@ant-design/icons";
import logo from "../store/images/idncar.png";

/**
 * Responsive Header
 * - 在移动端显示汉堡 Drawer
 * - 在大屏显示横向导航
 * - 打开 Drawer 时锁定页面滚动
 * - 路由变化时自动关闭 Drawer
 */

const pageTitle = [
  { title: "I dn Car", href: "/" },
  { title: "关于", href: "/about" },
  { title: "下载中心", href: "/downloads" },
  { title: "实用工具", href: "/tools" },
  { title: "实时股票", href: "/stock" },
];

export default function Header() {
  const location = useLocation();
  const currentPage = pageTitle.find((item) => location.pathname === item.href);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== "undefined" ? window.innerWidth : 1024);

  // 监听窗口大小，用于 Drawer 宽度或其他响应式判断
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 打开 Drawer 时锁定 body 滚动
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    // 当组件卸载时恢复
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // 路由变化时自动关闭 drawer（避免跳转后 Drawer 仍然打开）
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // header 高度（与 MainLayout 的 top padding 保持一致）
  const HEADER_HEIGHT = 64; // px (h-16 ≈ 64px)

  // Drawer 宽度：窄屏用 80vw，宽屏用 320px
  const drawerWidth = windowWidth < 480 ? "80vw" : 320;

  return (
    <>
      <header
        className="w-full bg-white/95 backdrop-blur-sm shadow-sm fixed top-0 left-0 z-50"
        style={{ height: HEADER_HEIGHT }}
      >
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-full">
          {/* 左边 Logo + 标题 */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
              <Image src={logo} width={40} height={40} preview={false} className="rounded-lg" />
            </div>

            {/* 标题：使用 truncate 防止换行挤坏布局 */}
            <div className="min-w-0">
              <h1
                className="text-base sm:text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-400"
                style={{ WebkitBackgroundClip: "text" }}
                title={currentPage?.title || "页面"}
              >
                {currentPage?.title || "页面"}
              </h1>
            </div>
          </div>

          {/* 大屏导航 */}
          <nav className="hidden md:flex gap-6 items-center">
            {pageTitle.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`relative px-1 text-sm transition-colors ${
                    isActive ? "text-blue-600 font-semibold" : "text-gray-600 hover:text-blue-600"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.title}
                  {isActive && <span className="absolute left-0 -bottom-1 w-full h-0.5 bg-blue-600 rounded" />}
                </Link>
              );
            })}
          </nav>

          {/* 移动端汉堡按钮 */}
          <Button
            className="md:hidden"
            type="text"
            icon={drawerOpen ? <CloseOutlined /> : <MenuOutlined />}
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-label={drawerOpen ? "关闭菜单" : "打开菜单"}
          />
        </div>
      </header>

      {/* spacer：给页面主体留出 header 空间（也可在 MainLayout 中统一处理） */}
      <div style={{ height: HEADER_HEIGHT }} aria-hidden />

      {/* 移动端 Drawer */}
      <Drawer
        title={null}
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={drawerWidth}
        bodyStyle={{ padding: 0 }}
        headerStyle={{ display: "none" }}
        closeIcon={null}
      >
        <div className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg overflow-hidden">
                <Image src={logo} width={36} height={36} preview={false} className="rounded-lg" />
              </div>
              <div>
                <div className="text-base font-semibold">菜单</div>
                <div className="text-xs text-gray-500">导航</div>
              </div>
            </div>
            <Button type="text" icon={<CloseOutlined />} onClick={() => setDrawerOpen(false)} aria-label="关闭菜单" />
          </div>

          <nav className="flex flex-col gap-2">
            {pageTitle.map((item) => {
              const active = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base ${
                    active ? "bg-blue-600 text-white font-medium" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>
      </Drawer>
    </>
  );
}

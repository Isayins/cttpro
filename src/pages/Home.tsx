import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Carousel, Col, Empty, Row } from "antd";
import {
  ArrowRightOutlined,
  DownloadOutlined,
  MessageOutlined,
  NotificationOutlined,
  SettingOutlined,
  StockOutlined,
  ToolOutlined,
  UserOutlined,
} from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../context/useAuth";
import { downloadApi, forumApi, siteNoticeApi } from "../services/api";
import type { DownloadResource, Post, SiteNotice } from "../types/app";

const cards = [
  {
    title: "下载中心",
    description: "集中管理软件安装包、资源文件和验证下载入口，版本更新也会在这里同步。",
    icon: <DownloadOutlined className="text-[#2a6df4]" />,
    to: "/downloads",
  },
  {
    title: "论坛交流",
    description: "登录后可以发帖、回帖和互动，社区讨论和使用反馈都会汇总在这里。",
    icon: <MessageOutlined className="text-[#2a6df4]" />,
    to: "/forum",
  },
  {
    title: "实用工具",
    description: "常用辅助功能和快捷入口集中整理，方便日常使用时快速进入。",
    icon: <ToolOutlined className="text-[#2a6df4]" />,
    to: "/tools",
  },
  {
    title: "股票页面",
    description: "保留行情、看盘和相关功能入口，登录后可以直接进入使用。",
    icon: <StockOutlined className="text-[#2a6df4]" />,
    to: "/stock",
  },
];

const heroSlides = [
  {
    eyebrow: "COMMUNITY",
    title: "邀请码注册、资料完善和论坛互动都放在同一套入口里",
    description: "新用户通过邀请码和邮箱验证码完成注册，登录后就可以进入论坛、完善资料并参与互动。",
    primaryLabel: "进入论坛",
    primaryTo: "/forum",
    secondaryLabel: "个人资料",
    secondaryTo: "/profile",
    panelClass:
      "bg-[radial-gradient(circle_at_14%_18%,rgba(255,228,181,0.36),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(198,225,255,0.34),transparent_20%),linear-gradient(180deg,#fffdf7_0%,#f6f8fc_100%)]",
  },
  {
    eyebrow: "DOWNLOAD",
    title: "IDNCAR",
    description: "目前啥也没有",
    primaryLabel: "下载中心",
    primaryTo: "/downloads",
    secondaryLabel: "实用工具",
    secondaryTo: "/tools",
    panelClass:
      "bg-[radial-gradient(circle_at_78%_20%,rgba(255,215,166,0.34),transparent_20%),radial-gradient(circle_at_22%_72%,rgba(214,232,255,0.3),transparent_24%),linear-gradient(180deg,#fffef9_0%,#f4f7fb_100%)]",
  },
  {
    eyebrow: "FEATURES",
    title: "常用功能、社区入口和后台管理都整理成了更直接的首页动线",
    description: "首页只保留最常用的内容入口，登录后会自动展示你当前可访问的快捷页面。",
    primaryLabel: "立即登录",
    primaryTo: "/login",
    secondaryLabel: "查看公告",
    secondaryTo: "/#site-notices",
    panelClass:
      "bg-[radial-gradient(circle_at_18%_78%,rgba(220,238,255,0.34),transparent_24%),radial-gradient(circle_at_80%_22%,rgba(255,232,196,0.32),transparent_18%),linear-gradient(180deg,#fffdfa_0%,#f6f8fc_100%)]",
  },
];

const starterLinks = [
  {
    title: "先登录账号",
    text: "完成登录后可访问论坛、股票页面和个人资料页。",
    to: "/login",
    icon: <UserOutlined className="text-[#2a6df4]" />,
  },
  {
    title: "进入下载中心",
    text: "查看当前可用的软件、资源和相关文件下载入口。",
    to: "/downloads",
    icon: <DownloadOutlined className="text-[#2a6df4]" />,
  },
  {
    title: "打开工具页",
    text: "常用功能和辅助页面统一集中在工具页里。",
    to: "/tools",
    icon: <ToolOutlined className="text-[#2a6df4]" />,
  },
];

export default function Home() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [notices, setNotices] = useState<SiteNotice[]>([]);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [recentDownloads, setRecentDownloads] = useState<DownloadResource[]>([]);

  useEffect(() => {
    let alive = true;

    async function loadHomeData() {
      try {
        const [noticeList, postList, downloadList] = await Promise.all([
          siteNoticeApi.getSiteNotices(),
          forumApi.getPosts(),
          downloadApi.getDownloads(),
        ]);
        if (alive) {
          setNotices(noticeList);
          setRecentPosts(postList.slice(0, 4));
          setRecentDownloads(
            [...downloadList]
              .sort(
                (a, b) =>
                  new Date(b.updateTime ?? b.createTime ?? 0).getTime() - new Date(a.updateTime ?? a.createTime ?? 0).getTime(),
              )
              .slice(0, 4),
          );
        }
      } catch {
        if (alive) {
          setNotices([]);
          setRecentPosts([]);
          setRecentDownloads([]);
        }
      }
    }

    void loadHomeData();

    return () => {
      alive = false;
    };
  }, []);

  const primaryAction = isAuthenticated ? "/forum" : "/login";
  const primaryLabel = isAuthenticated ? "进入论坛" : "登录 / 注册";

  const quickLinks = [
    {
      label: primaryLabel,
      to: primaryAction,
      icon: isAuthenticated ? <MessageOutlined className="text-[#2a6df4]" /> : <UserOutlined className="text-[#2a6df4]" />,
    },
    {
      label: "下载中心",
      to: "/downloads",
      icon: <DownloadOutlined className="text-[#2a6df4]" />,
    },
    {
      label: "实用工具",
      to: "/tools",
      icon: <ToolOutlined className="text-[#2a6df4]" />,
    },
    ...(isAuthenticated
      ? [
          {
            label: "股票页面",
            to: "/stock",
            icon: <StockOutlined className="text-[#2a6df4]" />,
          },
          {
            label: "个人资料",
            to: "/profile",
            icon: <UserOutlined className="text-[#2a6df4]" />,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            label: "管理后台",
            to: "/admin",
            icon: <NotificationOutlined className="text-[#2a6df4]" />,
          },
        ]
      : []),
  ];

  const slides = heroSlides.filter((slide) => {
    if (slide.primaryTo === "/forum" || slide.secondaryTo === "/profile") {
      return isAuthenticated;
    }
    return true;
  });

  const visibleSlides =
    slides.length > 0
      ? slides
      : [
          {
            eyebrow: "WELCOME",
            title: "这里是站点首页",
            description: "从这里可以快速进入登录、下载中心和常用功能页面。",
            primaryLabel: "登录 / 注册",
            primaryTo: "/login",
            secondaryLabel: "下载中心",
            secondaryTo: "/downloads",
            panelClass:
              "bg-[radial-gradient(circle_at_14%_18%,rgba(255,228,181,0.36),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(198,225,255,0.34),transparent_20%),linear-gradient(180deg,#fffdf7_0%,#f6f8fc_100%)]",
          },
        ];

  return (
    <MainLayout>
      <div className="space-y-6 py-2">
        <section className="relative overflow-hidden rounded-[34px] border border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(248,249,252,0.78))] shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(255,220,170,0.16),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(170,205,255,0.14),transparent_20%),linear-gradient(180deg,rgba(255,255,255,0.22),transparent_28%)]" />

          <div className="relative px-6 py-8 md:px-10 md:py-10">
            <div className="flex items-center justify-between text-slate-500">
              <div className="rounded-full border border-white/80 bg-white/70 px-4 py-1.5 text-xs tracking-[0.16em] text-slate-600 shadow-sm">
                FEATURED
              </div>
              <div className="hidden text-sm md:block">社区、下载与常用功能入口</div>
            </div>

            <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px]">
              <div className="overflow-hidden rounded-[30px] border border-white/75 bg-white/60 shadow-[0_14px_40px_rgba(15,23,42,0.05)] backdrop-blur-md">
                <Carousel
                  autoplay
                  autoplaySpeed={5000}
                  effect="scrollx"
                  dots
                  className="[&_.slick-dots-bottom]:bottom-4 [&_.slick-dots_li_button]:bg-slate-300 [&_.slick-dots_.slick-active_button]:bg-[#2a6df4]"
                >
                  {visibleSlides.map((slide) => (
                    <div key={slide.title}>
                      <div className={`min-h-[390px] ${slide.panelClass} px-6 py-7 md:px-8 md:py-8`}>
                        <div className="flex h-full flex-col justify-between">
                          <div>
                            <div className="inline-flex rounded-full border border-[#e6edf8] bg-white/78 px-3 py-1 text-xs tracking-[0.18em] text-[#5e6c82]">
                              {slide.eyebrow}
                            </div>
                            <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight text-slate-900 md:text-5xl">
                              {slide.title}
                            </h1>
                            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">{slide.description}</p>
                          </div>

                          <div className="mt-8 flex flex-wrap gap-3">
                            <Link to={slide.primaryTo}>
                              <Button
                                type="primary"
                                size="large"
                                className="rounded-full border-none bg-[#2a6df4] shadow-[0_10px_24px_rgba(42,109,244,0.22)] hover:!bg-[#1f5fe0]"
                              >
                                {slide.primaryLabel}
                              </Button>
                            </Link>
                            <Link to={slide.secondaryTo}>
                              <Button
                                size="large"
                                className="rounded-full border-[#dde5f0] bg-white/78 text-slate-700 hover:!border-[#cfd9e8] hover:!bg-white hover:!text-slate-900"
                              >
                                {slide.secondaryLabel}
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </Carousel>
              </div>

              <div className="rounded-[30px] border border-white/75 bg-white/58 p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)] backdrop-blur-md">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <NotificationOutlined className="text-[#2a6df4]" />
                  快捷访问
                </div>
                <div className="mt-4 space-y-2">
                  {quickLinks.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="flex items-center justify-between rounded-2xl border border-white bg-[rgba(250,252,255,0.86)] px-4 py-3 text-sm text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.03)] transition hover:border-[#d6e0ee] hover:bg-white"
                    >
                      <span className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eef4ff] text-base">
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </span>
                      <ArrowRightOutlined className="text-xs text-slate-400" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_360px]">
          <div className="rounded-[30px] border border-white/65 bg-white/74 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl md:p-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">常用服务</h2>
              <p className="mt-1 text-sm text-slate-500">从这里可以快速进入站点里最常用的几个功能区。</p>
            </div>

            <Row gutter={[16, 16]} className="mt-5">
              {cards.map((item) => (
                <Col xs={24} sm={12} key={item.title}>
                  <Link
                    to={item.to}
                    className="block h-full rounded-[24px] border border-white bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,248,252,0.96))] p-5 shadow-[0_8px_26px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#d7e3f1] hover:shadow-[0_18px_38px_rgba(42,109,244,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff] text-lg">
                          {item.icon}
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                      </div>
                      <ArrowRightOutlined className="mt-1 text-slate-300" />
                    </div>
                  </Link>
                </Col>
              ))}
            </Row>
          </div>

          <div className="space-y-5">
            <div
              id="site-notices"
              className="rounded-[30px] border border-white/65 bg-white/74 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <NotificationOutlined className="text-[#2a6df4]" />
                站点公告
              </div>
              <div className="mt-4 space-y-4">
                {notices.length > 0 ? (
                  notices.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white bg-[rgba(250,252,255,0.84)] px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-medium text-slate-900">{item.title}</div>
                        {item.updateTime ? (
                          <span className="whitespace-nowrap text-xs text-slate-400">{item.updateTime}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-7 text-slate-600">{item.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-[rgba(250,252,255,0.82)] py-6">
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂时还没有已发布的公告" />
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/65 bg-white/74 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <SettingOutlined className="text-[#2a6df4]" />
                新手入口
              </div>
              <div className="mt-4 space-y-3">
                {starterLinks.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-start gap-3 rounded-2xl border border-white bg-[rgba(250,252,255,0.82)] px-4 py-4 transition hover:border-[#d6e0ee] hover:bg-white"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-[#eef4ff] text-lg">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900">{item.title}</div>
                      <p className="mt-1 text-sm leading-7 text-slate-600">{item.text}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[32px] border border-white/65 bg-white/74 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-xl md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">最近动态</h2>
              <p className="mt-1 text-sm text-slate-500">把公告、社区和下载更新收在一起，首页就能快速知道站点最近发生了什么。</p>
            </div>
            <Link to="/forum" className="text-sm text-[#2a6df4] hover:text-[#1f5fe0]">
              查看更多动态
            </Link>
          </div>

          <Row gutter={[16, 16]} className="mt-5">
            <Col xs={24} xl={8}>
              <div className="h-full rounded-[26px] border border-white bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,249,252,0.98))] p-5 shadow-[0_8px_26px_rgba(15,23,42,0.04)]">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <NotificationOutlined className="text-[#2a6df4]" />
                  最新公告
                </div>
                <div className="mt-4 space-y-3">
                  {notices.slice(0, 3).length > 0 ? (
                    notices.slice(0, 3).map((item) => (
                      <Link
                        key={item.id}
                        to="/#site-notices"
                        className="block rounded-2xl border border-slate-100 bg-white px-4 py-4 transition hover:border-[#d9e4f4] hover:bg-slate-50"
                      >
                        <div className="text-sm font-medium text-slate-900">{item.title}</div>
                        <div className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">{item.content}</div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 py-8">
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂时还没有公告动态" />
                    </div>
                  )}
                </div>
              </div>
            </Col>

            <Col xs={24} xl={8}>
              <div className="h-full rounded-[26px] border border-white bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,249,252,0.98))] p-5 shadow-[0_8px_26px_rgba(15,23,42,0.04)]">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <MessageOutlined className="text-[#2a6df4]" />
                  最近帖子
                </div>
                <div className="mt-4 space-y-3">
                  {recentPosts.length > 0 ? (
                    recentPosts.map((item) => (
                      <Link
                        key={item.id}
                        to={`/forum?post=${item.id}`}
                        className="block rounded-2xl border border-slate-100 bg-white px-4 py-4 transition hover:border-[#d9e4f4] hover:bg-slate-50"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          {item.pinned ? <span className="rounded-full bg-[#fff3d8] px-2 py-1 text-[11px] text-[#b7791f]">置顶</span> : null}
                          <span className="text-sm font-medium text-slate-900">{item.title}</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">{item.author} · {item.createTime}</div>
                        <div className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">{item.content}</div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 py-8">
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="最近还没有社区动态" />
                    </div>
                  )}
                </div>
              </div>
            </Col>

            <Col xs={24} xl={8}>
              <div className="h-full rounded-[26px] border border-white bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(247,249,252,0.98))] p-5 shadow-[0_8px_26px_rgba(15,23,42,0.04)]">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <DownloadOutlined className="text-[#2a6df4]" />
                  最近更新下载
                </div>
                <div className="mt-4 space-y-3">
                  {recentDownloads.length > 0 ? (
                    recentDownloads.map((item) => (
                      <Link
                        key={item.id}
                        to="/downloads"
                        className="block rounded-2xl border border-slate-100 bg-white px-4 py-4 transition hover:border-[#d9e4f4] hover:bg-slate-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-slate-900">{item.title}</div>
                          <span className="rounded-full bg-[#eef4ff] px-2 py-1 text-[11px] text-[#2a6df4]">
                            {item.version || "未标注版本"}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">{item.updateTime || item.createTime || "未知时间"}</div>
                        <div className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">
                          {item.changelog || "这个资源暂时还没有补充更新说明。"}
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 py-8">
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="最近没有下载更新" />
                    </div>
                  )}
                </div>
              </div>
            </Col>
          </Row>
        </section>
      </div>
    </MainLayout>
  );
}

import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { Button, Empty, Input, Select, Skeleton, Switch, Tag, message } from "antd";
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";
import { getErrorMessage } from "../lib/errorMessage";
import type { DownloadItem } from "../services/downloadService";
import { getDownloads, hydrateMissingFileSizes, trackDownload } from "../services/downloadService";

const CaptchaModal = lazy(() => import("../components/CaptchaModal"));
const DownloadCard = lazy(() => import("../components/DownloadCard"));
const DOWNLOAD_LOAD_TIMEOUT_MS = 8000;
const numberFormatter = new Intl.NumberFormat("zh-CN");
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const SORT_OPTIONS = [
  { label: "默认排序", value: "default" },
  { label: "最近更新", value: "updated" },
  { label: "下载次数", value: "downloads" },
];

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timerId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timerId = window.setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timerId) {
      window.clearTimeout(timerId);
    }
  });
}

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatDateLabel(value?: string | null) {
  if (!value) {
    return "暂无更新";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function getSortLabel(value: string) {
  return SORT_OPTIONS.find((item) => item.value === value)?.label ?? "默认排序";
}

export default function Downloads() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<DownloadItem | null>(null);
  const [category, setCategory] = useState<string>("ALL");
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<string>("default");
  const [lockedOnly, setLockedOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await withTimeout(getDownloads(), DOWNLOAD_LOAD_TIMEOUT_MS, "下载列表加载超时，请稍后重试");
      setItems(data);
      void hydrateMissingFileSizes(data).then((enriched) => {
        const sizeMap = new Map(enriched.map((item) => [item.id, item.fileSize]));
        setItems((current) =>
          current.map((item) => {
            const detectedSize = sizeMap.get(item.id);
            if (!item.fileSize && detectedSize) {
              return { ...item, fileSize: detectedSize };
            }
            return item;
          }),
        );
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error, "下载列表加载失败，请检查服务状态后重试");
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const categoryList = Array.from(
      new Set(items.map((item) => item.category).filter((value): value is string => Boolean(value))),
    );
    return ["ALL", ...categoryList];
  }, [items]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      if (item.category) {
        counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
      }
    });
    return counts;
  }, [items]);

  function getCategoryLabel(value: string) {
    return value === "ALL" ? "全部" : value;
  }

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    const nextItems = items.filter((item) => {
      const matchedCategory = category === "ALL" || item.category === category;
      const matchedLocked =
        !lockedOnly || Boolean(item.locked || item.passwordProtected);
      const matchedKeyword =
        !normalizedKeyword ||
        [item.title, item.version, item.category, item.changelog]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedKeyword));

      return matchedCategory && matchedLocked && matchedKeyword;
    });

    if (sortBy === "downloads") {
      return [...nextItems].sort((a, b) => (b.downloadCount ?? 0) - (a.downloadCount ?? 0));
    }

    if (sortBy === "updated") {
      return [...nextItems].sort(
        (a, b) => new Date(b.updateTime ?? 0).getTime() - new Date(a.updateTime ?? 0).getTime(),
      );
    }

    return [...nextItems].sort(
      (a, b) =>
        (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
        new Date(b.updateTime ?? 0).getTime() - new Date(a.updateTime ?? 0).getTime(),
    );
  }, [category, items, keyword, lockedOnly, sortBy]);

  const stats = useMemo(
    () => {
      const lockedResources = items.filter(
        (item) => item.locked || item.passwordProtected,
      ).length;
      const latestUpdate = items.reduce<string | null>((latest, item) => {
        if (!item.updateTime) {
          return latest;
        }
        if (!latest) {
          return item.updateTime;
        }
        return new Date(item.updateTime).getTime() > new Date(latest).getTime() ? item.updateTime : latest;
      }, null);

      return {
        totalResources: items.length,
        lockedResources,
        openResources: items.length - lockedResources,
        totalDownloads: items.reduce((sum, item) => sum + (item.downloadCount ?? 0), 0),
        categories: Math.max(0, categories.length - 1),
        latestUpdate,
      };
    },
    [categories.length, items],
  );

  const hasFilters = Boolean(keyword.trim()) || category !== "ALL" || lockedOnly || sortBy !== "default";
  const summaryCards = useMemo(
    () => [
      {
        label: "资源数量",
        value: loading ? "--" : formatCount(stats.totalResources),
        detail: loading ? "正在同步列表" : `当前显示 ${formatCount(filteredItems.length)} 个`,
      },
      {
        label: "开放下载",
        value: loading ? "--" : formatCount(stats.openResources),
        detail: "无需验证码",
      },
      {
        label: "验证下载",
        value: loading ? "--" : formatCount(stats.lockedResources),
        detail: "需要验证码",
      },
      {
        label: "下载次数",
        value: loading ? "--" : formatCount(stats.totalDownloads),
        detail: `最近更新 ${formatDateLabel(stats.latestUpdate)}`,
      },
    ],
    [filteredItems.length, loading, stats],
  );

  function clearFilters() {
    setKeyword("");
    setCategory("ALL");
    setLockedOnly(false);
    setSortBy("default");
  }

  const emptyTitle = items.length === 0 ? "当前还没有发布下载资源" : "没有找到匹配的资源";
  const emptyDescription =
    items.length === 0
      ? "等后台发布资源后，这里会自动展示安装包、文档、版本信息和下载入口。"
      : "可以换个关键词、分类或关闭验证下载筛选后再试。";
  const shouldShowFilters = !loading && !error && (items.length > 0 || hasFilters);

  async function handleTrackDownload(downloadId: number) {
    try {
      await trackDownload(downloadId);
      setItems((current) =>
        current.map((item) =>
          item.id === downloadId ? { ...item, downloadCount: (item.downloadCount ?? 0) + 1 } : item,
        ),
      );
    } catch {
      // Keep download flow non-blocking.
    }
  }

  return (
    <MainLayout contentWidth="wide">
      <div className="py-8">
        <section className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">资源库</div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">下载中心</h1>
              <p className="mt-2 text-sm text-slate-600">客户端安装包、文档和相关资源都集中在这里，方便统一查找和下载。</p>
            </div>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
              刷新
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {summaryCards.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white bg-slate-50/80 px-4 py-3">
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="mt-1 text-2xl font-semibold leading-none text-slate-950">{item.value}</div>
                <div className="mt-2 text-xs leading-5 text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {shouldShowFilters ? (
          <section className="mt-6 rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_220px_180px_auto]">
              <Input
                allowClear
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="搜索标题、版本、分类或更新说明"
                size="large"
                className="[&_.ant-input-affix-wrapper]:rounded-2xl"
              />
              <Select
                size="large"
                value={category}
                className="[&_.ant-select-selector]:!rounded-2xl"
                options={categories.map((item) => ({
                  label: item === "ALL" ? `全部 (${formatCount(items.length)})` : `${getCategoryLabel(item)} (${formatCount(categoryCounts.get(item) ?? 0)})`,
                  value: item,
                }))}
                onChange={setCategory}
              />
              <Select
                size="large"
                value={sortBy}
                className="[&_.ant-select-selector]:!rounded-2xl"
                options={SORT_OPTIONS}
                onChange={setSortBy}
              />
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600">
                <span>只看验证下载</span>
                <Switch size="small" checked={lockedOnly} onChange={setLockedOnly} />
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-500">
                {loading
                  ? "正在加载资源列表"
                  : hasFilters
                    ? `已筛选出 ${formatCount(filteredItems.length)} / ${formatCount(items.length)} 个资源`
                    : `当前共 ${formatCount(items.length)} 个资源，按后台推荐顺序展示`}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {keyword.trim() ? <Tag>关键词：{keyword.trim()}</Tag> : null}
                {category !== "ALL" ? <Tag color="blue">分类：{getCategoryLabel(category)}</Tag> : null}
                {lockedOnly ? <Tag color="orange">只看验证下载</Tag> : null}
                {sortBy !== "default" ? <Tag color="purple">排序：{getSortLabel(sortBy)}</Tag> : null}
                {hasFilters ? (
                  <Button size="small" onClick={clearFilters}>
                    清空筛选
                  </Button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {[1, 2, 3, 4].map((key) => (
                <div key={key} className="rounded-[24px] border border-slate-100 bg-white p-5">
                  <Skeleton active paragraph={{ rows: 5 }} />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[28px] border border-white/70 bg-white/85 p-12 text-center shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" icon={<ReloadOutlined />} onClick={() => void load()}>
                重试
              </Button>
            </Empty>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-white/70 bg-white/85 px-6 py-12 text-center shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <Empty
              description={
                <div>
                  <div className="text-base font-medium text-slate-800">{emptyTitle}</div>
                  <div className="mt-2 text-sm text-slate-500">{emptyDescription}</div>
                </div>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <div className="flex flex-wrap justify-center gap-3">
                {hasFilters ? <Button onClick={clearFilters}>清空筛选</Button> : null}
                <Button type="primary" icon={<ReloadOutlined />} onClick={() => void load()}>
                  刷新列表
                </Button>
              </div>
            </Empty>
          </div>
        ) : (
          <Suspense fallback={<div className="mt-6 rounded-[28px] border border-white/70 bg-white/85 p-6 text-slate-500">正在加载下载资源...</div>}>
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredItems.map((item, index) => (
                <div key={item.id} className="transition duration-300 hover:-translate-y-0.5">
                  <DownloadCard
                    {...item}
                    onLockedClick={() => {
                      setModalItem(item);
                      setModalOpen(true);
                    }}
                    onDirectDownload={() => void handleTrackDownload(item.id)}
                    onOpenLink={() => {
                      if (!item.locked && !item.passwordProtected) {
                        void handleTrackDownload(item.id);
                      }
                    }}
                    badgeText={!hasFilters && index === 0 ? "推荐" : undefined}
                  />
                </div>
              ))}
            </div>
          </Suspense>
        )}

        <section className="mt-8 rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="flex items-start gap-3 text-sm text-slate-600">
            <DownloadOutlined className="mt-0.5 text-blue-500" />
            <p>提示：生产环境安装前，建议先核对文件大小和校验值。</p>
          </div>
        </section>

        <Suspense fallback={null}>
          <CaptchaModal
            open={modalOpen}
            item={modalItem}
            onClose={() => {
              setModalOpen(false);
              setModalItem(null);
            }}
            onVerified={(downloadUrl) => {
              if (modalItem) {
                void handleTrackDownload(modalItem.id);
              }
              window.location.href = downloadUrl;
            }}
          />
        </Suspense>
      </div>
    </MainLayout>
  );
}

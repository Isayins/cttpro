import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Empty, Input, Select, Skeleton, Switch, message } from "antd";
import {
  ClockCircleOutlined,
  CodeOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";

import CaptchaModal from "../components/CaptchaModal";
import DownloadCard from "../components/DownloadCard";
import MainLayout from "../layouts/MainLayout";
import type { DownloadItem } from "../services/downloadService";
import { getDownloads, hydrateMissingFileSizes, trackDownload } from "../services/downloadService";

type RecentDownloadItem = {
  id: number;
  title: string;
  version?: string | null;
  category?: string | null;
  locked?: boolean;
  url: string;
  viewedAt: string;
  action: "direct" | "verify" | "link";
};

const RECENT_DOWNLOADS_KEY = "idncar.downloads.recent";
const RECENT_DOWNLOADS_LIMIT = 6;

function readRecentDownloads(): RecentDownloadItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_DOWNLOADS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecentDownloads(items: RecentDownloadItem[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(RECENT_DOWNLOADS_KEY, JSON.stringify(items));
}

function formatRecentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Downloads() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<DownloadItem | null>(null);
  const [category, setCategory] = useState<string>("全部");
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<string>("default");
  const [lockedOnly, setLockedOnly] = useState(false);
  const [recentDownloads, setRecentDownloads] = useState<RecentDownloadItem[]>(() => readRecentDownloads());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDownloads();
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
    } catch (err) {
      console.error(err);
      setError("下载列表加载失败");
      message.error("下载列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = useMemo(() => {
    const categoryList = Array.from(new Set(items.map((item) => item.category).filter(Boolean)));
    return ["全部", ...categoryList];
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    const nextItems = items.filter((item) => {
      const matchedCategory = category === "全部" || item.category === category;
      const matchedLocked = !lockedOnly || Boolean(item.locked);
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
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || new Date(b.updateTime ?? 0).getTime() - new Date(a.updateTime ?? 0).getTime(),
    );
  }, [category, items, keyword, lockedOnly, sortBy]);

  const stats = useMemo(
    () => ({
      totalResources: items.length,
      lockedResources: items.filter((item) => item.locked).length,
      totalDownloads: items.reduce((sum, item) => sum + (item.downloadCount ?? 0), 0),
      categories: Math.max(0, categories.length - 1),
    }),
    [categories.length, items],
  );

  async function handleTrackDownload(downloadId: number) {
    try {
      await trackDownload(downloadId);
      setItems((current) =>
        current.map((item) =>
          item.id === downloadId ? { ...item, downloadCount: (item.downloadCount ?? 0) + 1 } : item,
        ),
      );
    } catch {
      // Ignore tracking failures so download itself is not blocked.
    }
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <section className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(255,232,196,0.38),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(214,230,255,0.32),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,249,253,0.98))] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)] md:p-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/80 bg-white/70 px-4 py-2 shadow-sm">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#2a6df4]">
                  <CodeOutlined style={{ fontSize: 22 }} />
                </span>
                <span className="text-xs uppercase tracking-[0.24em] text-slate-500">Resource Library</span>
              </div>
              <h1 className="mt-6 max-w-3xl text-3xl font-semibold leading-tight text-slate-900 md:text-4xl">
                下载中心
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
                这里集中整理客户端、资料包和验证下载入口。资源信息会同步展示版本、文件大小、校验值和下载统计，方便你直接判断该下哪一个。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-full border border-white/80 bg-white/78 px-4 py-2 text-sm text-slate-600 shadow-sm">
                  当前可见 <span className="font-semibold text-slate-900">{filteredItems.length}</span> 个资源
                </div>
                <div className="rounded-full border border-white/80 bg-white/78 px-4 py-2 text-sm text-slate-600 shadow-sm">
                  验证下载 <span className="font-semibold text-slate-900">{stats.lockedResources}</span> 项
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[26px] border border-white/85 bg-white/78 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                <div className="text-sm text-slate-500">资源总数</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{stats.totalResources}</div>
              </div>
              <div className="rounded-[26px] border border-white/85 bg-white/78 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                <div className="text-sm text-slate-500">分类数量</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{stats.categories}</div>
              </div>
              <div className="rounded-[26px] border border-white/85 bg-white/78 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                <div className="text-sm text-slate-500">累计下载</div>
                <div className="mt-2 text-3xl font-semibold text-slate-900">{stats.totalDownloads}</div>
              </div>
              <div className="rounded-[26px] border border-white/85 bg-white/78 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                <div className="text-sm text-slate-500">当前排序</div>
                <div className="mt-2 text-base font-semibold text-slate-900">
                  {sortBy === "updated" ? "按更新时间" : sortBy === "downloads" ? "按下载次数" : "默认排序"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[30px] border border-white/75 bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)] backdrop-blur-xl md:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">快速筛选</div>
                <p className="mt-1 text-sm text-slate-500">按名称、分类和下载方式快速定位需要的资源。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button className="rounded-full border-slate-200" icon={<ClockCircleOutlined />} onClick={() => void load()}>
                  刷新列表
                </Button>
                <Button
                  type="text"
                  className="rounded-full"
                  icon={<InfoCircleOutlined />}
                  onClick={() => message.info("下载前请确认版本、文件大小和 SHA256 信息是否符合你的需要。")}
                >
                  下载说明
                </Button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_220px_180px_auto]">
              <Input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="搜索名称、版本、分类或更新说明"
                size="large"
                className="[&_.ant-input-affix-wrapper]:rounded-2xl"
              />
              <Select
                size="large"
                value={category}
                className="[&_.ant-select-selector]:!rounded-2xl"
                options={categories.map((item) => ({ label: item, value: item }))}
                onChange={setCategory}
              />
              <Select
                size="large"
                value={sortBy}
                className="[&_.ant-select-selector]:!rounded-2xl"
                options={[
                  { label: "默认排序", value: "default" },
                  { label: "按更新时间", value: "updated" },
                  { label: "按下载次数", value: "downloads" },
                ]}
                onChange={setSortBy}
              />
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] px-4 py-3 text-sm text-slate-600">
                <span>只看验证下载</span>
                <Switch size="small" checked={lockedOnly} onChange={setLockedOnly} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-[#f3f6fb] px-3 py-1 text-xs text-slate-600">分类：{category}</span>
              <span className="rounded-full bg-[#f3f6fb] px-3 py-1 text-xs text-slate-600">
                {lockedOnly ? "仅验证下载" : "包含全部下载"}
              </span>
              {keyword ? <span className="rounded-full bg-[#f3f6fb] px-3 py-1 text-xs text-slate-600">关键词：{keyword}</span> : null}
            </div>
          </div>
        </section>

        {loading ? (
          <div className="mt-6 rounded-[30px] border border-white/75 bg-white/80 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[1, 2, 3, 4].map((key) => (
                <div key={key} className="rounded-[24px] border border-slate-100 bg-[linear-gradient(180deg,#ffffff,#f8fafc)] p-5">
                  <Skeleton active paragraph={{ rows: 5 }} />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[30px] border border-white/75 bg-white/80 p-12 text-center shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" className="rounded-full border-none bg-[#2a6df4]" onClick={() => void load()} icon={<ReloadOutlined />}>
                重试
              </Button>
            </Empty>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mt-6 rounded-[30px] border border-white/75 bg-white/80 p-12 text-center shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <Empty description="当前分类下暂无下载内容" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" className="rounded-full border-none bg-[#2a6df4]" onClick={() => void load()} icon={<ReloadOutlined />}>
                刷新
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredItems.map((item, index) => (
              <div key={item.id} className="transition duration-300 hover:-translate-y-0.5">
                <DownloadCard
                  {...item}
                  onLockedClick={() => {
                    setModalItem(item);
                    setModalOpen(true);
                  }}
                  onDirectDownload={() => void handleTrackDownload(item.id)}
                  badgeText={index === 0 ? "推荐下载" : undefined}
                />
              </div>
            ))}
          </div>
        )}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,249,252,0.98))] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff]">
              <DownloadOutlined style={{ fontSize: 18, color: "#2a6df4" }} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">信息更完整</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              每个资源都会展示分类、文件大小、更新时间、SHA256 和下载次数，下载前就能快速判断是否合适。
            </p>
          </div>

          <div className="rounded-[28px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,249,252,0.98))] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3e8]">
              <InfoCircleOutlined style={{ fontSize: 18, color: "#d97706" }} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">验证下载</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              带有“验证后下载”的资源需要先完成验证码验证，适合用于更重要或需要受控分发的文件。
            </p>
          </div>

          <div className="rounded-[28px] border border-white/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,249,252,0.98))] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef7f1]">
              <ReloadOutlined style={{ fontSize: 18, color: "#0f766e" }} />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">下载建议</h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              正式环境建议优先查看更新说明并校验 SHA256，确认资源完整后再安装或分发到其他设备。
            </p>
          </div>
        </section>

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
      </div>
    </MainLayout>
  );
}

import { type ChangeEvent, type ClipboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Avatar,
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Popover,
  Progress,
  Select,
  Spin,
  Tag,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FireOutlined,
  HomeOutlined,
  LeftOutlined,
  LinkOutlined,
  LikeFilled,
  LikeOutlined,
  MessageOutlined,
  PictureOutlined,
  PlusOutlined,
  PushpinOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  SmileOutlined,
  StarFilled,
  StarOutlined,
  StopOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  UploadOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import { useAuth } from "../context/useAuth";
import MainLayout from "../layouts/MainLayout";
import { getFriendlyMessage } from "../lib/errorMessage";
import { resolveAssetUrl } from "../lib/media";
import {
  buildImageMarkup,
  FORUM_EMOJIS,
  getClipboardImageFile,
  getImageMarkupUrl,
  getImageFileValidationError,
  getTextPreviewWithoutImageBlocks,
  IMAGE_ACCEPT,
  isSafeImageUrl,
  renderEmojiPanel,
  renderImageMarkupLines,
} from "../lib/richContent";
import { forumApi } from "../services/api/forum";
import type {
  CreatePostPayload,
  CreatePostReportPayload,
  ForumBoard,
  ForumBoardLevelTitle,
  ForumBoardOwnerApplication,
  ForumLeaderboard,
  ForumLeaderboardUser,
  Post,
  Reply,
  SaveForumBoardPayload,
} from "../types/app";

interface PostFormValues extends CreatePostPayload {
  tagsText?: string;
}

type ForumBoardFormValues = SaveForumBoardPayload;
interface ForumBoardOwnerApplicationFormValues {
  reason: string;
}
type ReportFormValues = CreatePostReportPayload;
type QuickView = "latest" | "popular" | "pinned" | "mine" | "favorites";
type ReplyFilter = "all" | "author";
type ReplySort = "latest" | "earliest";
type PostAction = "delete" | "favorite" | "like" | "pin";

const ALL_BOARD_OPTION = "全部";
const DEFAULT_FORUM_BOARD_NAMES = ["综合讨论", "求助答疑", "下载反馈", "建议反馈", "问题反馈"];
const DEFAULT_FORUM_BOARDS: ForumBoard[] = DEFAULT_FORUM_BOARD_NAMES.map((name, index) => ({
  name,
  description: index === 0 ? "日常交流和主题讨论" : undefined,
  sortOrder: index + 1,
  active: true,
}));
const DEFAULT_BOARD_LEVEL_TITLES: ForumBoardLevelTitle[] = [
  { level: 1, title: "新成员" },
  { level: 2, title: "常驻吧友" },
  { level: 4, title: "活跃成员" },
  { level: 7, title: "资深吧友" },
  { level: 10, title: "核心成员" },
  { level: 15, title: "传奇吧友" },
];
const quickFilterItems: Array<{ key: QuickView; label: string; mobileLabel?: string }> = [
  { key: "latest", label: "最新" },
  { key: "popular", label: "热门" },
  { key: "pinned", label: "置顶" },
  { key: "favorites", label: "收藏" },
  { key: "mine", label: "我的帖子", mobileLabel: "我的" },
];
const quickViewLabelMap = new Map<QuickView, string>(quickFilterItems.map((item) => [item.key, item.label]));
const POST_IMAGE_UPLOAD_MESSAGE_KEY = "forum-post-image-upload";
const REPLY_IMAGE_UPLOAD_MESSAGE_KEY = "forum-reply-image-upload";
const reportReasonOptions = [
  "垃圾广告",
  "违规内容",
  "恶意攻击",
  "重复灌水",
  "虚假误导",
  "其他问题",
].map((item) => ({ label: item, value: item }));
const postSkeletonRows = Array.from({ length: 3 }, (_, index) => index);

function getPostActionKey(postId: number, action: PostAction) {
  return `${action}:${postId}`;
}

const categoryLabelMap: Record<string, string> = {
  All: "全部",
  全部: "全部",
  General: "综合讨论",
  综合交流: "综合讨论",
  综合讨论: "综合讨论",
  Help: "求助答疑",
  求助答疑: "求助答疑",
  Downloads: "下载反馈",
  下载反馈: "下载反馈",
  Suggestions: "建议反馈",
  建议反馈: "建议反馈",
  "Bug Report": "问题反馈",
  问题反馈: "问题反馈",
};

const EXP_PER_POST = 15;
const EXP_PER_REPLY = 6;
const EXP_PER_GIVE_LIKE = 2;
const EXP_PER_LEVEL = 100;
const POST_TITLE_MAX_LENGTH = 80;
const POST_CONTENT_MAX_LENGTH = 6000;
const POST_TAG_MAX_COUNT = 5;
const FORUM_SUBHEADER_TOP_CLASS = "top-16";
const FORUM_BODY_MIN_HEIGHT_CLASS = "min-h-[calc(100vh-4rem-57px)]";
const FORUM_SIDE_PANEL_STICKY_CLASS = "sticky top-[calc(4rem+57px)] max-h-[calc(100vh-4rem-57px)] overflow-y-auto";

interface PostImageMeta {
  imageCount: number;
  previewUrls: string[];
}

interface ForumPostListItem {
  post: Post;
  barName: string;
  createdAtLabel: string;
  forumAvatarUrl?: string;
  forumAvatarLabel: string;
  forumAvatarToneKey: string;
  imageMeta: PostImageMeta;
  previewText: string;
  previewTags: string[];
}

interface ForumRecommendationItem {
  post: Post;
  imageUrl?: string;
  previewText: string;
  reason: string;
}

interface ForumReplyListItem {
  reply: Reply;
  authorAvatarUrl?: string;
  createdAtLabel: string;
  floor: number | string;
  isAuthor: boolean;
}

interface ActivePostMeta {
  authorAvatarUrl?: string;
  categoryLabel: string;
  fullTimeLabel: string;
}

interface ForumSummaryCardItem {
  label: string;
  value: string;
  detail: string;
}

interface ForumFilterLabel {
  key: string;
  label: string;
  color?: string;
}

function formatCategoryLabel(value?: string | null) {
  if (!value) {
    return "综合讨论";
  }

  return categoryLabelMap[value] ?? value;
}

function normalizeCategoryValue(value?: string | null) {
  if (!value) {
    return DEFAULT_FORUM_BOARD_NAMES[0];
  }

  return categoryLabelMap[value] ?? value;
}

function parseBoardLevelTitles(config?: string | null): ForumBoardLevelTitle[] {
  if (!config?.trim()) {
    return DEFAULT_BOARD_LEVEL_TITLES;
  }
  try {
    const parsed = JSON.parse(config) as Array<Partial<ForumBoardLevelTitle>>;
    const rows = parsed
      .map((item) => ({
        level: Number(item.level),
        title: typeof item.title === "string" ? item.title.trim() : "",
      }))
      .filter((item) => Number.isFinite(item.level) && item.level >= 1 && item.title);
    return rows.length > 0 ? rows.sort((a, b) => a.level - b.level) : DEFAULT_BOARD_LEVEL_TITLES;
  } catch {
    return DEFAULT_BOARD_LEVEL_TITLES;
  }
}

function getTagCandidates(tagsText?: string) {
  if (!tagsText) {
    return [];
  }
  return tagsText
    .split(/[,\uFF0C]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTags(tagsText?: string) {
  return getTagCandidates(tagsText).slice(0, POST_TAG_MAX_COUNT);
}

function calculateLevel(experience: number) {
  return Math.max(1, Math.floor(Math.max(0, experience) / EXP_PER_LEVEL) + 1);
}

function getLevelProgress(experience: number) {
  const safeExperience = Math.max(0, experience);
  const currentLevel = calculateLevel(safeExperience);
  const currentBase = (currentLevel - 1) * EXP_PER_LEVEL;
  const percent = ((safeExperience - currentBase) / EXP_PER_LEVEL) * 100;
  return Math.min(100, Math.max(0, percent));
}

function getRankBadgeClass(index: number) {
  if (index === 0) {
    return "bg-[#fff4d6] text-[#9a6a08]";
  }
  if (index === 1) {
    return "bg-[#eef2f7] text-[#475569]";
  }
  if (index === 2) {
    return "bg-[#ffe6d8] text-[#c2410c]";
  }
  return "bg-white text-slate-700";
}

function formatTime(value?: string | null) {
  if (!value) {
    return "";
  }

  const timestamp = getTimeValue(value);
  if (!timestamp) {
    return "";
  }

  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFullTime(value?: string | null) {
  if (!value) {
    return "";
  }

  const timestamp = getTimeValue(value);
  if (!timestamp) {
    return "";
  }

  return new Date(timestamp).toLocaleString("zh-CN");
}

function getTimeValue(value?: string | null) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function replacePostById(items: Post[], updated: Post) {
  return items.map((item) => (item.id === updated.id ? updated : item));
}

function sortPostsByPinnedAndTime(items: Post[]) {
  return [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned) || getTimeValue(b.createTime) - getTimeValue(a.createTime));
}

function formatCompactNumber(value?: number | null) {
  const safeValue = Math.max(0, value ?? 0);
  if (safeValue >= 10000) {
    return `${(safeValue / 10000).toFixed(1)}万`;
  }
  return String(safeValue);
}

function getDisplayInitial(value?: string | null) {
  const text = value?.trim();
  if (!text) {
    return "吧";
  }
  return text.slice(0, 2).toUpperCase();
}

function getStableIndex(value: string | number | null | undefined, size: number) {
  const source = String(value ?? "");
  let hash = 0;
  for (const char of source) {
    hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  }
  return Math.abs(hash) % size;
}

function getAvatarToneClass(value: string | number | null | undefined) {
  const tones = [
    "bg-[#111827] text-white",
    "bg-[#ef1745] text-white",
    "bg-gradient-to-br from-[#60a5fa] to-[#f472b6] text-white",
    "bg-gradient-to-br from-[#f59e0b] to-[#7c2d12] text-white",
    "bg-gradient-to-br from-[#2563eb] to-[#16a34a] text-white",
  ];
  return tones[getStableIndex(value, tones.length)];
}

function getPostHeat(post: Post) {
  return (post.likeCount ?? 0) * 3 + (post.replyCount ?? 0) * 5 + Math.floor((post.viewCount ?? 0) / 8);
}

function getPostImageUrls(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => getImageMarkupUrl(line, { trim: true }))
    .filter((url): url is string => Boolean(url))
    .filter((url) => isSafeImageUrl(url));
}

function getPostPreviewImageUrls(content: string, limit = 3) {
  return getPostImageMeta(content, limit).previewUrls;
}

function getPostImageMeta(content: string, previewLimit = 3): PostImageMeta {
  const urls = getPostImageUrls(content);
  const uniqueUrls = Array.from(new Set(urls));
  return {
    imageCount: urls.length,
    previewUrls: uniqueUrls.map((url) => resolveAssetUrl(url)).filter((url): url is string => Boolean(url)).slice(0, previewLimit),
  };
}

function RankingCard({
  icon,
  title,
  description,
  loading = false,
  items,
  renderMeta,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  loading?: boolean;
  items: ForumLeaderboardUser[];
  renderMeta: (item: ForumLeaderboardUser) => string;
}) {
  return (
    <Card className="rounded-md border-[#dfe7f3] shadow-sm">
      <div>
        <div className="flex items-center gap-2 text-base font-semibold text-[#1f2d3d]">
          {icon}
          {title}
        </div>
        <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
      </div>
      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spin size="small" />
          </div>
        ) : items.length === 0 ? (
          <Empty description="暂时还没有排行数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          items.map((item, index) => (
            <div key={`${title}-${item.userId}`} className="flex items-center gap-3 rounded-md bg-[#f7f9fd] px-3 py-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${getRankBadgeClass(index)}`}>
                {index + 1}
              </div>
              <Avatar src={resolveAssetUrl(item.avatarUrl)} icon={<UserOutlined />}>
                {item.nickname?.[0]}
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-900">{item.nickname}</div>
                <div className="text-xs text-slate-500">{renderMeta(item)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function ForumSummaryPanel({
  cards,
  activeFilterLabels,
  hasActivePostFilters,
  onResetFilters,
}: {
  cards: ForumSummaryCardItem[];
  activeFilterLabels: ForumFilterLabel[];
  hasActivePostFilters: boolean;
  onResetFilters: () => void;
}) {
  return (
    <div className="mb-4 border-y border-[#edf0f5] py-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {cards.map((item) => (
          <div key={item.label} className="min-w-0 border-l border-[#edf0f5] pl-3 first:border-l-0 first:pl-0 sm:first:pl-0">
            <div className="truncate text-[11px] font-bold text-[#8b95a5]">{item.label}</div>
            <div className="mt-1 truncate text-xl font-black leading-none text-[#111827]">{item.value}</div>
            <div className="mt-1 truncate text-xs text-[#6b7280]">{item.detail}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2 border-t border-[#edf0f5] pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-xs font-semibold text-[#6b7280]">
          {activeFilterLabels.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="shrink-0 text-[#8b95a5]">当前筛选</span>
              {activeFilterLabels.map((item) => (
                <Tag key={item.key} color={item.color} className="!mr-0 max-w-full whitespace-normal break-all px-2 py-0.5 text-xs">
                  {item.label}
                </Tag>
              ))}
            </div>
          ) : (
            <span>正在查看全部主题</span>
          )}
        </div>
        {hasActivePostFilters ? (
          <Button size="small" icon={<SearchOutlined />} onClick={onResetFilters} className="w-full sm:w-auto">
            清空筛选
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ForumPostLoadingState({
  showSlowWarning,
  onReload,
}: {
  showSlowWarning: boolean;
  onReload: () => void;
}) {
  return (
    <div>
      {showSlowWarning ? (
        <div className="mb-4 rounded-lg border border-[#edf0f5] bg-[#fbfcff] px-4 py-3 text-center">
          <div className="text-sm font-bold text-[#111827]">加载时间有点久</div>
          <div className="mt-1 text-xs text-[#8b95a5]">可以继续等待，或重新请求帖子列表。</div>
          <Button size="small" icon={<ReloadOutlined />} className="mt-2" onClick={onReload}>
            重新加载
          </Button>
        </div>
      ) : null}
      {postSkeletonRows.map((item) => (
        <article key={item} className="border-b border-[#f0f2f5] pb-5 pt-1">
          <div className="flex gap-3">
            <div className="h-11 w-11 animate-pulse rounded-[10px] bg-[#e5e7eb]" />
            <div className="min-w-0 flex-1">
              <div className="h-4 w-32 animate-pulse rounded bg-[#e5e7eb]" />
              <div className="mt-2 h-3 w-48 animate-pulse rounded bg-[#f0f2f5]" />
              <div className="mt-5 h-5 w-3/5 animate-pulse rounded bg-[#e5e7eb]" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-[#f0f2f5]" />
              <div className="mt-2 h-4 w-2/3 animate-pulse rounded bg-[#f0f2f5]" />
              <div className="mt-4 h-40 w-full max-w-[520px] animate-pulse rounded-lg bg-[#eef0f4]" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function ForumEmptyPostsState({
  title,
  description,
  hasActivePostFilters,
  onResetFilters,
  onCreatePost,
}: {
  title: string;
  description: string;
  hasActivePostFilters: boolean;
  onResetFilters: () => void;
  onCreatePost: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eef5ff] text-xl text-[#2b72c9]">
        <MessageOutlined />
      </div>
      <div className="mt-4 text-lg font-bold text-[#111827]">{title}</div>
      <div className="mt-2 max-w-md text-sm leading-6 text-[#5f6b7a]">{description}</div>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {hasActivePostFilters ? (
          <Button icon={<SearchOutlined />} onClick={onResetFilters}>
            清空筛选
          </Button>
        ) : null}
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreatePost}>
          发布新帖
        </Button>
      </div>
    </div>
  );
}

function ForumPostImagePreview({
  imageMeta,
  title,
  onOpen,
}: {
  imageMeta: PostImageMeta;
  title: string;
  onOpen: () => void;
}) {
  const previewImages = imageMeta.previewUrls;

  if (previewImages.length === 0) {
    return null;
  }

  if (previewImages.length === 1) {
    return (
      <button
        type="button"
        aria-label={`查看帖子图片：${title}`}
        onClick={onOpen}
        className="mt-3 block w-full max-w-[480px] overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f3f4f6]"
      >
        <img
          src={previewImages[0]}
          alt="帖子图片"
          className="max-h-[240px] w-full object-contain sm:max-h-[360px]"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      </button>
    );
  }

  return (
    <div className="mt-3 grid max-w-[480px] grid-cols-3 gap-2">
      {previewImages.map((imageUrl, index) => (
        <button
          key={`${title}-${imageUrl}`}
          type="button"
          aria-label={`查看帖子图片：${title}`}
          onClick={onOpen}
          className="relative aspect-square overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f3f4f6]"
        >
          <img
            src={imageUrl}
            alt="帖子图片"
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
          {index === previewImages.length - 1 && imageMeta.imageCount > previewImages.length ? (
            <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
              共 {imageMeta.imageCount} 张
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function ForumPostActionBar({
  post,
  likeLoading,
  favoriteLoading,
  onOpen,
  onLike,
  onFavorite,
  onReport,
}: {
  post: Post;
  likeLoading: boolean;
  favoriteLoading: boolean;
  onOpen: () => void;
  onLike: () => void;
  onFavorite: () => void;
  onReport: () => void;
}) {
  return (
    <div className="mt-3 grid max-w-[540px] grid-cols-4 items-center text-sm text-[#5f6b7a] sm:grid-cols-5">
      <button type="button" aria-label={`查看帖子：${post.title}`} onClick={onOpen} className="inline-flex items-center gap-1 hover:text-[#346cff]">
        <EyeOutlined />
        {formatCompactNumber(post.viewCount)}
      </button>
      <button type="button" aria-label={`查看回复：${post.title}`} onClick={onOpen} className="inline-flex items-center gap-1 hover:text-[#346cff]">
        <MessageOutlined />
        {formatCompactNumber(post.replyCount)}
      </button>
      <button
        type="button"
        aria-label={`${post.likedByCurrentUser ? "取消点赞" : "点赞"}：${post.title}`}
        disabled={likeLoading}
        onClick={onLike}
        className={`inline-flex items-center gap-1 hover:text-[#346cff] disabled:cursor-not-allowed disabled:opacity-60 ${
          post.likedByCurrentUser ? "text-[#346cff]" : ""
        }`}
      >
        {post.likedByCurrentUser ? <LikeFilled /> : <LikeOutlined />}
        {formatCompactNumber(post.likeCount)}
      </button>
      <button
        type="button"
        aria-label={`${post.favoritedByCurrentUser ? "取消收藏" : "收藏"}：${post.title}`}
        disabled={favoriteLoading}
        onClick={onFavorite}
        className={`inline-flex items-center gap-1 hover:text-[#d48806] disabled:cursor-not-allowed disabled:opacity-60 ${
          post.favoritedByCurrentUser ? "text-[#d48806]" : ""
        }`}
      >
        {post.favoritedByCurrentUser ? <StarFilled /> : <StarOutlined />}
        {formatCompactNumber(post.favoriteCount)}
      </button>
      {!(post.canDelete ?? post.canEdit) ? (
        <button type="button" onClick={onReport} className="hidden items-center justify-end gap-1 hover:text-[#c2410c] sm:inline-flex">
          <WarningOutlined />
          <span className="hidden sm:inline">举报</span>
        </button>
      ) : null}
    </div>
  );
}

export default function Forum() {
  const { user, isAuthenticated, isAdmin, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoadingSlow, setPostsLoadingSlow] = useState(false);
  const [postsLoadError, setPostsLoadError] = useState<string | null>(null);
  const [postPage, setPostPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyPage, setReplyPage] = useState(1);
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [loadingMoreReplies, setLoadingMoreReplies] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [savingReply, setSavingReply] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loginPromptAction, setLoginPromptAction] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [reportTarget, setReportTarget] = useState<Post | null>(null);
  const [queryPostHandled, setQueryPostHandled] = useState<number | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [quickView, setQuickView] = useState<QuickView>("latest");
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>("all");
  const [replySort, setReplySort] = useState<ReplySort>("latest");
  const [profileExperience, setProfileExperience] = useState<number>(user?.experience ?? 0);
  const [profileLevel, setProfileLevel] = useState<number>(user?.level ?? 1);
  const [profileTitle, setProfileTitle] = useState<string>(user?.title ?? "新成员");
  const [signInDays, setSignInDays] = useState<number>(user?.consecutiveSignInDays ?? 0);
  const [signedToday, setSignedToday] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [uploadingPostImage, setUploadingPostImage] = useState(false);
  const [uploadingReplyImage, setUploadingReplyImage] = useState(false);
  const [uploadingBoardAvatar, setUploadingBoardAvatar] = useState(false);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ForumLeaderboard>({ signInRank: [], activityRank: [] });
  const [forumBoards, setForumBoards] = useState<ForumBoard[]>(DEFAULT_FORUM_BOARDS);
  const [boardManagerOpen, setBoardManagerOpen] = useState(false);
  const [savingBoard, setSavingBoard] = useState(false);
  const [editingBoard, setEditingBoard] = useState<ForumBoard | null>(null);
  const [boardOwnerApplications, setBoardOwnerApplications] = useState<ForumBoardOwnerApplication[]>([]);
  const [myOwnerApplications, setMyOwnerApplications] = useState<ForumBoardOwnerApplication[]>([]);
  const [ownerApplicationOpen, setOwnerApplicationOpen] = useState(false);
  const [ownerApplicationTarget, setOwnerApplicationTarget] = useState<ForumBoard | null>(null);
  const [submittingOwnerApplication, setSubmittingOwnerApplication] = useState(false);
  const [reviewingOwnerApplicationId, setReviewingOwnerApplicationId] = useState<number | null>(null);
  const [levelTitleModalOpen, setLevelTitleModalOpen] = useState(false);
  const [levelTitleBoard, setLevelTitleBoard] = useState<ForumBoard | null>(null);
  const [levelTitleRows, setLevelTitleRows] = useState<ForumBoardLevelTitle[]>(DEFAULT_BOARD_LEVEL_TITLES);
  const [savingLevelTitles, setSavingLevelTitles] = useState(false);
  const [postActionKeys, setPostActionKeys] = useState<Set<string>>(() => new Set());
  const [filters, setFilters] = useState<{ keyword?: string; category?: string; mine?: boolean; favorites?: boolean }>({
    category: ALL_BOARD_OPTION,
    mine: false,
    favorites: false,
  });
  const [postForm] = Form.useForm<PostFormValues>();
  const [replyForm] = Form.useForm<{ content: string }>();
  const [reportForm] = Form.useForm<ReportFormValues>();
  const [boardForm] = Form.useForm<ForumBoardFormValues>();
  const [ownerApplicationForm] = Form.useForm<ForumBoardOwnerApplicationFormValues>();
  const watchedTagsText = Form.useWatch("tagsText", postForm);
  const watchedBoardAvatarUrl = Form.useWatch("avatarUrl", boardForm);
  const postImageInputRef = useRef<HTMLInputElement | null>(null);
  const replyImageInputRef = useRef<HTMLInputElement | null>(null);
  const boardAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const postsRequestSeqRef = useRef(0);
  const detailRequestSeqRef = useRef(0);
  const postImageUploadInFlightRef = useRef(false);
  const replyImageUploadInFlightRef = useRef(false);
  const postActionKeysRef = useRef<Set<string>>(new Set());

  const activeForumBoards = useMemo(
    () => forumBoards.filter((board) => board.active !== false),
    [forumBoards],
  );
  const boardCategoryOptions = useMemo(
    () => [ALL_BOARD_OPTION, ...activeForumBoards.map((board) => formatCategoryLabel(board.name))],
    [activeForumBoards],
  );
  const defaultPostCategory = activeForumBoards[0]?.name ?? DEFAULT_FORUM_BOARD_NAMES[0];
  const forumBoardByName = useMemo(() => {
    const map = new Map<string, ForumBoard>();
    for (const board of forumBoards) {
      map.set(formatCategoryLabel(board.name), board);
      map.set(board.name, board);
    }
    return map;
  }, [forumBoards]);
  const forumBoardById = useMemo(() => {
    const map = new Map<number, ForumBoard>();
    for (const board of forumBoards) {
      if (board.id) {
        map.set(board.id, board);
      }
    }
    return map;
  }, [forumBoards]);
  const selectedForumBoard = useMemo(() => {
    if (!filters.category || filters.category === ALL_BOARD_OPTION) {
      return null;
    }
    return forumBoardByName.get(formatCategoryLabel(filters.category)) ?? forumBoardByName.get(filters.category) ?? null;
  }, [filters.category, forumBoardByName]);
  const pendingOwnerApplicationByBoardId = useMemo(() => {
    const map = new Map<number, ForumBoardOwnerApplication>();
    for (const application of myOwnerApplications) {
      if (application.status === "PENDING" && application.boardId) {
        map.set(application.boardId, application);
      }
    }
    return map;
  }, [myOwnerApplications]);
  const selectedBoardPendingOwnerApplication = selectedForumBoard?.id
    ? pendingOwnerApplicationByBoardId.get(selectedForumBoard.id)
    : undefined;
  const selectedSignInBoardId = selectedForumBoard?.id ?? null;
  const selectedBoardHasOwner = Boolean(selectedForumBoard?.ownerUserId);
  const selectedBoardOwnedByCurrentUser = Boolean(selectedForumBoard?.ownerUserId && selectedForumBoard.ownerUserId === user?.id);
  const selectedBoardCanManageTitles = Boolean(selectedForumBoard?.id && (isAdmin || selectedBoardOwnedByCurrentUser));

  function isPostActionLoading(postId: number, action: PostAction) {
    return postActionKeys.has(getPostActionKey(postId, action));
  }

  function beginPostAction(postId: number, action: PostAction, label: string) {
    const key = getPostActionKey(postId, action);
    if (postActionKeysRef.current.has(key)) {
      message.warning(`${label}正在处理中，请稍候`);
      return false;
    }

    postActionKeysRef.current.add(key);
    setPostActionKeys((current) => {
      const next = new Set(current);
      next.add(key);
      return next;
    });
    return true;
  }

  function finishPostAction(postId: number, action: PostAction) {
    const key = getPostActionKey(postId, action);
    postActionKeysRef.current.delete(key);
    setPostActionKeys((current) => {
      if (!current.has(key)) {
        return current;
      }
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }

  useEffect(() => {
    setProfileExperience(user?.experience ?? 0);
    setProfileLevel(user?.level ?? 1);
    setProfileTitle(user?.title ?? "新成员");
    setSignInDays(user?.consecutiveSignInDays ?? 0);
  }, [user?.consecutiveSignInDays, user?.experience, user?.level, user?.title]);

  const syncProfileStats = useCallback((experience?: number, level?: number, title?: string | null) => {
    if (typeof experience === "number") {
      setProfileExperience(experience);
      setProfileLevel(typeof level === "number" ? level : calculateLevel(experience));
    }
    if (typeof title === "string" && title.trim()) {
      setProfileTitle(title);
    }
  }, []);

  const applyExperienceDelta = useCallback((delta: number) => {
    if (!isAuthenticated || delta === 0) {
      return;
    }
    setProfileExperience((current) => {
      const next = Math.max(0, current + delta);
      setProfileLevel(calculateLevel(next));
      return next;
    });
  }, [isAuthenticated]);

  const loadForumBoards = useCallback(async (options: { includeInactive?: boolean } = {}) => {
    try {
      const data = await forumApi.getBoards({ includeInactive: options.includeInactive });
      const normalizedBoards = data.length > 0 ? data : DEFAULT_FORUM_BOARDS;
      setForumBoards(normalizedBoards);
      return normalizedBoards;
    } catch (error) {
      if (options.includeInactive) {
        message.error(getFriendlyMessage(error, "吧列表加载失败"));
      }
      setForumBoards((current) => (current.length > 0 ? current : DEFAULT_FORUM_BOARDS));
      return null;
    }
  }, []);

  const loadBoardOwnerApplications = useCallback(async () => {
    if (!isAdmin) {
      return;
    }
    try {
      const data = await forumApi.getBoardOwnerApplications({ status: "PENDING" });
      setBoardOwnerApplications(data);
    } catch (error) {
      message.error(getFriendlyMessage(error, "吧主申请加载失败"));
    }
  }, [isAdmin]);

  const loadMyOwnerApplications = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setMyOwnerApplications([]);
      return;
    }
    try {
      const data = await forumApi.getMyBoardOwnerApplications({ status: "PENDING" });
      setMyOwnerApplications(data);
    } catch {
      setMyOwnerApplications([]);
    }
  }, [isAuthenticated, user?.id]);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const data = await forumApi.getLeaderboard({ boardId: selectedSignInBoardId });
      setLeaderboard({
        signInRank: data.signInRank ?? [],
        activityRank: data.activityRank ?? [],
      });
    } catch {
      // Ignore leaderboard failures so the forum stays usable.
    } finally {
      setLeaderboardLoading(false);
    }
  }, [selectedSignInBoardId]);

  const loadPosts = useCallback(async (currentFilters = filters, page = 1, append = false) => {
    const requestSeq = postsRequestSeqRef.current + 1;
    postsRequestSeqRef.current = requestSeq;
    if (append) {
      setLoadingMorePosts(true);
    } else {
      setLoading(true);
      setPostsLoadingSlow(false);
      setPostsLoadError(null);
    }
    try {
      const data = await forumApi.getPosts({
        page,
        size: 30,
        keyword: currentFilters.keyword,
        category: currentFilters.category === ALL_BOARD_OPTION ? undefined : currentFilters.category,
        mine: currentFilters.mine,
        favorites: currentFilters.favorites,
      });
      if (requestSeq !== postsRequestSeqRef.current) {
        return;
      }
      setPosts((current) => {
        if (!append) {
          return data;
        }
        const items = new Map(current.map((item) => [item.id, item]));
        data.forEach((item) => items.set(item.id, item));
        return [...items.values()];
      });
      setPostPage(page);
      setHasMorePosts(data.length === 30);

      if (user?.id && currentFilters.category && currentFilters.category !== ALL_BOARD_OPTION) {
        const mine = data.find((item) => item.userId === user.id && typeof item.authorExperience === "number");
        if (mine) {
          syncProfileStats(mine.authorExperience, mine.authorLevel, mine.authorTitle);
        }
      }
    } catch (error) {
      if (requestSeq !== postsRequestSeqRef.current) {
        return;
      }
      if (append) {
        message.error(getFriendlyMessage(error, "更多帖子加载失败"));
      } else {
        setPostsLoadError(getFriendlyMessage(error, "帖子加载失败"));
      }
    } finally {
      if (append) {
        setLoadingMorePosts(false);
      } else if (requestSeq === postsRequestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [filters, syncProfileStats, user?.id]);

  useEffect(() => {
    void loadForumBoards();
  }, [loadForumBoards]);

  useEffect(() => {
    void loadPosts(filters);
  }, [filters, loadPosts]);

  useEffect(() => {
    void loadMyOwnerApplications();
  }, [loadMyOwnerApplications]);

  useEffect(() => {
    if (!loading) {
      setPostsLoadingSlow(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setPostsLoadingSlow(true);
    }, 3200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loading]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    const view = searchParams.get("view");
    const nextMine = isAuthenticated && view === "mine";
    const nextFavorites = isAuthenticated && view === "favorites";
    const nextQuickView: QuickView = view === "popular" || view === "pinned" ? view : "latest";

    setQuickView((current) => (current === nextQuickView ? current : nextQuickView));
    setFilters((current) => {
      if (current.mine === nextMine && current.favorites === nextFavorites) {
        return current;
      }
      return { ...current, mine: nextMine, favorites: nextFavorites };
    });
  }, [isAuthenticated, searchParams]);

  useEffect(() => {
    if (!isAuthenticated) {
      setSignedToday(false);
      setSignInDays(0);
      return;
    }

    let cancelled = false;
    void forumApi.getSignInStatus({ boardId: selectedSignInBoardId })
      .then((status) => {
        if (cancelled) {
          return;
        }
        setSignedToday(Boolean(status.signedToday));
        setSignInDays(status.consecutiveSignInDays ?? 0);
        syncProfileStats(status.experience, status.level, status.title);
      })
      .catch(() => {
        // Ignore sign-in status failures so the forum stays usable.
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, selectedSignInBoardId, syncProfileStats]);

  const updateSearchParams = useCallback((updater: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams);
    updater(nextParams);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const openPost = useCallback(async (post: Post, syncQuery = true) => {
    const requestSeq = detailRequestSeqRef.current + 1;
    detailRequestSeqRef.current = requestSeq;
    setQueryPostHandled(post.id);
    if (syncQuery) {
      updateSearchParams((params) => {
        params.set("post", String(post.id));
      });
    }

    setActivePost(post);
    setReplies([]);
    setReplyPage(1);
    setHasMoreReplies(false);
    setReplyFilter("all");
    setReplySort("latest");
    setDetailOpen(true);
    setDetailLoading(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
    try {
      const [detail, replyList] = await Promise.all([forumApi.getPost(post.id), forumApi.getReplies(post.id, 1, 20)]);
      if (requestSeq !== detailRequestSeqRef.current) {
        return;
      }
      setActivePost(detail);
      setReplies(replyList);
      setReplyPage(1);
      setHasMoreReplies(replyList.length === 20 && replyList.length < (detail.replyCount ?? Number.MAX_SAFE_INTEGER));
      setPosts((current) => replacePostById(current, detail));
    } catch (error) {
      if (requestSeq !== detailRequestSeqRef.current) {
        return;
      }
      message.error(getFriendlyMessage(error, "帖子详情加载失败"));
    } finally {
      if (requestSeq === detailRequestSeqRef.current) {
        setDetailLoading(false);
      }
    }
  }, [updateSearchParams]);

  useEffect(() => {
    const postId = Number(searchParams.get("post"));
    if (!postId) {
      setQueryPostHandled(null);
      if (detailOpen) {
        detailRequestSeqRef.current += 1;
        setDetailOpen(false);
        setActivePost(null);
        setReplies([]);
        setReplyPage(1);
        setHasMoreReplies(false);
        setReplyFilter("all");
        setReplySort("latest");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    if (loading || queryPostHandled === postId) {
      return;
    }
    const targetPost = posts.find((item) => item.id === postId);
    if (!targetPost) {
      return;
    }
    setQueryPostHandled(postId);
    void openPost(targetPost, false);
  }, [detailOpen, loading, openPost, posts, queryPostHandled, searchParams]);

  function closeDetailView() {
    clearDetailState();
    updateSearchParams((params) => {
      params.delete("post");
    });
  }

  function clearDetailState(shouldScroll = true) {
    detailRequestSeqRef.current += 1;
    setDetailOpen(false);
    setActivePost(null);
    setReplies([]);
    setReplyPage(1);
    setHasMoreReplies(false);
    setReplyFilter("all");
    setReplySort("latest");
    if (shouldScroll) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function applyFilters(next: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  function applyCategoryFilter(category: string) {
    applyFilters({ category });
    if (detailOpen) {
      clearDetailState();
    }
    updateSearchParams((params) => {
      params.delete("post");
    });
  }

  function handleKeywordInputChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    setKeywordInput(nextValue);
    if (!nextValue.trim() && filters.keyword) {
      applyFilters({ keyword: undefined });
      updateSearchParams((params) => {
        params.delete("post");
      });
    }
  }

  function handleSearch() {
    applyFilters({ keyword: keywordInput.trim() || undefined });
    if (detailOpen) {
      clearDetailState();
    }
    updateSearchParams((params) => {
      params.delete("post");
    });
  }

  async function handleCopyPostLink(postId: number) {
    const params = new URLSearchParams(searchParams);
    params.set("post", String(postId));
    const query = params.toString();
    const url = `${window.location.origin}${location.pathname}${query ? `?${query}` : ""}`;

    try {
      await navigator.clipboard.writeText(url);
      message.success("帖子链接已复制");
    } catch {
      message.warning("浏览器暂时不允许复制，请手动复制地址栏链接");
    }
  }

  function requireForumLogin(action: string) {
    if (isAuthenticated) {
      return true;
    }
    setLoginPromptAction(action);
    return false;
  }

  function closeLoginPrompt() {
    setLoginPromptAction(null);
  }

  function goLoginFromForum() {
    closeLoginPrompt();
    navigate("/login", {
      state: {
        from: `${location.pathname}${location.search}`,
      },
    });
  }

  function appendPostContent(value: string, options: { block?: boolean } = {}) {
    const current = postForm.getFieldValue("content") ?? "";
    if (!options.block) {
      postForm.setFieldsValue({ content: `${current}${value}` });
      return;
    }
    const prefix = current && !current.endsWith("\n") ? "\n" : "";
    postForm.setFieldsValue({ content: `${current}${prefix}${value}\n` });
  }

  function appendReplyContent(value: string, options: { block?: boolean } = {}) {
    const current = replyForm.getFieldValue("content") ?? "";
    if (!options.block) {
      replyForm.setFieldsValue({ content: `${current}${value}` });
      return;
    }
    const prefix = current && !current.endsWith("\n") ? "\n" : "";
    replyForm.setFieldsValue({ content: `${current}${prefix}${value}\n` });
  }

  async function uploadForumImage(
    file: File,
    appendContent: (value: string, options: { block?: boolean }) => void,
    setUploading: (value: boolean) => void,
    messageKey: string,
  ) {
    if (!requireForumLogin("上传图片")) {
      return;
    }
    const validationError = getImageFileValidationError(file, "论坛图片");
    if (validationError) {
      message.error(validationError);
      return;
    }

    setUploading(true);
    message.open({
      type: "loading",
      key: messageKey,
      content: "图片上传中...",
      duration: 0,
    });
    try {
      const uploaded = await forumApi.uploadImage(file);
      appendContent(buildImageMarkup(uploaded.url), { block: true });
      message.success({
        key: messageKey,
        content: "图片已插入",
        duration: 2,
      });
    } catch (error) {
      message.error({
        key: messageKey,
        content: getFriendlyMessage(error, "图片上传失败"),
        duration: 4,
      });
    } finally {
      setUploading(false);
    }
  }

  async function handlePostImageUpload(file: File | null | undefined) {
    if (!file) {
      return;
    }
    if (postImageUploadInFlightRef.current) {
      message.warning("图片正在上传中，请稍候");
      return;
    }

    postImageUploadInFlightRef.current = true;
    try {
      await uploadForumImage(file, appendPostContent, setUploadingPostImage, POST_IMAGE_UPLOAD_MESSAGE_KEY);
    } finally {
      postImageUploadInFlightRef.current = false;
    }
  }

  async function handleReplyImageUpload(file: File | null | undefined) {
    if (!file) {
      return;
    }
    if (replyImageUploadInFlightRef.current) {
      message.warning("图片正在上传中，请稍候");
      return;
    }

    replyImageUploadInFlightRef.current = true;
    try {
      await uploadForumImage(file, appendReplyContent, setUploadingReplyImage, REPLY_IMAGE_UPLOAD_MESSAGE_KEY);
    } finally {
      replyImageUploadInFlightRef.current = false;
    }
  }

  function handlePostImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void handlePostImageUpload(file);
  }

  function handleReplyImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void handleReplyImageUpload(file);
  }

  function openBoardManager() {
    if (!isAdmin) {
      message.warning("仅管理员可以管理吧");
      return;
    }
    setEditingBoard(null);
    boardForm.resetFields();
    boardForm.setFieldsValue({ name: "", description: "", avatarUrl: "", sortOrder: forumBoards.length + 1, active: true });
    setBoardManagerOpen(true);
    void loadForumBoards({ includeInactive: true });
    void loadBoardOwnerApplications();
  }

  function startCreateBoard() {
    setEditingBoard(null);
    boardForm.resetFields();
    boardForm.setFieldsValue({ name: "", description: "", avatarUrl: "", sortOrder: forumBoards.length + 1, active: true });
  }

  function startEditBoard(board: ForumBoard) {
    setEditingBoard(board);
    boardForm.setFieldsValue({
      name: board.name,
      description: board.description ?? "",
      avatarUrl: board.avatarUrl ?? "",
      sortOrder: board.sortOrder ?? 0,
      active: board.active !== false,
    });
  }

  function buildBoardPayload(values: ForumBoardFormValues): SaveForumBoardPayload {
    return {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      avatarUrl: values.avatarUrl?.trim() || null,
      sortOrder: values.sortOrder ?? 0,
      active: values.active !== false,
    };
  }

  async function handleSaveBoard(values: ForumBoardFormValues) {
    setSavingBoard(true);
    const payload = buildBoardPayload(values);
    try {
      const saved = editingBoard?.id
        ? await forumApi.updateBoard(editingBoard.id, payload)
        : await forumApi.createBoard(payload);
      message.success(editingBoard ? "吧信息已保存" : "新吧已创建");
      setEditingBoard(saved);
      boardForm.setFieldsValue({
        name: saved.name,
        description: saved.description ?? "",
        avatarUrl: saved.avatarUrl ?? "",
        sortOrder: saved.sortOrder ?? 0,
        active: saved.active !== false,
      });
      await loadForumBoards({ includeInactive: true });
      void loadPosts(filters);
    } catch (error) {
      message.error(getFriendlyMessage(error, "保存吧失败"));
    } finally {
      setSavingBoard(false);
    }
  }

  async function handleToggleBoardActive(board: ForumBoard) {
    if (!board.id) {
      return;
    }
    try {
      await forumApi.updateBoard(board.id, {
        name: board.name,
        description: board.description ?? null,
        avatarUrl: board.avatarUrl ?? null,
        sortOrder: board.sortOrder ?? 0,
        active: board.active === false,
      });
      message.success(board.active === false ? "吧已启用" : "吧已停用");
      await loadForumBoards({ includeInactive: true });
    } catch (error) {
      message.error(getFriendlyMessage(error, "更新吧状态失败"));
    }
  }

  function openLevelTitleModal(board: ForumBoard) {
    if (!board.id) {
      message.warning("这个吧暂时不能设置头衔");
      return;
    }
    const canManage = isAdmin || board.ownerUserId === user?.id;
    if (!canManage) {
      message.warning("仅管理员或该吧吧主可以设置头衔");
      return;
    }
    setLevelTitleBoard(board);
    setLevelTitleRows(parseBoardLevelTitles(board.levelTitleConfig));
    setLevelTitleModalOpen(true);
  }

  function updateLevelTitleRow(index: number, patch: Partial<ForumBoardLevelTitle>) {
    setLevelTitleRows((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  function addLevelTitleRow() {
    setLevelTitleRows((current) => [...current, { level: Math.max(...current.map((item) => item.level), 0) + 1, title: "" }]);
  }

  function removeLevelTitleRow(index: number) {
    setLevelTitleRows((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleSaveLevelTitles() {
    if (!levelTitleBoard?.id) {
      return;
    }
    const titles = levelTitleRows
      .map((item) => ({ level: Math.max(1, Math.floor(Number(item.level) || 1)), title: item.title.trim() }))
      .filter((item) => item.title)
      .sort((a, b) => a.level - b.level);
    setSavingLevelTitles(true);
    try {
      await forumApi.updateBoardLevelTitles(levelTitleBoard.id, titles);
      message.success("等级头衔已保存");
      setLevelTitleModalOpen(false);
      setLevelTitleBoard(null);
      await loadForumBoards({ includeInactive: isAdmin });
      void loadPosts(filters);
      void loadLeaderboard();
    } catch (error) {
      message.error(getFriendlyMessage(error, "等级头衔保存失败"));
    } finally {
      setSavingLevelTitles(false);
    }
  }

  function openOwnerApplication(board: ForumBoard) {
    if (!requireForumLogin("申请吧主")) {
      return;
    }
    if (!board.id) {
      message.warning("这个吧暂时不能申请吧主");
      return;
    }
    if (board.ownerUserId === user?.id) {
      message.info("你已经是这个吧的吧主");
      return;
    }
    if (board.ownerUserId) {
      message.info("这个吧已经有吧主了");
      return;
    }
    if (pendingOwnerApplicationByBoardId.has(board.id)) {
      message.info("你申请这个吧的吧主正在审核中");
      return;
    }
    setOwnerApplicationTarget(board);
    ownerApplicationForm.resetFields();
    ownerApplicationForm.setFieldsValue({ reason: "" });
    setOwnerApplicationOpen(true);
  }

  async function handleSubmitOwnerApplication(values: ForumBoardOwnerApplicationFormValues) {
    if (!ownerApplicationTarget?.id) {
      return;
    }
    setSubmittingOwnerApplication(true);
    try {
      const application = await forumApi.applyBoardOwner(ownerApplicationTarget.id, { reason: values.reason.trim() });
      setMyOwnerApplications((current) => [
        application,
        ...current.filter((item) => item.id !== application.id && item.boardId !== application.boardId),
      ]);
      message.success("吧主申请已提交，请等待管理员审核");
      setOwnerApplicationOpen(false);
      setOwnerApplicationTarget(null);
    } catch (error) {
      message.error(getFriendlyMessage(error, "吧主申请提交失败"));
    } finally {
      setSubmittingOwnerApplication(false);
    }
  }

  async function handleReviewOwnerApplication(applicationId: number, approved: boolean) {
    setReviewingOwnerApplicationId(applicationId);
    try {
      await forumApi.reviewBoardOwnerApplication(applicationId, { approved });
      message.success(approved ? "已通过吧主申请" : "已拒绝吧主申请");
      await Promise.all([
        loadBoardOwnerApplications(),
        loadForumBoards({ includeInactive: true }),
      ]);
    } catch (error) {
      message.error(getFriendlyMessage(error, "审核吧主申请失败"));
    } finally {
      setReviewingOwnerApplicationId(null);
    }
  }

  async function handleBoardAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const validationError = getImageFileValidationError(file, "吧头像");
    if (validationError) {
      message.error(validationError);
      return;
    }
    setUploadingBoardAvatar(true);
    try {
      const uploaded = await forumApi.uploadBoardAvatar(file);
      boardForm.setFieldValue("avatarUrl", uploaded.url);
      message.success("吧头像已上传");
    } catch (error) {
      message.error(getFriendlyMessage(error, "吧头像上传失败"));
    } finally {
      setUploadingBoardAvatar(false);
    }
  }

  function handlePostPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = getClipboardImageFile(event.clipboardData);
    if (!file) {
      return;
    }
    event.preventDefault();
    void handlePostImageUpload(file);
  }

  function handleReplyPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = getClipboardImageFile(event.clipboardData);
    if (!file) {
      return;
    }
    event.preventDefault();
    void handleReplyImageUpload(file);
  }

  function openCreateModal() {
    if (!requireForumLogin("发帖")) {
      return;
    }
    setEditingPost(null);
    postForm.resetFields();
    postForm.setFieldsValue({ category: defaultPostCategory, tagsText: "" });
    setEditorOpen(true);
  }

  function openEditModal(post: Post) {
    setEditingPost(post);
    postForm.setFieldsValue({
      title: post.title,
      content: post.content,
      category: normalizeCategoryValue(post.category),
      tagsText: (post.tags ?? []).join(", "),
    });
    setEditorOpen(true);
  }

  async function handleSavePost(values: PostFormValues) {
    setSavingPost(true);
    try {
      const payload: CreatePostPayload = {
        title: values.title.trim(),
        content: values.content.trim(),
        category: values.category,
        tags: parseTags(values.tagsText),
      };

      const saved = editingPost
        ? await forumApi.updatePost(editingPost.id, payload)
        : await forumApi.createPost(payload);

      setPosts((current) => {
        if (editingPost) {
          return replacePostById(current, saved);
        }
        return [saved, ...current];
      });

      if (activePost?.id === saved.id) {
        setActivePost(saved);
      }

      if (saved.userId === user?.id) {
        syncProfileStats(saved.authorExperience, saved.authorLevel, saved.authorTitle);
      }

      setEditorOpen(false);
      postForm.resetFields();
      message.success(editingPost ? "帖子已更新" : "帖子已发布");
      void loadPosts();
      void loadLeaderboard();
    } catch (error) {
      message.error(getFriendlyMessage(error, "帖子保存失败"));
    } finally {
      setSavingPost(false);
    }
  }

  async function handleDeletePost(postId: number) {
    if (!beginPostAction(postId, "delete", "删除")) {
      return;
    }
    try {
      await forumApi.deletePost(postId);
      setPosts((current) => current.filter((item) => item.id !== postId));
      if (activePost?.id === postId) {
        closeDetailView();
      }
      message.success("帖子已删除");
      void loadLeaderboard();
    } catch (error) {
      message.error(getFriendlyMessage(error, "删除帖子失败"));
    } finally {
      finishPostAction(postId, "delete");
    }
  }

  async function handleToggleLike(postId: number) {
    if (!requireForumLogin("点赞")) {
      return;
    }
    if (!beginPostAction(postId, "like", "点赞")) {
      return;
    }
    try {
      const previous = posts.find((item) => item.id === postId) ?? activePost ?? null;
      const updated = await forumApi.toggleLike(postId);
      setPosts((current) => replacePostById(current, updated));
      if (activePost?.id === updated.id) {
        setActivePost(updated);
      }

      if (user && previous && previous.userId !== user.id) {
        applyExperienceDelta(updated.likedByCurrentUser ? EXP_PER_GIVE_LIKE : -EXP_PER_GIVE_LIKE);
      }
    } catch (error) {
      message.error(getFriendlyMessage(error, "点赞状态更新失败"));
    } finally {
      finishPostAction(postId, "like");
    }
  }

  async function handleToggleFavorite(postId: number) {
    if (!requireForumLogin("收藏")) {
      return;
    }
    if (!beginPostAction(postId, "favorite", "收藏")) {
      return;
    }
    try {
      const updated = await forumApi.toggleFavorite(postId);
      setPosts((current) => {
        if (filters.favorites && !updated.favoritedByCurrentUser) {
          return current.filter((item) => item.id !== updated.id);
        }
        return replacePostById(current, updated);
      });
      if (activePost?.id === updated.id) {
        setActivePost(updated);
      }
      message.success(updated.favoritedByCurrentUser ? "已加入收藏" : "已取消收藏");
    } catch (error) {
      message.error(getFriendlyMessage(error, "收藏状态更新失败"));
    } finally {
      finishPostAction(postId, "favorite");
    }
  }

  async function handleTogglePin(postId: number, pinned: boolean) {
    if (!beginPostAction(postId, "pin", "置顶")) {
      return;
    }
    try {
      const updated = await forumApi.updatePin(postId, pinned);
      setPosts((current) => sortPostsByPinnedAndTime(replacePostById(current, updated)));
      if (activePost?.id === updated.id) {
        setActivePost(updated);
      }
      message.success(pinned ? "帖子已置顶" : "帖子已取消置顶");
    } catch (error) {
      message.error(getFriendlyMessage(error, "置顶状态更新失败"));
    } finally {
      finishPostAction(postId, "pin");
    }
  }

  async function handleCreateReply(values: { content: string }) {
    if (!activePost) {
      return;
    }
    if (!requireForumLogin("回复")) {
      return;
    }

    setSavingReply(true);
    try {
      const reply = await forumApi.createReply(activePost.id, values);
      setReplies((current) => [reply, ...current]);
      setActivePost((current) => (current ? { ...current, replyCount: (current.replyCount ?? 0) + 1 } : current));
      setPosts((current) =>
        current.map((item) => (item.id === activePost.id ? { ...item, replyCount: (item.replyCount ?? 0) + 1 } : item)),
      );

      if (reply.userId === user?.id) {
        syncProfileStats(reply.authorExperience, reply.authorLevel, reply.authorTitle);
      }

      replyForm.resetFields();
      message.success("回复已发布");
      void loadLeaderboard();
    } catch (error) {
      message.error(getFriendlyMessage(error, "发布回复失败"));
    } finally {
      setSavingReply(false);
    }
  }

  async function handleLoadMoreReplies() {
    if (!activePost || loadingMoreReplies) {
      return;
    }
    const postId = activePost.id;
    const requestSeq = detailRequestSeqRef.current;
    const nextPage = replyPage + 1;
    setLoadingMoreReplies(true);
    try {
      const nextReplies = await forumApi.getReplies(postId, nextPage, 20);
      if (requestSeq !== detailRequestSeqRef.current) {
        return;
      }
      setReplies((current) => {
        const items = new Map(current.map((item) => [item.id, item]));
        nextReplies.forEach((item) => items.set(item.id, item));
        return [...items.values()];
      });
      setReplyPage(nextPage);
      const loadedReplyIds = new Set(replies.map((reply) => reply.id));
      nextReplies.forEach((reply) => loadedReplyIds.add(reply.id));
      setHasMoreReplies(nextReplies.length === 20 && loadedReplyIds.size < (activePost.replyCount ?? Number.MAX_SAFE_INTEGER));
    } catch (error) {
      message.error(getFriendlyMessage(error, "更多回复加载失败"));
    } finally {
      setLoadingMoreReplies(false);
    }
  }

  async function handleSignIn() {
    if (!requireForumLogin("签到")) {
      return;
    }
    setSigningIn(true);
    try {
      const status = await forumApi.signIn({ boardId: selectedSignInBoardId });
      setSignedToday(Boolean(status.signedToday));
      setSignInDays(status.consecutiveSignInDays ?? 0);
      syncProfileStats(status.experience, status.level, status.title);
      await refreshUser().catch(() => null);
      message.success(status.gainedExperience > 0 ? `签到成功，获得 +${status.gainedExperience} 经验` : "今天已经签到过了");
      void loadLeaderboard();
    } catch (error) {
      message.error(getFriendlyMessage(error, "签到失败"));
    } finally {
      setSigningIn(false);
    }
  }

  function openReportModal(post: Post) {
    if (!requireForumLogin("举报")) {
      return;
    }
    setReportTarget(post);
    reportForm.resetFields();
    setReportModalOpen(true);
  }

  async function handleSubmitReport(values: ReportFormValues) {
    if (!reportTarget) {
      return;
    }

    setReporting(true);
    try {
      await forumApi.reportPost(reportTarget.id, values);
      setReportModalOpen(false);
      setReportTarget(null);
      reportForm.resetFields();
      message.success("举报已提交");
    } catch (error) {
      message.error(getFriendlyMessage(error, "提交举报失败"));
    } finally {
      setReporting(false);
    }
  }

  const displayPosts = useMemo(() => {
    const nextPosts = [...posts];
    if (quickView === "popular") {
      return nextPosts.sort(
        (a, b) =>
          (b.likeCount + b.replyCount * 2 + Math.floor(b.viewCount / 10)) -
            (a.likeCount + a.replyCount * 2 + Math.floor(a.viewCount / 10)) ||
          getTimeValue(b.createTime) - getTimeValue(a.createTime),
      );
    }
    if (quickView === "pinned") {
      return nextPosts.filter((item) => item.pinned).sort((a, b) => getTimeValue(b.createTime) - getTimeValue(a.createTime));
    }
    return sortPostsByPinnedAndTime(posts);
  }, [posts, quickView]);

  const postImageMetaById = useMemo(() => {
    const metaById = new Map<number, PostImageMeta>();
    for (const post of posts) {
      metaById.set(post.id, getPostImageMeta(post.content));
    }
    return metaById;
  }, [posts]);

  const forumStats = useMemo(() => {
    let totalReplies = 0;
    let totalViews = 0;
    let totalLikes = 0;
    let pinnedCount = 0;
    let imagePostCount = 0;
    const memberIds = new Set<number>();

    for (const post of posts) {
      totalReplies += post.replyCount ?? 0;
      totalViews += post.viewCount ?? 0;
      totalLikes += post.likeCount ?? 0;
      pinnedCount += post.pinned ? 1 : 0;
      imagePostCount += (postImageMetaById.get(post.id)?.imageCount ?? 0) > 0 ? 1 : 0;
      memberIds.add(post.userId);
    }

    return { totalReplies, totalViews, totalLikes, memberCount: memberIds.size, pinnedCount, imagePostCount };
  }, [postImageMetaById, posts]);

  const forumTaxonomy = useMemo(() => {
    const tagCounter = new Map<string, number>();
    const categoryCounter = new Map<string, number>();

    for (const post of posts) {
      const categoryLabel = formatCategoryLabel(post.category);
      categoryCounter.set(categoryLabel, (categoryCounter.get(categoryLabel) ?? 0) + 1);

      for (const tag of post.tags ?? []) {
        tagCounter.set(tag, (tagCounter.get(tag) ?? 0) + 1);
      }
    }

    const hotTags = [...tagCounter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const frequentBarsFromPosts = [...categoryCounter.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

    return {
      hotTags,
      frequentBars: frequentBarsFromPosts.length > 0
        ? frequentBarsFromPosts
        : activeForumBoards.slice(0, 5).map((board) => ({ label: formatCategoryLabel(board.name), count: 0 })),
    };
  }, [activeForumBoards, posts]);

  const postListItems = useMemo<ForumPostListItem[]>(
    () =>
      displayPosts.map((post) => {
        const categoryLabel = formatCategoryLabel(post.category);
        const board = forumBoardByName.get(categoryLabel) ?? forumBoardByName.get(post.category ?? "");
        return {
          post,
          barName: `${categoryLabel}吧`,
          createdAtLabel: formatTime(post.createTime),
          forumAvatarUrl: resolveAssetUrl(board?.avatarUrl),
          forumAvatarLabel: getDisplayInitial(categoryLabel),
          forumAvatarToneKey: categoryLabel,
          imageMeta: postImageMetaById.get(post.id) ?? getPostImageMeta(post.content),
          previewText: getTextPreviewWithoutImageBlocks(post.content, "图片帖"),
          previewTags: (post.tags ?? []).slice(0, 3),
        };
      }),
    [displayPosts, forumBoardByName, postImageMetaById],
  );

  const forumSummaryCards = useMemo<ForumSummaryCardItem[]>(
    () => [
      {
        label: "当前显示",
        value: loading && posts.length === 0 ? "--" : formatCompactNumber(displayPosts.length),
        detail: `总主题 ${formatCompactNumber(posts.length)}`,
      },
      {
        label: "回复互动",
        value: formatCompactNumber(forumStats.totalReplies),
        detail: `点赞 ${formatCompactNumber(forumStats.totalLikes)}`,
      },
      {
        label: "浏览量",
        value: formatCompactNumber(forumStats.totalViews),
        detail: `吧友 ${formatCompactNumber(forumStats.memberCount)}`,
      },
      {
        label: "内容形态",
        value: formatCompactNumber(forumStats.imagePostCount),
        detail: `置顶 ${formatCompactNumber(forumStats.pinnedCount)} / 图片帖`,
      },
    ],
    [displayPosts.length, forumStats, loading, posts.length],
  );

  const activeFilterLabels = useMemo<ForumFilterLabel[]>(() => {
    const labels: ForumFilterLabel[] = [];
    if (quickView !== "latest" && !filters.mine && !filters.favorites) {
      labels.push({ key: "view", label: `视图：${quickViewLabelMap.get(quickView) ?? "最新"}`, color: "blue" });
    }
    if (filters.mine) {
      labels.push({ key: "mine", label: "我的帖子", color: "green" });
    }
    if (filters.favorites) {
      labels.push({ key: "favorites", label: "我的收藏", color: "gold" });
    }
    if (filters.category && filters.category !== ALL_BOARD_OPTION) {
      labels.push({ key: "category", label: `分类：${formatCategoryLabel(filters.category)}`, color: "cyan" });
    }
    if (filters.keyword) {
      labels.push({ key: "keyword", label: `搜索：${filters.keyword}`, color: "purple" });
    }
    return labels;
  }, [filters.category, filters.favorites, filters.keyword, filters.mine, quickView]);

  const topAuthors = useMemo(() => {
    const map = new Map<number, { userId: number; author: string; title?: string | null; level: number; experience: number; avatarUrl?: string | null; posts: number }>();
    for (const post of posts) {
      const current = map.get(post.userId);
      if (!current) {
        map.set(post.userId, {
          userId: post.userId,
          author: post.author,
          title: post.authorTitle,
          level: post.authorLevel ?? 1,
          experience: post.authorExperience ?? 0,
          avatarUrl: post.authorAvatarUrl,
          posts: 1,
        });
      } else {
        current.posts += 1;
        current.title = current.title ?? post.authorTitle;
        current.level = Math.max(current.level, post.authorLevel ?? 1);
        current.experience = Math.max(current.experience, post.authorExperience ?? 0);
      }
    }
    return [...map.values()].sort((a, b) => b.level - a.level || b.experience - a.experience || b.posts - a.posts).slice(0, 6);
  }, [posts]);

  const hotPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => getPostHeat(b) - getPostHeat(a) || getTimeValue(b.updateTime || b.createTime) - getTimeValue(a.updateTime || a.createTime))
      .slice(0, 6);
  }, [posts]);

  const recommendedPosts = useMemo(() => {
    const activeCategory = activePost ? formatCategoryLabel(activePost.category) : "";
    const activeTags = new Set((activePost?.tags ?? []).map((tag) => tag.trim()).filter(Boolean));

    return posts
      .filter((post) => post.id !== activePost?.id)
      .map((post) => {
        const categoryMatched = Boolean(activeCategory) && formatCategoryLabel(post.category) === activeCategory;
        const sharedTag = (post.tags ?? []).find((tag) => activeTags.has(tag));
        const sameAuthor = Boolean(activePost) && post.userId === activePost?.userId;
        const imageCount = postImageMetaById.get(post.id)?.imageCount ?? 0;
        const score = getPostHeat(post)
          + (sharedTag ? 6000 : 0)
          + (categoryMatched ? 4200 : 0)
          + (sameAuthor ? 1800 : 0)
          + (imageCount > 0 ? 500 : 0);
        const reason = sharedTag
          ? `同标签 #${sharedTag}`
          : categoryMatched
            ? `同吧 ${activeCategory}`
            : sameAuthor
              ? "同作者"
              : imageCount > 0
                ? "图文主题"
                : "热门讨论";

        return { post, reason, score };
      })
      .sort((a, b) => b.score - a.score || getTimeValue(b.post.updateTime || b.post.createTime) - getTimeValue(a.post.updateTime || a.post.createTime))
      .slice(0, 4);
  }, [activePost, postImageMetaById, posts]);

  const recommendationItems = useMemo<ForumRecommendationItem[]>(
    () =>
      recommendedPosts.map(({ post, reason }) => ({
        post,
        imageUrl: postImageMetaById.get(post.id)?.previewUrls[0] ?? getPostPreviewImageUrls(post.content, 1)[0],
        previewText: getTextPreviewWithoutImageBlocks(post.content, "图片帖"),
        reason,
      })),
    [postImageMetaById, recommendedPosts],
  );

  const authorReplyCount = useMemo(() => {
    if (!activePost) {
      return 0;
    }
    return replies.filter((reply) => reply.userId === activePost.userId).length;
  }, [activePost, replies]);

  const replyFloorById = useMemo(() => {
    const orderedReplies = [...replies].sort((a, b) => getTimeValue(a.createTime) - getTimeValue(b.createTime));
    const firstFloor = Math.max(2, (activePost?.replyCount ?? orderedReplies.length) - orderedReplies.length + 2);
    return new Map(orderedReplies.map((reply, index) => [reply.id, index + firstFloor]));
  }, [activePost?.replyCount, replies]);

  const displayReplies = useMemo(() => {
    const filteredReplies = replyFilter === "author" && activePost
      ? replies.filter((reply) => reply.userId === activePost.userId)
      : replies;

    return [...filteredReplies].sort((a, b) => {
      const timeA = getTimeValue(a.createTime);
      const timeB = getTimeValue(b.createTime);
      return replySort === "latest" ? timeB - timeA : timeA - timeB;
    });
  }, [activePost, replies, replyFilter, replySort]);

  const replyListItems = useMemo<ForumReplyListItem[]>(
    () =>
      displayReplies.map((reply) => ({
        reply,
        authorAvatarUrl: resolveAssetUrl(reply.authorAvatarUrl),
        createdAtLabel: formatFullTime(reply.createTime),
        floor: replyFloorById.get(reply.id) ?? "-",
        isAuthor: reply.userId === activePost?.userId,
      })),
    [activePost?.userId, displayReplies, replyFloorById],
  );

  const activePostMeta = useMemo<ActivePostMeta | null>(() => {
    if (!activePost) {
      return null;
    }
    return {
      authorAvatarUrl: resolveAssetUrl(activePost.authorAvatarUrl),
      categoryLabel: formatCategoryLabel(activePost.category),
      fullTimeLabel: formatFullTime(activePost.createTime),
    };
  }, [activePost]);

  const editorTagCandidates = useMemo(() => getTagCandidates(watchedTagsText), [watchedTagsText]);
  const editorPreviewTags = editorTagCandidates.slice(0, POST_TAG_MAX_COUNT);
  const editorDroppedTagCount = Math.max(0, editorTagCandidates.length - POST_TAG_MAX_COUNT);

  const currentExperience = profileExperience ?? 0;
  const currentLevel = profileLevel ?? 1;
  const levelProgress = getLevelProgress(currentExperience);
  const experienceToNextLevel = currentLevel * EXP_PER_LEVEL - currentExperience;
  const signInScopeLabel = selectedForumBoard ? `${formatCategoryLabel(selectedForumBoard.name)}吧` : "全站";
  const signInRank = leaderboard.signInRank ?? [];
  const activityRank = leaderboard.activityRank ?? [];
  const hotTags = forumTaxonomy.hotTags;
  const frequentBars = forumTaxonomy.frequentBars;
  const shouldShowTopAuthors = topAuthors.length > 0;
  const shouldShowSignInRank = signInRank.length > 0;
  const shouldShowActivityRank = activityRank.length > 0;
  const shouldShowHotTags = hotTags.length > 0;
  const hasActivePostFilters = Boolean(filters.keyword)
    || filters.category !== ALL_BOARD_OPTION
    || filters.mine
    || filters.favorites
    || quickView !== "latest";
  const forumHeroSummary = loading && posts.length === 0
    ? "正在同步社区内容..."
    : postsLoadError
      ? `帖子接口暂时不可用：${postsLoadError}`
      : posts.length === 0
        ? hasActivePostFilters
          ? "当前筛选没有匹配主题。"
          : "还没有主题，欢迎发布第一篇帖子。"
        : "";
  const emptyPostTitle = postsLoadError ? "帖子暂时加载失败" : hasActivePostFilters ? "没有找到匹配的帖子" : "还没有帖子";
  const emptyPostDescription = postsLoadError
    ? "可以先继续浏览侧边内容，或稍后重新加载帖子。"
    : hasActivePostFilters
      ? "可以换个关键词、分类或视图再试试。"
      : "可以发布第一篇帖子，让社区先热起来。";
  const isDetailMode = detailOpen;

  function applyQuickFilter(key: QuickView) {
    if (key === "mine") {
      if (!requireForumLogin("查看我的帖子")) {
        return;
      }
      if (detailOpen) {
        clearDetailState();
      }
      updateSearchParams((params) => {
        params.set("view", "mine");
        params.delete("post");
      });
      return;
    }
    if (key === "favorites") {
      if (!requireForumLogin("查看收藏")) {
        return;
      }
      if (detailOpen) {
        clearDetailState();
      }
      updateSearchParams((params) => {
        params.set("view", "favorites");
        params.delete("post");
      });
      return;
    }
    if (detailOpen) {
      clearDetailState();
    }
    updateSearchParams((params) => {
      if (key === "latest") {
        params.delete("view");
      } else {
        params.set("view", key);
      }
      params.delete("post");
    });
  }

  function resetForumFilters() {
    setKeywordInput("");
    setQuickView("latest");
    if (detailOpen) {
      clearDetailState();
    }
    setFilters({
      category: ALL_BOARD_OPTION,
      mine: false,
      favorites: false,
      keyword: undefined,
    });
    updateSearchParams((params) => {
      params.delete("view");
      params.delete("post");
    });
  }

  return (
    <MainLayout contentWidth="wide" mode="workspace">
      <div className="-mx-4 -mt-5 bg-white text-[#111827] md:-mx-6 md:-mt-6">
        <div className={`sticky ${FORUM_SUBHEADER_TOP_CLASS} z-30 border-b border-[#edf0f5] bg-white/95 backdrop-blur`}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 md:px-8 md:py-3 min-[1180px]:grid-cols-[220px_minmax(0,1fr)_280px] min-[1180px]:px-0 2xl:grid-cols-[288px_minmax(0,1fr)_328px]">
            <button
              type="button"
              aria-label="返回论坛首页并清空筛选"
              className="flex min-w-0 items-center gap-2 text-left min-[1180px]:px-6 2xl:px-10"
              onClick={resetForumFilters}
            >
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[#2468ff] to-[#8854ff] text-sm font-black text-white">贴</span>
              <span className="truncate text-xl font-black">IDNCAR吧</span>
            </button>
            <div className="col-span-2 row-start-2 min-w-0 min-[1180px]:col-span-1 min-[1180px]:row-auto min-[1180px]:px-6 2xl:px-10">
              <div className="mx-auto w-full max-w-[720px] 2xl:max-w-[900px]">
                <Input.Search
                  allowClear
                  value={keywordInput}
                  onChange={handleKeywordInputChange}
                  onSearch={handleSearch}
                  placeholder="搜索吧或者帖子"
                  enterButton={<SearchOutlined />}
                  className="w-full [&_.ant-input-group-addon_button]:rounded-r-full [&_.ant-input]:h-9 [&_.ant-input]:rounded-l-full [&_.ant-input]:border-0 [&_.ant-input]:bg-[#f5f6fa]"
                />
              </div>
            </div>
            <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 min-[1180px]:col-auto min-[1180px]:row-auto min-[1180px]:px-4 2xl:px-6">
              {isAdmin ? (
                <Button icon={<SettingOutlined />} onClick={openBoardManager}>
                  管理吧
                </Button>
              ) : null}
              {isAuthenticated ? (
                <Button icon={<ThunderboltOutlined />} loading={signingIn} disabled={signedToday} onClick={() => void handleSignIn()}>
                  {signedToday ? "已签到" : `${signInScopeLabel}签到`}
                </Button>
              ) : (
                <Button icon={<ThunderboltOutlined />} onClick={() => setLoginPromptAction("签到")}>
                  签到
                </Button>
              )}
              <Button type="primary" shape="round" icon={<PlusOutlined />} onClick={openCreateModal}>
                发帖
              </Button>
            </div>
          </div>
        </div>

        <div className={`grid ${FORUM_BODY_MIN_HEIGHT_CLASS} grid-cols-1 min-[1180px]:grid-cols-[220px_minmax(0,1fr)_280px] 2xl:grid-cols-[288px_minmax(0,1fr)_328px]`}>
          <aside className="hidden border-r border-[#edf0f5] min-[1180px]:block">
            <div className={`${FORUM_SIDE_PANEL_STICKY_CLASS} px-6 py-4 2xl:px-10`}>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => applyQuickFilter("latest")}
                  className={`flex h-12 w-full items-center gap-3 rounded-lg px-4 text-left text-[15px] font-bold transition ${
                    !filters.mine && !filters.favorites && quickView === "latest" ? "bg-[#f5f6fb]" : "hover:bg-[#f7f8fb]"
                  }`}
                >
                  <HomeOutlined className="text-[22px]" />
                  首页
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickFilter("mine")}
                  className={`flex h-12 w-full items-center gap-3 rounded-lg px-4 text-left text-[15px] font-bold transition ${
                    filters.mine ? "bg-[#f5f6fb]" : "hover:bg-[#f7f8fb]"
                  }`}
                >
                  <UserOutlined className="text-[22px]" />
                  我的
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickFilter("favorites")}
                  className={`flex h-12 w-full items-center gap-3 rounded-lg px-4 text-left text-[15px] font-bold transition ${
                    filters.favorites ? "bg-[#f5f6fb]" : "hover:bg-[#f7f8fb]"
                  }`}
                >
                  <StarOutlined className="text-lg" />
                  收藏
                </button>
              </div>

              <section className="mt-5 border-t border-[#f0f2f5] pt-5">
                <h2 className="mb-4 text-xs font-black text-[#8b95a5]">我常逛的吧</h2>
                <div className="space-y-4">
                  {frequentBars.map((item) => {
                    const boardAvatarUrl = resolveAssetUrl(forumBoardByName.get(item.label)?.avatarUrl);
                    return (
                      <button
                        key={`often-${item.label}`}
                        type="button"
                        onClick={() => applyCategoryFilter(item.label)}
                        className="flex w-full items-center gap-3 text-left text-[15px] font-semibold"
                      >
                        <Avatar
                          shape="square"
                          size={32}
                          src={boardAvatarUrl}
                          className={`shrink-0 rounded-lg text-xs font-black ${boardAvatarUrl ? "" : getAvatarToneClass(item.label)}`}
                        >
                          {getDisplayInitial(item.label)}
                        </Avatar>
                        <span className="min-w-0 flex-1 truncate">{item.label}吧</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mt-5 border-t border-[#f0f2f5] pt-5">
                <h2 className="mb-4 text-xs font-black text-[#8b95a5]">我关注的吧</h2>
                <div className="space-y-4">
                  {activeForumBoards.map((board) => {
                    const item = formatCategoryLabel(board.name);
                    const boardAvatarUrl = resolveAssetUrl(board.avatarUrl);
                    return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => applyCategoryFilter(item)}
                      className="flex w-full items-center gap-3 text-left text-[15px] font-semibold"
                    >
                      <Avatar
                        shape="square"
                        size={32}
                        src={boardAvatarUrl}
                        className={`shrink-0 rounded-lg text-xs font-black ${boardAvatarUrl ? "" : getAvatarToneClass(item)}`}
                      >
                        {getDisplayInitial(item)}
                      </Avatar>
                      <span className="min-w-0 flex-1 truncate">{item}吧</span>
                      {item === filters.category ? <span className="rounded-full bg-[#62cfa8] px-1.5 text-[10px] font-black text-white">选中</span> : null}
                    </button>
                    );
                  })}
                </div>
              </section>
            </div>
          </aside>

          <main className="min-w-0 px-4 py-4 md:px-8 min-[1180px]:px-6 2xl:px-10">
            <div className="mx-auto w-full max-w-[720px] 2xl:max-w-[900px]">
              {!isDetailMode ? (
                <div className="mb-4 flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {quickFilterItems.map((item) => {
                    const active =
                      (item.key === "latest" && quickView === "latest" && !filters.mine && !filters.favorites) ||
                      (item.key === quickView && item.key !== "favorites" && item.key !== "mine") ||
                      (item.key === "mine" && filters.mine) ||
                      (item.key === "favorites" && filters.favorites);
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => applyQuickFilter(item.key)}
                        className={`h-9 shrink-0 rounded-full px-3 text-sm font-semibold transition sm:px-4 ${
                          active ? "bg-[#111827] text-white" : "bg-[#f5f6fa] text-[#5f6b7a] hover:bg-[#eef3ff] hover:text-[#346cff]"
                        }`}
                      >
                        {item.mobileLabel ? (
                          <>
                            <span className="sm:hidden">{item.mobileLabel}</span>
                            <span className="hidden sm:inline">{item.label}</span>
                          </>
                        ) : (
                          item.label
                        )}
                      </button>
                    );
                  })}
                  <Select
                    value={filters.category}
                    options={boardCategoryOptions.map((item) => ({ label: formatCategoryLabel(item), value: item }))}
                    onChange={applyCategoryFilter}
                    popupMatchSelectWidth={false}
                    className="w-[78px] shrink-0 sm:w-[136px] [&_.ant-select-selector]:!rounded-full"
                  />
                </div>
              ) : null}

              {!isDetailMode ? (
                <section>
                  {selectedForumBoard ? (
                    <div className="mb-4 rounded-lg border border-[#e5e7eb] bg-white p-4 min-[1180px]:hidden">
                      <div className="flex items-center gap-3">
                        <Avatar
                          shape="square"
                          size={42}
                          src={resolveAssetUrl(selectedForumBoard.avatarUrl)}
                          className={`rounded-lg text-xs font-black ${selectedForumBoard.avatarUrl ? "" : getAvatarToneClass(selectedForumBoard.name)}`}
                        >
                          {getDisplayInitial(selectedForumBoard.name)}
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-base font-black text-[#111827]">{formatCategoryLabel(selectedForumBoard.name)}吧</div>
                          <div className="truncate text-xs text-[#8b95a5]">
                            {selectedForumBoard.ownerNickname ? `吧主：${selectedForumBoard.ownerNickname}` : "暂未设置吧主"}
                          </div>
                        </div>
                        <Button
                          size="small"
                          disabled={selectedBoardHasOwner || Boolean(selectedBoardPendingOwnerApplication)}
                          onClick={() => openOwnerApplication(selectedForumBoard)}
                        >
                          {selectedBoardOwnedByCurrentUser ? "已是吧主" : selectedBoardHasOwner ? "已有吧主" : selectedBoardPendingOwnerApplication ? "审核中" : "申请吧主"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <ForumSummaryPanel
                    cards={forumSummaryCards}
                    activeFilterLabels={activeFilterLabels}
                    hasActivePostFilters={hasActivePostFilters}
                    onResetFilters={resetForumFilters}
                  />
                  {forumHeroSummary ? <div className="mb-4 rounded-lg bg-[#f7f8fb] px-4 py-3 text-sm text-[#5f6b7a]">{forumHeroSummary}</div> : null}
                  {loading ? (
                    <ForumPostLoadingState showSlowWarning={postsLoadingSlow} onReload={() => void loadPosts(filters)} />
                  ) : displayPosts.length === 0 ? (
                    <ForumEmptyPostsState
                      title={emptyPostTitle}
                      description={emptyPostDescription}
                      hasActivePostFilters={hasActivePostFilters}
                      onResetFilters={resetForumFilters}
                      onCreatePost={openCreateModal}
                    />
                  ) : (
                    <div>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#8b95a5]">
                        <span>共显示 {formatCompactNumber(displayPosts.length)} 条主题</span>
                        {posts.length !== displayPosts.length ? <span>总主题 {formatCompactNumber(posts.length)} 条</span> : null}
                      </div>
                      {postListItems.map(({ post, barName, createdAtLabel, forumAvatarUrl, forumAvatarLabel, forumAvatarToneKey, imageMeta, previewText, previewTags }) => {
                        return (
                          <article key={post.id} className="border-b border-[#f0f2f5] pb-5 pt-1">
                            <div className="flex items-start gap-3">
                              <Avatar
                                shape="square"
                                size={44}
                                src={forumAvatarUrl}
                                className={`shrink-0 rounded-[10px] ${forumAvatarUrl ? "" : getAvatarToneClass(forumAvatarToneKey)}`}
                              >
                                {forumAvatarLabel}
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                  <button type="button" onClick={() => void openPost(post)} className="truncate text-sm font-black text-[#111827] hover:text-[#346cff]">
                                    {barName}
                                  </button>
                                  {post.pinned ? <span className="rounded bg-[#ffe6f0] px-1 py-0.5 text-[10px] font-black text-[#c0266b]">置顶</span> : null}
                                </div>
                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs font-semibold text-[#8b95a5]">
                                  <span className="max-w-[12rem] truncate">{post.author}</span>
                                  <span>{createdAtLabel}</span>
                                  <span className="rounded bg-[#ffe9dd] px-1 py-0.5 text-[10px] font-black text-[#f97316]">Lv.{post.authorLevel ?? 1}</span>
                                  {post.authorTitle ? <span className="rounded bg-[#fff3c4] px-1 py-0.5 text-[10px] font-black text-[#d97706]">{post.authorTitle}</span> : null}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => void openPost(post)}
                                  className="mt-3 block max-w-full text-left text-[16px] font-black leading-6 text-[#111827] hover:text-[#346cff]"
                                >
                                  {post.title}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void openPost(post)}
                                  className="mt-1 line-clamp-2 w-full text-left text-sm leading-6 text-[#111827] sm:line-clamp-3"
                                >
                                  {previewText}
                                </button>

                                <ForumPostImagePreview
                                  imageMeta={imageMeta}
                                  title={post.title}
                                  onOpen={() => void openPost(post)}
                                />

                                <ForumPostActionBar
                                  post={post}
                                  likeLoading={isPostActionLoading(post.id, "like")}
                                  favoriteLoading={isPostActionLoading(post.id, "favorite")}
                                  onOpen={() => void openPost(post)}
                                  onLike={() => void handleToggleLike(post.id)}
                                  onFavorite={() => void handleToggleFavorite(post.id)}
                                  onReport={() => openReportModal(post)}
                                />

                                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#8b95a5]">
                                  {previewTags.map((tag) => (
                                    <span key={tag}>#{tag}</span>
                                  ))}
                                  {(post.canPin ?? isAdmin) ? (
                                    <button
                                      type="button"
                                      disabled={isPostActionLoading(post.id, "pin")}
                                      onClick={() => void handleTogglePin(post.id, !post.pinned)}
                                      className="inline-flex items-center gap-1 hover:text-[#346cff] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <PushpinOutlined />
                                      {post.pinned ? "取消置顶" : "置顶"}
                                    </button>
                                  ) : null}
                                  {post.canEdit ? (
                                    <button type="button" onClick={() => openEditModal(post)} className="inline-flex items-center gap-1 hover:text-[#346cff]">
                                      <EditOutlined />
                                      编辑
                                    </button>
                                  ) : null}
                                  {(post.canDelete ?? post.canEdit) ? (
                                    <Popconfirm
                                      title="确认删除这篇帖子吗？"
                                      okButtonProps={{ loading: isPostActionLoading(post.id, "delete") }}
                                      onConfirm={() => void handleDeletePost(post.id)}
                                    >
                                      <button
                                        type="button"
                                        disabled={isPostActionLoading(post.id, "delete")}
                                        className="inline-flex items-center gap-1 hover:text-[#c2410c] disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <DeleteOutlined />
                                        删除
                                      </button>
                                    </Popconfirm>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                      {hasMorePosts ? (
                        <div className="flex justify-center pt-5">
                          <Button loading={loadingMorePosts} onClick={() => void loadPosts(filters, postPage + 1, true)}>
                            加载更多主题
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
              ) : activePost ? (
                <section>
                  <div className="mb-4 grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3">
                    <button
                      type="button"
                      aria-label="返回帖子列表"
                      onClick={closeDetailView}
                      className="grid h-11 w-11 place-items-center rounded-full bg-[#f5f6fb] text-2xl leading-none text-[#111827] hover:bg-[#eef3ff]"
                    >
                      <LeftOutlined />
                    </button>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        shape="square"
                        size={44}
                        src={activePostMeta?.authorAvatarUrl}
                        icon={<UserOutlined />}
                        className={`shrink-0 rounded-[10px] ${activePostMeta?.authorAvatarUrl ? "" : getAvatarToneClass(activePost.userId)}`}
                      >
                        {getDisplayInitial(activePost.author)}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-sm font-black">{activePost.author}</span>
                          <span className="rounded bg-[#ffe9dd] px-1 py-0.5 text-[10px] font-black text-[#f97316]">Lv.{activePost.authorLevel ?? 1}</span>
                          {activePost.authorTitle ? <span className="rounded bg-[#fff3c4] px-1 py-0.5 text-[10px] font-black text-[#d97706]">{activePost.authorTitle}</span> : null}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-[#8b95a5]">{activePostMeta?.fullTimeLabel}</div>
                      </div>
                    </div>
                    {detailLoading ? (
                      <Spin size="small" />
                    ) : (
                      <span className="hidden rounded-full bg-[#f5f6fb] px-3 py-1 text-xs font-bold text-[#5f6b7a] sm:inline-flex">
                        {activePostMeta?.categoryLabel}吧
                      </span>
                    )}
                  </div>

                  <article className="border-b border-[#f0f2f5] pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {activePost.pinned ? <Tag color="magenta">置顶</Tag> : null}
                      <Tag color="blue">{activePostMeta?.categoryLabel}</Tag>
                      {(activePost.tags ?? []).map((tag) => (
                        <Tag key={tag}>#{tag}</Tag>
                      ))}
                    </div>
                    <h1 className="mt-3 text-[21px] font-black leading-8 text-[#111827]">{activePost.title}</h1>
                    <div className="mt-2 text-sm leading-7 text-[#111827]">
                      {renderImageMarkupLines(activePost.content, {
                        alt: "论坛图片",
                        imageClassName: "my-3 max-h-[620px] max-w-full rounded-lg border border-[#e5e7eb] object-contain",
                        linkImages: true,
                      })}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm text-[#4b5563] sm:grid-cols-5">
                      <button type="button" onClick={() => void handleCopyPostLink(activePost.id)} className="text-left hover:text-[#346cff]">
                        <LinkOutlined /> 分享
                      </button>
                      <button type="button" onClick={() => replyForm.getFieldInstance("content")?.focus?.()} className="text-left hover:text-[#346cff]">
                        <MessageOutlined /> {formatCompactNumber(activePost.replyCount)}
                      </button>
                      <button
                        type="button"
                        disabled={isPostActionLoading(activePost.id, "like")}
                        onClick={() => void handleToggleLike(activePost.id)}
                        className={`text-left hover:text-[#346cff] disabled:cursor-not-allowed disabled:opacity-60 ${
                          activePost.likedByCurrentUser ? "text-[#346cff]" : ""
                        }`}
                      >
                        {activePost.likedByCurrentUser ? <LikeFilled /> : <LikeOutlined />} {formatCompactNumber(activePost.likeCount)}
                      </button>
                      <button
                        type="button"
                        disabled={isPostActionLoading(activePost.id, "favorite")}
                        onClick={() => void handleToggleFavorite(activePost.id)}
                        className={`text-left hover:text-[#d48806] disabled:cursor-not-allowed disabled:opacity-60 ${
                          activePost.favoritedByCurrentUser ? "text-[#d48806]" : ""
                        }`}
                      >
                        {activePost.favoritedByCurrentUser ? <StarFilled /> : <StarOutlined />} {formatCompactNumber(activePost.favoriteCount)}
                      </button>
                      {!(activePost.canDelete ?? activePost.canEdit) ? (
                        <button type="button" onClick={() => openReportModal(activePost)} className="text-left hover:text-[#c2410c]">
                          <WarningOutlined /> 举报
                        </button>
                      ) : null}
                      {activePost.canEdit ? (
                        <button type="button" onClick={() => openEditModal(activePost)} className="text-left hover:text-[#346cff]">
                          <EditOutlined /> 编辑
                        </button>
                      ) : null}
                      {(activePost.canPin ?? isAdmin) ? (
                        <button
                          type="button"
                          disabled={isPostActionLoading(activePost.id, "pin")}
                          onClick={() => void handleTogglePin(activePost.id, !activePost.pinned)}
                          className="text-left hover:text-[#346cff] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <PushpinOutlined /> {activePost.pinned ? "取消置顶" : "置顶"}
                        </button>
                      ) : null}
                      {(activePost.canDelete ?? activePost.canEdit) ? (
                        <Popconfirm
                          title="确认删除这篇帖子吗？"
                          okButtonProps={{ loading: isPostActionLoading(activePost.id, "delete") }}
                          onConfirm={() => void handleDeletePost(activePost.id)}
                        >
                          <button
                            type="button"
                            disabled={isPostActionLoading(activePost.id, "delete")}
                            className="text-left hover:text-[#c2410c] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <DeleteOutlined /> 删除
                          </button>
                        </Popconfirm>
                      ) : null}
                    </div>
                  </article>

                  <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-6 text-[15px] font-black">
                      <button
                        type="button"
                        onClick={() => setReplyFilter("all")}
                        className={`border-b-4 pb-2 transition ${
                          replyFilter === "all" ? "border-[#346cff] text-[#111827]" : "border-transparent text-[#8b95a5] hover:text-[#346cff]"
                        }`}
                      >
                        全部回复（{activePost.replyCount ?? replies.length}）
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyFilter("author")}
                        className={`border-b-4 pb-2 transition ${
                          replyFilter === "author" ? "border-[#346cff] text-[#111827]" : "border-transparent text-[#8b95a5] hover:text-[#346cff]"
                        }`}
                      >
                        只看楼主（{authorReplyCount}）
                      </button>
                    </div>
                    <div className="flex w-full rounded-full bg-[#f7f8fb] p-1 text-xs font-semibold text-[#8b95a5] sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setReplySort("latest")}
                        className={`flex-1 rounded-full px-3 py-1 transition sm:flex-none ${
                          replySort === "latest" ? "bg-white text-[#111827] shadow-sm" : "hover:text-[#346cff]"
                        }`}
                      >
                        最新
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplySort("earliest")}
                        className={`flex-1 rounded-full px-3 py-1 transition sm:flex-none ${
                          replySort === "earliest" ? "bg-white text-[#111827] shadow-sm" : "hover:text-[#346cff]"
                        }`}
                      >
                        正序
                      </button>
                    </div>
                  </div>

                  <Form form={replyForm} layout="vertical" className="mb-6" onFinish={(values) => void handleCreateReply(values)}>
                    <div className="grid grid-cols-[38px_minmax(0,1fr)] gap-3">
                      <Avatar
                        shape="square"
                        size={38}
                        src={resolveAssetUrl(user?.avatarUrl)}
                        icon={<UserOutlined />}
                        className={`rounded-[10px] ${user?.avatarUrl ? "" : getAvatarToneClass(user?.id)}`}
                      >
                        {getDisplayInitial(user?.nickname)}
                      </Avatar>
                      <div>
                        <Form.Item name="content" rules={[{ required: true, message: "请输入回复内容" }]} className="mb-2">
                          <Input.TextArea
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            placeholder={isAuthenticated ? `回复 ${activePost.author}` : "请先登录后回复"}
                            disabled={!isAuthenticated}
                            onPaste={handleReplyPaste}
                            className="rounded-2xl bg-[#f7f8fb]"
                          />
                        </Form.Item>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              ref={replyImageInputRef}
                              type="file"
                              accept={IMAGE_ACCEPT}
                              className="hidden"
                              style={{ display: "none" }}
                              onChange={handleReplyImageChange}
                            />
                            <Button
                              icon={<PictureOutlined />}
                              loading={uploadingReplyImage}
                              disabled={!isAuthenticated}
                              onClick={() => replyImageInputRef.current?.click()}
                            >
                              图片
                            </Button>
                            <Popover
                              trigger="click"
                              content={renderEmojiPanel(FORUM_EMOJIS, (emoji) => appendReplyContent(emoji), {
                                wrapperClassName: "grid w-[224px] grid-cols-6 gap-1 p-1",
                                itemClassName: "flex h-8 w-8 items-center justify-center rounded text-lg transition hover:bg-[#eef5ff]",
                              })}
                            >
                              <Button icon={<SmileOutlined />} disabled={!isAuthenticated}>表情</Button>
                            </Popover>
                          </div>
                          <Button type="primary" htmlType="submit" loading={savingReply} disabled={!isAuthenticated}>
                            {isAuthenticated ? "发表回复" : "请先登录"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Form>

                  {displayReplies.length === 0 ? (
                    <div className="py-10">
                      <Empty
                        description={replies.length === 0 ? "暂时还没有回复" : "楼主还没有参与回复"}
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {replyListItems.map(({ reply, authorAvatarUrl, createdAtLabel, floor, isAuthor }) => (
                        <article key={reply.id} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3">
                          <Avatar
                            shape="square"
                            size={42}
                            src={authorAvatarUrl}
                            icon={<UserOutlined />}
                            className={`rounded-[10px] ${authorAvatarUrl ? "" : getAvatarToneClass(reply.userId)}`}
                          >
                            {getDisplayInitial(reply.author)}
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 text-sm font-black text-[#4b5563]">
                              {reply.author}
                              <span className="rounded bg-[#ffe9dd] px-1 py-0.5 text-[10px] font-black text-[#f97316]">Lv.{reply.authorLevel ?? 1}</span>
                              {reply.authorTitle ? <span className="rounded bg-[#fff3c4] px-1 py-0.5 text-[10px] font-black text-[#d97706]">{reply.authorTitle}</span> : null}
                            </div>
                            <div className="mt-2 text-sm leading-7 text-[#111827]">
                              {renderImageMarkupLines(reply.content, {
                                alt: "论坛图片",
                                imageClassName: "my-2 max-h-[360px] max-w-full rounded-lg border border-[#e5e7eb] object-contain",
                                linkImages: true,
                              })}
                            </div>
                            <div className="mt-1 flex items-center justify-between text-xs text-[#8b95a5]">
                              <span>{createdAtLabel} {floor}楼</span>
                              {isAuthor ? <span className="font-bold text-[#346cff]">楼主</span> : null}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {hasMoreReplies ? (
                    <div className="flex justify-center pt-6">
                      <Button loading={loadingMoreReplies} onClick={() => void handleLoadMoreReplies()}>
                        加载更多回复
                      </Button>
                    </div>
                  ) : null}
                </section>
              ) : (
                <div className="flex justify-center py-20">
                  <Spin size="large" />
                </div>
              )}
            </div>
          </main>

          <aside className="hidden border-l border-[#edf0f5] min-[1180px]:block">
            <div className={`${FORUM_SIDE_PANEL_STICKY_CLASS} px-4 py-4 2xl:px-6`}>
              {!isDetailMode ? (
                <div>
                  <section className="mb-5 rounded-lg border border-[#e5e7eb] bg-white p-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#111827] text-sm font-black text-white">ID</span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-base font-black text-[#111827]">IDNCAR吧</div>
                        <div className="truncate text-xs text-[#8b95a5]">成员 {formatCompactNumber(forumStats.memberCount)} 帖子 {formatCompactNumber(posts.length)}</div>
                      </div>
                      <Button size="small" shape="round" loading={signingIn} disabled={isAuthenticated && signedToday} onClick={() => void handleSignIn()}>
                        {signedToday ? "已签" : "签到"}
                      </Button>
                    </div>
                    <p className="my-4 text-sm leading-7 text-[#4b5563]">围绕下载、工具、量化和产品体验的社区讨论，帖子按贴吧式信息流展示。</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs text-[#8b95a5]">
                      <div className="rounded-md bg-[#f7f8fb] px-2 py-2">
                        <div className="text-sm font-black text-[#111827]">{formatCompactNumber(posts.length)}</div>
                        <div>主题</div>
                      </div>
                      <div className="rounded-md bg-[#f7f8fb] px-2 py-2">
                        <div className="text-sm font-black text-[#111827]">{formatCompactNumber(forumStats.totalReplies)}</div>
                        <div>回复</div>
                      </div>
                      <div className="rounded-md bg-[#f7f8fb] px-2 py-2">
                        <div className="text-sm font-black text-[#111827]">{formatCompactNumber(forumStats.totalViews)}</div>
                        <div>浏览</div>
                      </div>
                    </div>
                  </section>

                  {selectedForumBoard ? (
                    <section className="mb-5 rounded-lg border border-[#e5e7eb] bg-white p-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          shape="square"
                          size={44}
                          src={resolveAssetUrl(selectedForumBoard.avatarUrl)}
                          className={`rounded-lg text-xs font-black ${selectedForumBoard.avatarUrl ? "" : getAvatarToneClass(selectedForumBoard.name)}`}
                        >
                          {getDisplayInitial(selectedForumBoard.name)}
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-base font-black text-[#111827]">{formatCategoryLabel(selectedForumBoard.name)}吧</div>
                          <div className="truncate text-xs text-[#8b95a5]">{selectedForumBoard.description || "暂无简介"}</div>
                        </div>
                      </div>
                      <div className="mt-4 rounded-md bg-[#f7f8fb] px-3 py-2">
                        <div className="text-xs font-bold text-[#8b95a5]">当前吧主</div>
                        {selectedForumBoard.ownerUserId ? (
                          <div className="mt-2 flex items-center gap-2">
                            <Avatar size={28} src={resolveAssetUrl(selectedForumBoard.ownerAvatarUrl)} icon={<UserOutlined />}>
                              {getDisplayInitial(selectedForumBoard.ownerNickname)}
                            </Avatar>
                            <span className="min-w-0 truncate text-sm font-black text-[#111827]">{selectedForumBoard.ownerNickname || "吧主"}</span>
                          </div>
                        ) : (
                          <div className="mt-1 text-sm text-[#6b7280]">暂未设置吧主</div>
                        )}
                      </div>
                      <Button
                        block
                        className="mt-3"
                        icon={<UserOutlined />}
                        disabled={selectedBoardHasOwner || Boolean(selectedBoardPendingOwnerApplication)}
                        onClick={() => openOwnerApplication(selectedForumBoard)}
                      >
                        {selectedBoardOwnedByCurrentUser ? "你已是吧主" : selectedBoardHasOwner ? "已有吧主" : selectedBoardPendingOwnerApplication ? "申请审核中" : "申请成为吧主"}
                      </Button>
                      {selectedBoardCanManageTitles ? (
                        <Button block className="mt-2" icon={<SettingOutlined />} onClick={() => openLevelTitleModal(selectedForumBoard)}>
                          头衔设置
                        </Button>
                      ) : null}
                    </section>
                  ) : null}

                  <section className="mb-5 rounded-lg border border-[#e5e7eb] bg-white p-4">
                    <h2 className="mb-4 text-[15px] font-black">最看料热点</h2>
                    <div className="space-y-3 text-sm">
                      {hotPosts.length === 0 ? (
                        <div className="text-[#8b95a5]">暂无热点帖子</div>
                      ) : (
                        hotPosts.slice(0, 5).map((post, index) => (
                          <button
                            key={`hot-${post.id}`}
                            type="button"
                            onClick={() => void openPost(post)}
                            className="grid w-full grid-cols-[20px_minmax(0,1fr)_24px] items-center gap-2 text-left"
                          >
                            <span className="font-black text-[#ff7a1a]">{index + 1}</span>
                            <span className="truncate text-[#374151]">{post.title}</span>
                            {index < 3 ? <span className="rounded bg-[#fff1db] px-1 py-0.5 text-center text-[10px] font-black text-[#ff7a1a]">热</span> : <span />}
                          </button>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="mb-5 rounded-lg border border-[#e5e7eb] bg-white p-4">
                    <h2 className="mb-4 flex items-center gap-2 text-[15px] font-black">
                      <TrophyOutlined />
                      {shouldShowTopAuthors ? "活跃吧友" : "推荐吧"}
                    </h2>
                    <div className="space-y-4">
                      {shouldShowTopAuthors ? (
                        topAuthors.slice(0, 4).map((author) => (
                          <div key={`author-${author.userId}`} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
                            <Avatar
                              shape="square"
                              size={34}
                              src={resolveAssetUrl(author.avatarUrl)}
                              icon={<UserOutlined />}
                              className={`rounded-lg ${author.avatarUrl ? "" : getAvatarToneClass(author.userId)}`}
                            >
                              {getDisplayInitial(author.author)}
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-black">{author.author}</div>
                              <div className="truncate text-xs text-[#8b95a5]">Lv.{author.level} / {author.experience} 经验</div>
                              <div className="mt-0.5 text-xs text-[#f97316]">发帖 {author.posts} 次</div>
                            </div>
                          </div>
                        ))
                      ) : (
                        frequentBars.slice(0, 4).map((item) => (
                          <div key={`forum-${item.label}`} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
                            <span className={`grid h-[34px] w-[34px] place-items-center rounded-lg text-xs font-black ${getAvatarToneClass(item.label)}`}>
                              {getDisplayInitial(item.label)}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-black">{item.label}吧</div>
                              <div className="truncate text-xs text-[#8b95a5]">社区分类</div>
                              <div className="mt-0.5 text-xs text-[#f97316]">主题 {formatCompactNumber(item.count)}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="mb-5 rounded-lg border border-[#e5e7eb] bg-white p-4">
                    <div className="flex items-center gap-3">
                      <Avatar size={46} src={resolveAssetUrl(user?.avatarUrl)} icon={<UserOutlined />}>
                        {getDisplayInitial(user?.nickname)}
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-black">{isAuthenticated ? user?.nickname : "游客"}</div>
                        <div className="mt-1 text-xs text-[#8b95a5]">{isAuthenticated ? profileTitle : "可浏览帖子，登录后参与互动"}</div>
                      </div>
                      {isAuthenticated ? <Tag color="gold">Lv.{currentLevel}</Tag> : null}
                    </div>
                    {isAuthenticated ? (
                      <>
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs text-[#8b95a5]">
                            <span>{selectedSignInBoardId ? "吧内经验" : "经验"} {currentExperience}</span>
                            <span>距下级 {Math.max(0, experienceToNextLevel)}</span>
                          </div>
                          <Progress percent={Number(levelProgress.toFixed(1))} showInfo={false} strokeColor="#346cff" className="mt-1" />
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
                          <div className="rounded bg-[#f7f8fb] px-3 py-2">
                            <div className="font-black">{signInDays}</div>
                            <div className="text-xs text-[#8b95a5]">{signInScopeLabel}连续</div>
                          </div>
                          <div className="rounded bg-[#f7f8fb] px-3 py-2">
                            <div className="font-black">{signedToday ? "已签" : "未签"}</div>
                            <div className="text-xs text-[#8b95a5]">今日状态</div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <Button
                        type="primary"
                        block
                        className="mt-4"
                        onClick={() => {
                          navigate("/login", {
                            state: {
                              from: `${location.pathname}${location.search}`,
                            },
                          });
                        }}
                      >
                        登录 / 注册
                      </Button>
                    )}
                  </section>

                  {shouldShowHotTags ? (
                    <section className="mb-5 rounded-lg border border-[#e5e7eb] bg-white p-4">
                      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-black">
                        <FireOutlined />
                        热门标签
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        {hotTags.map(([tag, count]) => (
                          <Tag key={tag} color="blue" className="px-2 py-1">
                            #{tag} · {count}
                          </Tag>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  <section className="mb-5 rounded-lg border border-[#e5e7eb] bg-white p-4">
                    <h2 className="mb-3 flex items-center gap-2 text-[15px] font-black">
                      <ThunderboltOutlined />
                      经验规则
                    </h2>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs text-[#8b95a5]">
                      <div className="rounded bg-[#f7f8fb] px-2 py-2">
                        <div>发帖</div>
                        <strong className="mt-1 block text-[#111827]">+{EXP_PER_POST}</strong>
                      </div>
                      <div className="rounded bg-[#f7f8fb] px-2 py-2">
                        <div>回复</div>
                        <strong className="mt-1 block text-[#111827]">+{EXP_PER_REPLY}</strong>
                      </div>
                      <div className="rounded bg-[#f7f8fb] px-2 py-2">
                        <div>点赞</div>
                        <strong className="mt-1 block text-[#111827]">+{EXP_PER_GIVE_LIKE}</strong>
                      </div>
                    </div>
                  </section>

                  {shouldShowSignInRank ? (
                    <RankingCard
                      icon={<ThunderboltOutlined />}
                      title={`${signInScopeLabel}签到`}
                      description="连续签到优先，经验值作为同分参考。"
                      loading={leaderboardLoading}
                      items={signInRank}
                      renderMeta={(item) => `${item.consecutiveSignInDays} 天 / Lv.${item.level} / ${item.experience} 经验`}
                    />
                  ) : null}
                </div>
              ) : activePost ? (
                <div>
                  <section className="mb-5 rounded-lg border border-[#e5e7eb] bg-white p-4">
                    <div className="grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3">
                      <span className="grid h-[42px] w-[42px] place-items-center rounded-lg bg-[#111827] text-xs font-black text-white">ID</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black">IDNCAR吧</div>
                        <div className="truncate text-xs text-[#8b95a5]">{activePostMeta?.categoryLabel} · {activePostMeta?.fullTimeLabel}</div>
                      </div>
                      <Button size="small" shape="round" loading={signingIn} disabled={isAuthenticated && signedToday} onClick={() => void handleSignIn()}>
                        {signedToday ? "已签" : "签到"}
                      </Button>
                    </div>
                    <p className="my-4 line-clamp-3 text-sm font-semibold leading-6 text-[#374151]">{activePost.title}</p>
                    <div className="mb-4 grid grid-cols-3 gap-2 text-center text-xs text-[#8b95a5]">
                      <div className="rounded-md bg-[#f7f8fb] px-2 py-2">
                        <div className="text-sm font-black text-[#111827]">{formatCompactNumber(activePost.replyCount)}</div>
                        <div>回复</div>
                      </div>
                      <div className="rounded-md bg-[#f7f8fb] px-2 py-2">
                        <div className="text-sm font-black text-[#111827]">{formatCompactNumber(activePost.likeCount)}</div>
                        <div>点赞</div>
                      </div>
                      <div className="rounded-md bg-[#f7f8fb] px-2 py-2">
                        <div className="text-sm font-black text-[#111827]">{formatCompactNumber(activePost.viewCount)}</div>
                        <div>浏览</div>
                      </div>
                    </div>
                    <Button block shape="round" onClick={closeDetailView}>
                      返回主题列表
                    </Button>
                  </section>

                  <section className="mb-5 rounded-lg border border-[#e5e7eb] bg-white p-4">
                    <h2 className="mb-1 text-[15px] font-black">继续看看</h2>
                    <div className="mb-4 text-xs font-semibold text-[#8b95a5]">优先推荐同标签、同分类和高互动主题</div>
                    <div className="space-y-4">
                      {recommendedPosts.length === 0 ? (
                        <div className="text-sm text-[#8b95a5]">暂无相关推荐</div>
                      ) : (
                        recommendationItems.map(({ post, reason, imageUrl, previewText }) => {
                          return (
                            <button key={`rec-${post.id}`} type="button" onClick={() => void openPost(post)} className="block w-full border-b border-[#f0f2f5] pb-4 text-left last:border-b-0 last:pb-0">
                              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                <Tag color="blue" className="!mr-0 max-w-full whitespace-normal break-all text-[11px]">{reason}</Tag>
                                {post.pinned ? <Tag color="magenta" className="!mr-0 text-[11px]">置顶</Tag> : null}
                              </div>
                              <div className="line-clamp-2 text-sm font-black leading-6 text-[#111827] hover:text-[#346cff]">{post.title}</div>
                              <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#6b7280]">{previewText}</div>
                              {imageUrl ? <img className="mt-2 h-24 w-full rounded-lg object-cover" src={imageUrl} alt="相关推荐图片" loading="lazy" /> : null}
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#8b95a5]">
                                <span className="truncate">{formatCategoryLabel(post.category)}</span>
                                <span>{formatCompactNumber(post.replyCount)}评 · {formatCompactNumber(post.likeCount)}赞</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </section>

                  {shouldShowActivityRank ? (
                    <RankingCard
                      icon={<FireOutlined />}
                      title="今日活跃"
                      description="按今日发帖、回复活跃度排序。"
                      loading={leaderboardLoading}
                      items={activityRank}
                      renderMeta={(item) => `${item.postCountToday} 帖 / ${item.replyCountToday} 回复 / ${item.activityScore} 分`}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        <Modal
          title={ownerApplicationTarget ? `申请成为 ${formatCategoryLabel(ownerApplicationTarget.name)}吧吧主` : "申请成为吧主"}
          open={ownerApplicationOpen}
          width="min(520px, calc(100vw - 24px))"
          onCancel={() => setOwnerApplicationOpen(false)}
          footer={null}
          rootClassName="[&_.ant-modal-body]:px-4 [&_.ant-modal-body]:pb-4 sm:[&_.ant-modal-body]:px-6 sm:[&_.ant-modal-body]:pb-6 [&_.ant-modal-header]:px-4 sm:[&_.ant-modal-header]:px-6"
          destroyOnHidden
        >
          <div className="mb-4 rounded-md bg-[#f7f8fb] px-4 py-3 text-sm leading-6 text-[#5f6b7a]">
            管理员会根据你的活跃度、申请理由和社区情况审核，通过后你会显示为该吧的吧主。
          </div>
          <Form<ForumBoardOwnerApplicationFormValues>
            form={ownerApplicationForm}
            layout="vertical"
            onFinish={(values) => void handleSubmitOwnerApplication(values)}
          >
            <Form.Item
              name="reason"
              label="申请理由"
              rules={[
                { required: true, whitespace: true, message: "请输入申请理由" },
                { max: 500, message: "申请理由不能超过 500 个字" },
              ]}
            >
              <Input.TextArea autoSize={{ minRows: 4, maxRows: 8 }} maxLength={500} showCount placeholder="说说你为什么适合管理这个吧" />
            </Form.Item>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => setOwnerApplicationOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submittingOwnerApplication}>
                提交申请
              </Button>
            </div>
          </Form>
        </Modal>

        <Modal
          title="管理吧"
          open={boardManagerOpen}
          width="min(920px, calc(100vw - 24px))"
          onCancel={() => setBoardManagerOpen(false)}
          footer={null}
          rootClassName="[&_.ant-modal-body]:px-4 [&_.ant-modal-body]:pb-4 sm:[&_.ant-modal-body]:px-6 sm:[&_.ant-modal-body]:pb-6 [&_.ant-modal-header]:px-4 sm:[&_.ant-modal-header]:px-6"
          destroyOnHidden
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-black text-[#111827]">吧列表</div>
                  <div className="mt-1 text-xs text-[#8b95a5]">停用后不会出现在发帖分类里。</div>
                </div>
                <Button size="small" icon={<PlusOutlined />} onClick={startCreateBoard}>
                  新建吧
                </Button>
              </div>
              <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                {forumBoards.map((board) => {
                  const boardName = formatCategoryLabel(board.name);
                  const boardAvatarUrl = resolveAssetUrl(board.avatarUrl);
                  return (
                    <div key={board.id ?? board.name} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-[#edf0f5] px-3 py-2">
                      <Avatar
                        shape="square"
                        size={40}
                        src={boardAvatarUrl}
                        className={`rounded-lg text-xs font-black ${boardAvatarUrl ? "" : getAvatarToneClass(boardName)}`}
                      >
                        {getDisplayInitial(boardName)}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-black text-[#111827]">{boardName}吧</span>
                          {board.active === false ? <Tag color="default" className="!mr-0 text-[11px]">停用</Tag> : <Tag color="green" className="!mr-0 text-[11px]">启用</Tag>}
                          <span className="text-xs font-semibold text-[#8b95a5]">排序 {board.sortOrder ?? 0}</span>
                        </div>
                        <div className="mt-1 truncate text-xs text-[#6b7280]">
                          {board.ownerNickname ? `吧主：${board.ownerNickname}` : "暂未设置吧主"} · {board.description || "暂无简介"}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button size="small" icon={<EditOutlined />} onClick={() => startEditBoard(board)}>
                          编辑
                        </Button>
                        <Button size="small" icon={<SettingOutlined />} onClick={() => openLevelTitleModal(board)}>
                          头衔
                        </Button>
                        <Button
                          size="small"
                          icon={board.active === false ? <PlusOutlined /> : <StopOutlined />}
                          onClick={() => void handleToggleBoardActive(board)}
                        >
                          {board.active === false ? "启用" : "停用"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 border-t border-[#edf0f5] pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-black text-[#111827]">吧主申请</div>
                    <div className="mt-1 text-xs text-[#8b95a5]">通过后申请人会成为对应吧的吧主。</div>
                  </div>
                  <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadBoardOwnerApplications()}>
                    刷新
                  </Button>
                </div>
                <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                  {boardOwnerApplications.length === 0 ? (
                    <div className="rounded-md bg-[#f7f8fb] px-3 py-4 text-center text-sm text-[#8b95a5]">暂无待审核申请</div>
                  ) : (
                    boardOwnerApplications.map((application) => {
                      const applicationBoard = forumBoardById.get(application.boardId);
                      const applicationBoardHasOwner = Boolean(applicationBoard?.ownerUserId);
                      return (
                        <div key={application.id} className="rounded-md border border-[#edf0f5] px-3 py-3">
                          <div className="flex items-start gap-3">
                            <Avatar
                              size={34}
                              src={resolveAssetUrl(application.applicantAvatarUrl)}
                              icon={<UserOutlined />}
                              className={application.applicantAvatarUrl ? "" : getAvatarToneClass(application.applicantId)}
                            >
                              {getDisplayInitial(application.applicantNickname)}
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                <span className="truncate text-sm font-black text-[#111827]">{application.applicantNickname || `用户 ${application.applicantId}`}</span>
                                <Tag color="blue" className="!mr-0 text-[11px]">{application.boardName ? formatCategoryLabel(application.boardName) : "未知"}吧</Tag>
                                {applicationBoardHasOwner ? <Tag color="default" className="!mr-0 text-[11px]">已有吧主</Tag> : null}
                              </div>
                              <div className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-[#6b7280]">{application.reason}</div>
                              <div className="mt-2 text-xs text-[#8b95a5]">{application.createTime}</div>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <Button
                              size="small"
                              loading={reviewingOwnerApplicationId === application.id}
                              onClick={() => void handleReviewOwnerApplication(application.id, false)}
                            >
                              拒绝
                            </Button>
                            <Button
                              size="small"
                              type="primary"
                              disabled={applicationBoardHasOwner}
                              loading={reviewingOwnerApplicationId === application.id}
                              onClick={() => void handleReviewOwnerApplication(application.id, true)}
                            >
                              {applicationBoardHasOwner ? "不可通过" : "通过"}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-md border border-[#edf0f5] bg-[#fbfcff] p-4">
              <div className="mb-3 text-sm font-black text-[#111827]">{editingBoard ? "编辑吧" : "创建新吧"}</div>
              <Form<ForumBoardFormValues> form={boardForm} layout="vertical" onFinish={(values) => void handleSaveBoard(values)}>
                <Form.Item
                  name="name"
                  label="吧名称"
                  rules={[
                    { required: true, whitespace: true, message: "请输入吧名称" },
                    { max: 40, message: "吧名称不能超过 40 个字" },
                  ]}
                >
                  <Input placeholder="例如：技术交流" />
                </Form.Item>
                <Form.Item name="description" label="简介" rules={[{ max: 200, message: "简介不能超过 200 个字" }]}>
                  <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} placeholder="这个吧主要讨论什么" />
                </Form.Item>
                <Form.Item name="avatarUrl" label="头像链接" rules={[{ max: 500, message: "头像链接不能超过 500 个字符" }]}>
                  <Input placeholder="可上传，也可以粘贴图片 URL" />
                </Form.Item>
                <div className="-mt-2 mb-4 flex items-center gap-3">
                  <Avatar
                    shape="square"
                    size={48}
                    src={resolveAssetUrl(watchedBoardAvatarUrl)}
                    className={`rounded-lg text-xs font-black ${watchedBoardAvatarUrl ? "" : getAvatarToneClass(boardForm.getFieldValue("name"))}`}
                  >
                    {getDisplayInitial(boardForm.getFieldValue("name"))}
                  </Avatar>
                  <input
                    ref={boardAvatarInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    className="hidden"
                    style={{ display: "none" }}
                    onChange={handleBoardAvatarChange}
                  />
                  <Button icon={<UploadOutlined />} loading={uploadingBoardAvatar} onClick={() => boardAvatarInputRef.current?.click()}>
                    上传头像
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Form.Item name="sortOrder" label="排序">
                    <InputNumber min={0} className="w-full" />
                  </Form.Item>
                  <Form.Item name="active" label="状态">
                    <Select
                      options={[
                        { label: "启用", value: true },
                        { label: "停用", value: false },
                      ]}
                    />
                  </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={startCreateBoard}>清空</Button>
                  <Button type="primary" htmlType="submit" loading={savingBoard}>
                    {editingBoard ? "保存吧" : "创建吧"}
                  </Button>
                </div>
              </Form>
            </section>
          </div>
        </Modal>

        <Modal
          title={levelTitleBoard ? `${formatCategoryLabel(levelTitleBoard.name)}吧头衔设置` : "头衔设置"}
          open={levelTitleModalOpen}
          width="min(560px, calc(100vw - 24px))"
          onCancel={() => setLevelTitleModalOpen(false)}
          okText="保存"
          cancelText="取消"
          confirmLoading={savingLevelTitles}
          onOk={() => void handleSaveLevelTitles()}
          rootClassName="[&_.ant-modal-body]:px-4 [&_.ant-modal-body]:pb-4 sm:[&_.ant-modal-body]:px-6 sm:[&_.ant-modal-body]:pb-6 [&_.ant-modal-header]:px-4 sm:[&_.ant-modal-header]:px-6"
          destroyOnHidden
        >
          <div className="space-y-2">
            {levelTitleRows.map((row, index) => (
              <div key={`${row.level}-${index}`} className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-2">
                <InputNumber
                  min={1}
                  max={100}
                  value={row.level}
                  className="w-full"
                  onChange={(value) => updateLevelTitleRow(index, { level: Number(value) || 1 })}
                />
                <Input
                  maxLength={20}
                  value={row.title}
                  placeholder="例如：核心吧友"
                  onChange={(event) => updateLevelTitleRow(index, { title: event.target.value })}
                />
                <Button icon={<DeleteOutlined />} onClick={() => removeLevelTitleRow(index)} />
              </div>
            ))}
          </div>
          <Button block className="mt-3" icon={<PlusOutlined />} onClick={addLevelTitleRow}>
            添加头衔
          </Button>
        </Modal>

        <Modal
          title={<span className="block max-w-[72vw] truncate sm:max-w-none">{editingPost ? "编辑帖子" : "发布新帖"}</span>}
          open={editorOpen}
          width="min(760px, calc(100vw - 24px))"
          onCancel={() => setEditorOpen(false)}
          footer={null}
          rootClassName="[&_.ant-modal-body]:px-4 [&_.ant-modal-body]:pb-4 sm:[&_.ant-modal-body]:px-6 sm:[&_.ant-modal-body]:pb-6 [&_.ant-modal-header]:px-4 sm:[&_.ant-modal-header]:px-6"
          destroyOnHidden
        >
          <Form<PostFormValues> form={postForm} layout="vertical" onFinish={(values) => void handleSavePost(values)}>
            <div className="mb-4 rounded-lg border border-[#edf0f5] bg-[#fbfcff] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#111827]">
                <span>{editingPost ? "正在编辑主题" : "发布新主题"}</span>
                <Tag color="blue" className="!mr-0">发帖 +{EXP_PER_POST}</Tag>
              </div>
              <div className="mt-1 text-xs leading-5 text-[#6b7280]">标题、分类、正文是必填项，标签最多保留 {POST_TAG_MAX_COUNT} 个。</div>
            </div>

            <Form.Item
              name="title"
              label="标题"
              rules={[
                { required: true, whitespace: true, message: "请输入标题" },
                { max: POST_TITLE_MAX_LENGTH, message: `标题不能超过 ${POST_TITLE_MAX_LENGTH} 个字` },
              ]}
            >
              <Input size="large" maxLength={POST_TITLE_MAX_LENGTH} showCount placeholder="用一句话说明这篇主题" />
            </Form.Item>
            <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
              <Form.Item name="category" label="分类" rules={[{ required: true, message: "请选择分类" }]}>
                <Select options={activeForumBoards.map((board) => ({ label: formatCategoryLabel(board.name), value: board.name }))} />
              </Form.Item>
              <Form.Item name="tagsText" label="标签">
                <Input maxLength={80} placeholder="标签之间用逗号分隔" />
              </Form.Item>
            </div>
            <div className="-mt-2 mb-4 flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
              <span className="font-semibold text-[#8b95a5]">标签预览</span>
              {editorPreviewTags.length === 0 ? (
                <span>未添加标签</span>
              ) : (
                editorPreviewTags.map((tag) => (
                  <Tag key={tag} color="blue" className="!mr-0 max-w-full whitespace-normal break-all">
                    #{tag}
                  </Tag>
                ))
              )}
              {editorDroppedTagCount > 0 ? <span className="font-semibold text-[#d97706]">还有 {editorDroppedTagCount} 个不会保存</span> : null}
            </div>

            <Form.Item
              name="content"
              label="内容"
              rules={[
                { required: true, whitespace: true, message: "请输入帖子内容" },
                { max: POST_CONTENT_MAX_LENGTH, message: `正文不能超过 ${POST_CONTENT_MAX_LENGTH} 个字` },
              ]}
            >
              <Input.TextArea
                autoSize={{ minRows: 7, maxRows: 14 }}
                maxLength={POST_CONTENT_MAX_LENGTH}
                showCount
                placeholder="写下问题、经验或反馈细节"
                onPaste={handlePostPaste}
              />
            </Form.Item>
            <div className="-mt-3 mb-4 flex flex-col gap-3 rounded-lg bg-[#f7f8fb] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                ref={postImageInputRef}
                type="file"
                accept={IMAGE_ACCEPT}
                className="hidden"
                style={{ display: "none" }}
                onChange={handlePostImageChange}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  icon={<PictureOutlined />}
                  loading={uploadingPostImage}
                  onClick={() => postImageInputRef.current?.click()}
                >
                  图片
                </Button>
                <Popover
                  trigger="click"
                  content={renderEmojiPanel(FORUM_EMOJIS, (emoji) => appendPostContent(emoji), {
                    wrapperClassName: "grid w-[224px] grid-cols-6 gap-1 p-1",
                    itemClassName: "flex h-8 w-8 items-center justify-center rounded text-lg transition hover:bg-[#eef5ff]",
                  })}
                >
                  <Button icon={<SmileOutlined />}>表情</Button>
                </Popover>
              </div>
              <span className="text-xs font-semibold text-[#8b95a5]">正文素材</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button className="w-full sm:w-auto" onClick={() => setEditorOpen(false)}>取消</Button>
              <Button className="w-full sm:w-auto" type="primary" htmlType="submit" loading={savingPost}>
                {editingPost ? "保存修改" : "发布帖子"}
              </Button>
            </div>
          </Form>
        </Modal>

        <Modal
          title={<span className="block max-w-[72vw] truncate sm:max-w-none">{reportTarget ? `举报帖子：${reportTarget.title}` : "举报帖子"}</span>}
          open={reportModalOpen}
          width="min(520px, calc(100vw - 24px))"
          onCancel={() => setReportModalOpen(false)}
          footer={null}
          rootClassName="[&_.ant-modal-body]:px-4 [&_.ant-modal-body]:pb-4 sm:[&_.ant-modal-body]:px-6 sm:[&_.ant-modal-body]:pb-6 [&_.ant-modal-header]:px-4 sm:[&_.ant-modal-header]:px-6"
          destroyOnHidden
        >
          <Form<ReportFormValues> form={reportForm} layout="vertical" onFinish={(values) => void handleSubmitReport(values)}>
            <Form.Item name="reason" label="举报原因" rules={[{ required: true, message: "请选择举报原因" }]}>
              <Select placeholder="选择最接近的问题" options={reportReasonOptions} />
            </Form.Item>
            <Form.Item name="detail" label="补充说明">
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} maxLength={300} showCount placeholder="可补充具体情况，方便管理员处理" />
            </Form.Item>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button className="w-full sm:w-auto" onClick={() => setReportModalOpen(false)}>取消</Button>
              <Button className="w-full sm:w-auto" type="primary" htmlType="submit" loading={reporting}>
                提交举报
              </Button>
            </div>
          </Form>
        </Modal>

        <Modal
          title="登录后继续互动"
          open={Boolean(loginPromptAction)}
          width="min(420px, calc(100vw - 24px))"
          onCancel={closeLoginPrompt}
          footer={null}
          rootClassName="[&_.ant-modal-body]:px-4 [&_.ant-modal-body]:pb-4 sm:[&_.ant-modal-body]:px-6 sm:[&_.ant-modal-body]:pb-6 [&_.ant-modal-header]:px-4 sm:[&_.ant-modal-header]:px-6"
          destroyOnHidden
        >
          <div className="text-center sm:text-left">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eef5ff] text-xl text-[#2b72c9] sm:mx-0">
              <UserOutlined />
            </div>
            <div className="mt-4 text-base font-semibold text-[#1f2d3d]">
              {loginPromptAction ? `登录后可以${loginPromptAction}` : "登录后可以参与论坛互动"}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-500">登录或注册账号后，会自动回到当前论坛页面。</div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button block onClick={closeLoginPrompt}>
                继续浏览
              </Button>
              <Button block type="primary" onClick={goLoginFromForum}>
                登录 / 注册
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}

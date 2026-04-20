import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Avatar,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  message,
} from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FilterOutlined,
  LikeFilled,
  LikeOutlined,
  MessageOutlined,
  PlusOutlined,
  PushpinOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined,
  UserOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../context/useAuth";
import { resolveAssetUrl } from "../lib/media";
import { forumApi } from "../services/api";
import type { CreatePostPayload, CreatePostReportPayload, Post, Reply } from "../types/app";

interface PostFormValues extends CreatePostPayload {
  tagsText?: string;
}

type ReportFormValues = CreatePostReportPayload;
type QuickView = "latest" | "popular" | "pinned";

const categoryOptions = ["全部", "综合交流", "使用求助", "下载反馈", "功能建议", "BUG 反馈"];
const quickFilterItems: Array<{ key: QuickView | "mine" | "favorites"; label: string }> = [
  { key: "latest", label: "最新发布" },
  { key: "popular", label: "最多点赞" },
  { key: "pinned", label: "只看置顶" },
  { key: "favorites", label: "我的收藏" },
  { key: "mine", label: "我的帖子" },
];

function getFriendlyMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  const text = error.message.trim();
  return /[\u4e00-\u9fa5]/.test(text) ? text : fallback;
}

function parseTags(tagsText?: string) {
  if (!tagsText) {
    return [];
  }
  return tagsText
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export default function Forum() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [savingReply, setSavingReply] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [reportTarget, setReportTarget] = useState<Post | null>(null);
  const [queryPostHandled, setQueryPostHandled] = useState<number | null>(null);
  const [highlightReplyId, setHighlightReplyId] = useState<number | null>(null);
  const [keywordInput, setKeywordInput] = useState("");
  const [quickView, setQuickView] = useState<QuickView>("latest");
  const [filters, setFilters] = useState<{ keyword?: string; category?: string; mine?: boolean; favorites?: boolean }>({
    category: "全部",
    mine: false,
    favorites: false,
  });
  const [postForm] = Form.useForm<PostFormValues>();
  const [replyForm] = Form.useForm<{ content: string }>();
  const [reportForm] = Form.useForm<ReportFormValues>();

  const loadPosts = useCallback(async (currentFilters = filters) => {
    setLoading(true);
    try {
      const data = await forumApi.getPosts({
        keyword: currentFilters.keyword,
        category: currentFilters.category === "全部" ? undefined : currentFilters.category,
        mine: currentFilters.mine,
        favorites: currentFilters.favorites,
      });
      setPosts(data);
    } catch (error) {
      message.error(getFriendlyMessage(error, "加载帖子失败"));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadPosts(filters);
  }, [filters, loadPosts]);

  useEffect(() => {
    const view = searchParams.get("view");
    const nextMine = view === "mine";
    const nextFavorites = view === "favorites";
    const nextQuickView: QuickView = view === "popular" || view === "pinned" ? view : "latest";

    setQuickView((current) => (current === nextQuickView ? current : nextQuickView));
    setFilters((current) => {
      if (current.mine === nextMine && current.favorites === nextFavorites) {
        return current;
      }
      return { ...current, mine: nextMine, favorites: nextFavorites };
    });
  }, [searchParams]);

  const updateSearchParams = useCallback((updater: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams);
    updater(nextParams);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const openPost = useCallback(async (post: Post, syncQuery = true) => {
    setQueryPostHandled(post.id);
    if (syncQuery) {
      updateSearchParams((params) => {
        params.set("post", String(post.id));
        params.delete("reply");
      });
    }
    setDetailOpen(true);
    setDrawerLoading(true);
    try {
      const [detail, replyList] = await Promise.all([forumApi.getPost(post.id), forumApi.getReplies(post.id)]);
      setActivePost(detail);
      setReplies(replyList);
      setPosts((current) => current.map((item) => (item.id === detail.id ? detail : item)));
    } catch (error) {
      message.error(getFriendlyMessage(error, "加载帖子详情失败"));
    } finally {
      setDrawerLoading(false);
    }
  }, [updateSearchParams]);

  useEffect(() => {
    const postId = Number(searchParams.get("post"));
    if (!postId) {
      setQueryPostHandled(null);
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
  }, [loading, openPost, posts, queryPostHandled, searchParams]);

  useEffect(() => {
    const replyId = Number(searchParams.get("reply"));
    const postId = Number(searchParams.get("post"));

    if (!detailOpen || !activePost || !replyId || !postId || activePost.id !== postId || replies.length === 0) {
      return;
    }

    const targetReply = replies.find((item) => item.id === replyId);
    if (!targetReply) {
      return;
    }

    setHighlightReplyId(replyId);
    window.setTimeout(() => {
      const element = document.getElementById(`forum-reply-${replyId}`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    const timer = window.setTimeout(() => {
      setHighlightReplyId((current) => (current === replyId ? null : current));
    }, 2600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activePost, detailOpen, replies, searchParams]);

  function closeDetailDrawer() {
    setDetailOpen(false);
    setHighlightReplyId(null);
    updateSearchParams((params) => {
      params.delete("post");
      params.delete("reply");
    });
  }

  async function handleCopyReplyLink(replyId: number) {
    if (!activePost) {
      return;
    }

    try {
      const params = new URLSearchParams(searchParams);
      params.set("post", String(activePost.id));
      params.set("reply", String(replyId));
      const url = `${window.location.origin}/forum?${params.toString()}`;
      await navigator.clipboard.writeText(url);
      message.success("回复链接已复制");
    } catch {
      message.error("复制回复链接失败");
    }
  }

  function applyFilters(next: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  function handleSearch() {
    applyFilters({ keyword: keywordInput.trim() || undefined });
  }

  function openCreateModal() {
    setEditingPost(null);
    postForm.resetFields();
    postForm.setFieldsValue({ category: "综合交流", tagsText: "" });
    setEditorOpen(true);
  }

  function openEditModal(post: Post) {
    setEditingPost(post);
    postForm.setFieldsValue({
      title: post.title,
      content: post.content,
      category: post.category || "综合交流",
      tagsText: (post.tags ?? []).join(", "),
    });
    setEditorOpen(true);
  }

  async function handleSavePost(values: PostFormValues) {
    setSavingPost(true);
    try {
      const payload: CreatePostPayload = {
        title: values.title,
        content: values.content,
        category: values.category,
        tags: parseTags(values.tagsText),
      };

      const saved = editingPost
        ? await forumApi.updatePost(editingPost.id, payload)
        : await forumApi.createPost(payload);

      setPosts((current) => {
        if (editingPost) {
          return current.map((item) => (item.id === saved.id ? saved : item));
        }
        return [saved, ...current];
      });

      if (activePost?.id === saved.id) {
        setActivePost(saved);
      }

      setEditorOpen(false);
      postForm.resetFields();
      message.success(editingPost ? "帖子已更新" : "帖子已发布");
      void loadPosts();
    } catch (error) {
      message.error(getFriendlyMessage(error, "保存帖子失败"));
    } finally {
      setSavingPost(false);
    }
  }

  async function handleDeletePost(postId: number) {
    try {
      await forumApi.deletePost(postId);
      setPosts((current) => current.filter((item) => item.id !== postId));
      if (activePost?.id === postId) {
        setDetailOpen(false);
        setActivePost(null);
      }
      message.success("帖子已删除");
    } catch (error) {
      message.error(getFriendlyMessage(error, "删除帖子失败"));
    }
  }

  async function handleToggleLike(postId: number) {
    try {
      const updated = await forumApi.toggleLike(postId);
      setPosts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (activePost?.id === updated.id) {
        setActivePost(updated);
      }
    } catch (error) {
      message.error(getFriendlyMessage(error, "点赞失败"));
    }
  }

  async function handleToggleFavorite(postId: number) {
    try {
      const updated = await forumApi.toggleFavorite(postId);
      setPosts((current) => {
        if (filters.favorites && !updated.favoritedByCurrentUser) {
          return current.filter((item) => item.id !== updated.id);
        }
        return current.map((item) => (item.id === updated.id ? updated : item));
      });
      if (activePost?.id === updated.id) {
        setActivePost(updated);
      }
      message.success(updated.favoritedByCurrentUser ? "已加入收藏" : "已取消收藏");
    } catch (error) {
      message.error(getFriendlyMessage(error, "收藏操作失败"));
    }
  }

  async function handleTogglePin(postId: number, pinned: boolean) {
    try {
      const updated = await forumApi.updatePin(postId, pinned);
      setPosts((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createTime).getTime() - new Date(a.createTime).getTime()),
      );
      if (activePost?.id === updated.id) {
        setActivePost(updated);
      }
      message.success(pinned ? "帖子已置顶" : "帖子已取消置顶");
    } catch (error) {
      message.error(getFriendlyMessage(error, "置顶操作失败"));
    }
  }

  async function handleCreateReply(values: { content: string }) {
    if (!activePost) {
      return;
    }
    setSavingReply(true);
    try {
      const reply = await forumApi.createReply(activePost.id, values);
      setReplies((current) => [reply, ...current]);
      replyForm.resetFields();
      setHighlightReplyId(reply.id);
      message.success("回复成功");
    } catch (error) {
      message.error(getFriendlyMessage(error, "回复失败"));
    } finally {
      setSavingReply(false);
    }
  }

  function openReportModal(post: Post) {
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
      return nextPosts.sort((a, b) => b.likeCount - a.likeCount || new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    }
    if (quickView === "pinned") {
      return nextPosts.filter((item) => item.pinned).sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    }
    return nextPosts.sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
  }, [posts, quickView]);
  const highlightPosts = useMemo(() => displayPosts.slice(0, 3), [displayPosts]);

  function applyQuickFilter(key: QuickView | "mine" | "favorites") {
    if (key === "mine") {
      updateSearchParams((params) => {
        params.set("view", "mine");
        params.delete("post");
      });
      return;
    }
    if (key === "favorites") {
      updateSearchParams((params) => {
        params.set("view", "favorites");
        params.delete("post");
      });
      return;
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

  return (
    <MainLayout>
      <div className="space-y-8 py-10">
        <section className="rounded-[32px] border border-slate-100 bg-white/90 px-8 py-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <Tag color="blue">论坛交流</Tag>
              <h1 className="text-3xl font-semibold text-slate-900">搜索、分类和内容反馈都已经接进论坛里了</h1>
              <p className="max-w-3xl leading-8 text-slate-600">
                现在可以按关键词搜索、按分类筛选、只看我的帖子，也可以对不合适的内容发起举报。下一步会继续补通知和内容审核能力。
              </p>
            </div>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreateModal}>
              发布帖子
            </Button>
          </div>
        </section>

        <Card className="rounded-[24px] border-slate-100 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            {quickFilterItems.map((item) => {
              const active =
                (item.key === "mine" && Boolean(filters.mine)) ||
                (item.key === "favorites" && Boolean(filters.favorites)) ||
                (!filters.mine && !filters.favorites && item.key === quickView);
              return (
                <Button
                  key={item.key}
                  type={active ? "primary" : "default"}
                  onClick={() => applyQuickFilter(item.key)}
                  className={active ? "rounded-full border-none bg-[#2a6df4]" : "rounded-full border-slate-200 bg-white"}
                >
                  {item.label}
                </Button>
              );
            })}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_160px]">
            <Input
              size="large"
              prefix={<SearchOutlined />}
              placeholder="搜索标题、内容或标签"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onPressEnter={handleSearch}
            />
            <Select
              size="large"
              value={filters.category}
              options={categoryOptions.map((item) => ({ label: item, value: item }))}
              onChange={(value) => applyFilters({ category: value })}
            />
            <Button size="large" icon={<FilterOutlined />} onClick={handleSearch}>
              搜索
            </Button>
          </div>

          {isAuthenticated ? (
            <div className="mt-4 flex flex-wrap items-center gap-5 text-sm text-slate-500">
              <div className="flex items-center gap-3">
                <Switch
                  checked={Boolean(filters.mine)}
                  onChange={(checked) => applyFilters({ mine: checked, favorites: checked ? false : filters.favorites })}
                />
                只看我的帖子
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={Boolean(filters.favorites)}
                  onChange={(checked) => applyFilters({ favorites: checked, mine: checked ? false : filters.mine })}
                />
                只看我的收藏
              </div>
            </div>
          ) : null}
        </Card>

        {highlightPosts.length > 0 && (
          <section className="grid gap-4 md:grid-cols-3">
            {highlightPosts.map((post) => (
              <Card key={post.id} className="rounded-[24px] border-slate-100 shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar src={resolveAssetUrl(post.authorAvatarUrl)} icon={<UserOutlined />}>
                      {post.author?.[0]}
                    </Avatar>
                    <div>
                      <div className="font-medium text-slate-900">{post.author}</div>
                      <div className="text-xs text-slate-500">{post.createTime}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {post.pinned ? <Tag color="gold">置顶</Tag> : null}
                    <Tag color="blue">{post.category || "综合交流"}</Tag>
                    {(post.tags ?? []).slice(0, 2).map((tag) => (
                      <Tag key={tag}>#{tag}</Tag>
                    ))}
                  </div>
                  <div className="line-clamp-2 text-lg font-semibold text-slate-900">{post.title}</div>
                  <div className="line-clamp-3 min-h-[72px] text-slate-600">{post.content}</div>
                  <Button type="link" onClick={() => void openPost(post)} className="px-0">
                    查看详情
                  </Button>
                </div>
              </Card>
            ))}
          </section>
        )}

        <section>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spin size="large" />
            </div>
          ) : displayPosts.length === 0 ? (
            <Empty description="当前筛选条件下还没有帖子。" />
          ) : (
            <List
              grid={{ gutter: 20, xs: 1, lg: 2 }}
              dataSource={displayPosts}
              renderItem={(post) => (
                <List.Item>
                  <Card hoverable className="h-full rounded-[24px] border-slate-100 shadow-sm" onClick={() => void openPost(post)}>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar src={resolveAssetUrl(post.authorAvatarUrl)} icon={<UserOutlined />}>
                            {post.author?.[0]}
                          </Avatar>
                          <div>
                            <div className="font-medium text-slate-900">{post.author}</div>
                            <div className="text-xs text-slate-500">{post.createTime}</div>
                          </div>
                        </div>
                        {post.canEdit ? <Tag color="purple">可管理</Tag> : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Tag color="blue">{post.category || "综合交流"}</Tag>
                        {(post.tags ?? []).map((tag) => (
                          <Tag key={tag}>#{tag}</Tag>
                        ))}
                      </div>

                      <div>
                        <div className="mb-2 text-xl font-semibold text-slate-900">{post.title}</div>
                        <p className="line-clamp-3 leading-7 text-slate-600">{post.content}</p>
                      </div>

                      <div className="flex items-center justify-between">
                        <Space size={16} className="text-slate-500">
                          <span className="flex items-center gap-1">
                            <EyeOutlined /> {post.viewCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <LikeOutlined /> {post.likeCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <StarOutlined /> {post.favoriteCount}
                          </span>
                        </Space>
                        <Space>
                          <Button
                            icon={post.favoritedByCurrentUser ? <StarFilled /> : <StarOutlined />}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleToggleFavorite(post.id);
                            }}
                          >
                            {post.favoritedByCurrentUser ? "已收藏" : "收藏"}
                          </Button>
                          <Button
                            type={post.likedByCurrentUser ? "primary" : "default"}
                            icon={post.likedByCurrentUser ? <LikeFilled /> : <LikeOutlined />}
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleToggleLike(post.id);
                            }}
                          >
                            {post.likedByCurrentUser ? "已点赞" : "点赞"}
                          </Button>
                          {!post.canEdit ? (
                            <Button
                              icon={<WarningOutlined />}
                              onClick={(event) => {
                                event.stopPropagation();
                                openReportModal(post);
                              }}
                            >
                              举报
                            </Button>
                          ) : null}
                          {isAdmin ? (
                            <Button
                              icon={<PushpinOutlined />}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleTogglePin(post.id, !post.pinned);
                              }}
                            >
                              {post.pinned ? "取消置顶" : "置顶"}
                            </Button>
                          ) : null}
                          {post.canEdit ? (
                            <>
                              <Button
                                icon={<EditOutlined />}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditModal(post);
                                }}
                              >
                                编辑
                              </Button>
                              <Popconfirm title="确定删除这条帖子吗？" onConfirm={() => void handleDeletePost(post.id)}>
                                <Button danger icon={<DeleteOutlined />} onClick={(event) => event.stopPropagation()}>
                                  删除
                                </Button>
                              </Popconfirm>
                            </>
                          ) : null}
                        </Space>
                      </div>
                    </div>
                  </Card>
                </List.Item>
              )}
            />
          )}
        </section>

        <Modal
          title={editingPost ? "编辑帖子" : "发布帖子"}
          open={editorOpen}
          onCancel={() => setEditorOpen(false)}
          footer={null}
          destroyOnClose
        >
          <Form<PostFormValues> form={postForm} layout="vertical" onFinish={(values) => void handleSavePost(values)}>
            <Form.Item name="title" label="标题" rules={[{ required: true, message: "请输入标题" }]}>
              <Input placeholder="这篇帖子要聊什么？" />
            </Form.Item>
            <Form.Item name="category" label="分类" rules={[{ required: true, message: "请选择分类" }]}>
              <Select options={categoryOptions.filter((item) => item !== "全部").map((item) => ({ label: item, value: item }))} />
            </Form.Item>
            <Form.Item name="tagsText" label="标签">
              <Input placeholder="多个标签请用逗号分隔，最多 5 个" />
            </Form.Item>
            <Form.Item name="content" label="内容" rules={[{ required: true, message: "请输入内容" }]}>
              <Input.TextArea rows={8} placeholder="写下你的想法、经验或者问题" />
            </Form.Item>
            <Space>
              <Button onClick={() => setEditorOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={savingPost}>
                {editingPost ? "保存修改" : "发布帖子"}
              </Button>
            </Space>
          </Form>
        </Modal>

        <Modal
          title={reportTarget ? `举报帖子：${reportTarget.title}` : "举报帖子"}
          open={reportModalOpen}
          onCancel={() => setReportModalOpen(false)}
          footer={null}
          destroyOnClose
        >
          <Form<ReportFormValues> form={reportForm} layout="vertical" onFinish={(values) => void handleSubmitReport(values)}>
            <Form.Item name="reason" label="举报原因" rules={[{ required: true, message: "请选择或填写举报原因" }]}>
              <Select
                options={[
                  { label: "垃圾广告", value: "垃圾广告" },
                  { label: "内容违规", value: "内容违规" },
                  { label: "恶意攻击", value: "恶意攻击" },
                  { label: "重复灌水", value: "重复灌水" },
                  { label: "其他问题", value: "其他问题" },
                ]}
              />
            </Form.Item>
            <Form.Item name="detail" label="补充说明">
              <Input.TextArea rows={4} maxLength={300} placeholder="可以补充具体原因，方便后续处理" />
            </Form.Item>
            <Space>
              <Button onClick={() => setReportModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={reporting}>
                提交举报
              </Button>
            </Space>
          </Form>
        </Modal>

        <Drawer title={activePost?.title ?? "帖子详情"} placement="right" width={720} open={detailOpen} onClose={closeDetailDrawer}>
          {drawerLoading || !activePost ? (
            <div className="flex items-center justify-center py-20">
              <Spin size="large" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Avatar src={resolveAssetUrl(activePost.authorAvatarUrl)} icon={<UserOutlined />}>
                  {activePost.author?.[0]}
                </Avatar>
                <div>
                  <div className="font-medium text-slate-900">{activePost.author}</div>
                  <div className="text-sm text-slate-500">{activePost.createTime}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {activePost.pinned ? <Tag color="gold">置顶帖</Tag> : null}
                <Tag color="blue">{activePost.category || "综合交流"}</Tag>
                {(activePost.tags ?? []).map((tag) => (
                  <Tag key={tag}>#{tag}</Tag>
                ))}
              </div>

              <div className="whitespace-pre-wrap rounded-[24px] bg-slate-50 p-5 leading-8 text-slate-700">{activePost.content}</div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Space size={16}>
                  <span className="flex items-center gap-1 text-slate-500">
                    <EyeOutlined /> {activePost.viewCount}
                  </span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <LikeOutlined /> {activePost.likeCount}
                  </span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <StarOutlined /> {activePost.favoriteCount}
                  </span>
                </Space>
                <Space>
                  <Button
                    icon={activePost.favoritedByCurrentUser ? <StarFilled /> : <StarOutlined />}
                    onClick={() => void handleToggleFavorite(activePost.id)}
                  >
                    {activePost.favoritedByCurrentUser ? "已收藏" : "收藏"}
                  </Button>
                  <Button
                    type={activePost.likedByCurrentUser ? "primary" : "default"}
                    icon={activePost.likedByCurrentUser ? <LikeFilled /> : <LikeOutlined />}
                    onClick={() => void handleToggleLike(activePost.id)}
                  >
                    {activePost.likedByCurrentUser ? "取消点赞" : "点赞"}
                  </Button>
                  {!activePost.canEdit ? (
                    <Button
                      icon={<WarningOutlined />}
                      onClick={() => {
                        openReportModal(activePost);
                      }}
                    >
                      举报帖子
                    </Button>
                  ) : null}
                  {activePost.canEdit ? (
                    <Button icon={<EditOutlined />} onClick={() => openEditModal(activePost)}>
                      编辑帖子
                    </Button>
                  ) : null}
                  {isAdmin ? (
                    <Button icon={<PushpinOutlined />} onClick={() => void handleTogglePin(activePost.id, !activePost.pinned)}>
                      {activePost.pinned ? "取消置顶" : "置顶帖子"}
                    </Button>
                  ) : null}
                </Space>
              </div>

              <Card className="rounded-[24px] border-slate-100">
                <div className="mb-4 flex items-center gap-2 font-medium text-slate-900">
                  <MessageOutlined />
                  回复
                </div>
                <Form form={replyForm} layout="vertical" onFinish={(values) => void handleCreateReply(values)}>
                  <Form.Item name="content" rules={[{ required: true, message: "请输入回复内容" }]}>
                    <Input.TextArea rows={4} placeholder={`以 ${user?.nickname ?? "当前用户"} 的身份参与讨论`} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={savingReply}>
                    发送回复
                  </Button>
                </Form>
              </Card>

              <div className="space-y-4">
                {replies.length === 0 ? (
                  <Empty description="暂时还没有回复，来抢一个沙发吧。" />
                ) : (
                  replies.map((reply) => (
                    <Card
                      key={reply.id}
                      id={`forum-reply-${reply.id}`}
                      className={`rounded-[24px] border-slate-100 transition-all ${
                        highlightReplyId === reply.id ? "border-[#93c5fd] bg-[#f5f9ff] shadow-[0_0_0_3px_rgba(59,130,246,0.12)]" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar src={resolveAssetUrl(reply.authorAvatarUrl)} icon={<UserOutlined />}>
                          {reply.author?.[0]}
                        </Avatar>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-slate-900">{reply.author}</div>
                            <div className="flex items-center gap-3">
                              <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => void handleCopyReplyLink(reply.id)}>
                                复制链接
                              </Button>
                              <div className="text-xs text-slate-500">{reply.createTime}</div>
                            </div>
                          </div>
                          <div className="whitespace-pre-wrap leading-7 text-slate-600">{reply.content}</div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </MainLayout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, Drawer, Input, Select, Spin, Tag, message } from "antd";
import {
  ClockCircleOutlined,
  DeleteOutlined,
  HeartOutlined,
  MessageOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  SortAscendingOutlined,
} from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";
import StatusState from "../components/StatusState";
import {
  formatTime,
  readChatProfile,
  talkCategories,
  type TalkCategory,
  type TalkComment,
  type TalkPost,
  writeChatProfile,
} from "../lib/community";
import { getErrorMessage } from "../lib/errorMessage";
import { addTalkComment, deleteTalkPost, fetchTalkPosts, likeTalkPost, publishTalkPost } from "../services/communityService";

const { TextArea } = Input;

type SortMode = "latest" | "hot" | "commented";

const categoryOptions: Array<TalkCategory> = ["全部", ...talkCategories];
const TALK_CONTENT_MAX_LENGTH = 500;
const TALK_COMMENT_MAX_LENGTH = 300;
const TALK_NICKNAME_MAX_LENGTH = 20;

function getAvatarLabel(name: string) {
  return (name || "ID")[0]?.toUpperCase() || "I";
}

export default function RandomTalk() {
  const initialProfile = readChatProfile();
  const [posts, setPosts] = useState<TalkPost[]>([]);
  const [nickname, setNickname] = useState(initialProfile.nickname);
  const [category, setCategory] = useState<TalkCategory>("全部");
  const [publishCategory, setPublishCategory] = useState<Exclude<TalkCategory, "全部">>("闲聊摸鱼");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [keyword, setKeyword] = useState("");
  const [content, setContent] = useState("");
  const [activePost, setActivePost] = useState<TalkPost | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const profileName = nickname.trim() || "匿名游客";
    writeChatProfile({ nickname: profileName, avatarSeed: profileName });
  }, [nickname]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "idncar.chat.profile.v1") {
        const profile = readChatProfile();
        setNickname(profile.nickname);
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    let active = true;

    const loadPosts = async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      try {
        const nextPosts = await fetchTalkPosts();
        if (!active) {
          return;
        }

        setPosts(nextPosts);
        setActivePost((current) =>
          current ? nextPosts.find((post) => post.id === current.id) ?? null : current,
        );
      } catch (error) {
        if (!silent) {
          message.error(getErrorMessage(error, "随便聊聊加载失败"));
        }
      } finally {
        if (active && !silent) {
          setLoading(false);
        }
      }
    };

    void loadPosts();
    const timer = window.setInterval(() => {
      void loadPosts(true);
    }, 8000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const filteredPosts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    const nextPosts = posts.filter((post) => {
      const matchedCategory = category === "全部" || post.category === category;
      const matchedKeyword =
        !normalizedKeyword ||
        [post.author, post.content, post.category, ...(post.comments ?? []).map((comment) => comment.content)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedKeyword));

      return matchedCategory && matchedKeyword;
    });

    if (sortMode === "hot") {
      return [...nextPosts].sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt);
    }
    if (sortMode === "commented") {
      return [...nextPosts].sort(
        (a, b) => (b.comments?.length ?? 0) - (a.comments?.length ?? 0) || b.createdAt - a.createdAt,
      );
    }
    return [...nextPosts].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt,
    );
  }, [category, keyword, posts, sortMode]);

  const stats = useMemo(
    () => ({
      total: posts.length,
      likes: posts.reduce((sum, post) => sum + post.likes, 0),
      comments: posts.reduce((sum, post) => sum + (post.comments?.length ?? 0), 0),
      pinned: posts.filter((post) => post.pinned).length,
    }),
    [posts],
  );

  const topPosts = useMemo(() => [...filteredPosts].sort((a, b) => b.likes - a.likes).slice(0, 3), [filteredPosts]);
  const categoryStats = useMemo(
    () => talkCategories.map((item) => ({ category: item, count: posts.filter((post) => post.category === item).length })),
    [posts],
  );
  const hasActiveFilters = category !== "全部" || keyword.trim() !== "" || sortMode !== "latest";

  function clearFilters() {
    setCategory("全部");
    setKeyword("");
    setSortMode("latest");
  }

  async function handlePublish() {
    const messageText = content.trim();
    const author = nickname.trim() || "匿名游客";

    if (!messageText) {
      message.warning("请输入内容");
      return;
    }

    try {
      const nextPost = await publishTalkPost({
        author,
        avatarSeed: author,
        content: messageText,
        category: publishCategory,
      });

      setPosts((current) => [nextPost, ...current]);
      setContent("");
      message.success("已发布到随便聊聊");
    } catch (error) {
      message.error(getErrorMessage(error, "发布失败"));
    }
  }

  async function handleLike(postId: string) {
    try {
      const nextPost = await likeTalkPost(postId);
      setPosts((current) => current.map((post) => (post.id === postId ? nextPost : post)));
      setActivePost((current) => (current?.id === postId ? nextPost : current));
    } catch (error) {
      message.error(getErrorMessage(error, "点赞失败"));
    }
  }

  async function handleDelete(postId: string) {
    const target = posts.find((post) => post.id === postId);
    if (!target) {
      return;
    }

    if (target.author !== (nickname.trim() || "匿名游客")) {
      message.warning("只能删除自己发布的内容");
      return;
    }

    try {
      await deleteTalkPost(postId, target.author);
      setPosts((current) => current.filter((post) => post.id !== postId));
      if (activePost?.id === postId) {
        setDetailOpen(false);
        setActivePost(null);
      }
      message.success("帖子已删除");
    } catch (error) {
      message.error(getErrorMessage(error, "删除失败"));
    }
  }

  function openDetail(post: TalkPost) {
    setActivePost(post);
    setDetailOpen(true);
    setCommentInput("");
  }

  async function handleAddComment() {
    if (!activePost) {
      return;
    }

    const commentText = commentInput.trim();
    const author = nickname.trim() || "匿名游客";
    if (!commentText) {
      message.warning("请输入回复内容");
      return;
    }

    try {
      const nextComment: TalkComment = await addTalkComment(activePost.id, {
        author,
        content: commentText,
      });

      setPosts((current) =>
        current.map((post) =>
          post.id === activePost.id ? { ...post, comments: [nextComment, ...(post.comments ?? [])] } : post,
        ),
      );
      setActivePost((current) =>
        current ? { ...current, comments: [nextComment, ...(current.comments ?? [])] } : current,
      );
      setCommentInput("");
      message.success("回复成功");
    } catch (error) {
      message.error(getErrorMessage(error, "回复失败"));
    }
  }

  return (
    <MainLayout>
      <div className="space-y-8 py-8">
        <section className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,253,0.98))] shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[minmax(0,1.3fr)_320px]">
            <div>
              <Tag color="orange">随便聊聊</Tag>
              <h1 className="mt-4 text-3xl font-semibold text-slate-900 md:text-4xl">想说什么就说什么，顺手也能聊两句。</h1>
              <p className="mt-4 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
                这里是一个轻量的内容流，支持搜索、分类、热度排序、评论和删除自己发过的内容。现在帖子和评论都会走后端持久化。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-full bg-[#f5f7fb] px-4 py-2 text-sm text-slate-600">
                  帖子 <span className="font-semibold text-slate-900">{stats.total}</span>
                </div>
                <div className="rounded-full bg-[#f5f7fb] px-4 py-2 text-sm text-slate-600">
                  点赞 <span className="font-semibold text-slate-900">{stats.likes}</span>
                </div>
                <div className="rounded-full bg-[#f5f7fb] px-4 py-2 text-sm text-slate-600">
                  评论 <span className="font-semibold text-slate-900">{stats.comments}</span>
                </div>
              </div>
            </div>

            <Card className="rounded-[28px] border-slate-100 bg-white/90 shadow-sm">
              <div className="space-y-4">
                <div className="text-lg font-semibold text-slate-900">你的身份</div>
                <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="输入你的昵称" maxLength={TALK_NICKNAME_MAX_LENGTH} showCount />
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="flex items-center gap-3">
                    <Avatar className="bg-[#2a6df4]">{getAvatarLabel(nickname.trim() || "匿名游客")}</Avatar>
                    <div>
                      <div className="font-medium text-slate-900">{nickname.trim() || "匿名游客"}</div>
                      <div className="text-xs text-slate-500">会同步到聊天室</div>
                    </div>
                  </div>
                </div>
                <Button
                  type="primary"
                  block
                  icon={<MessageOutlined />}
                  disabled={filteredPosts.length === 0}
                  onClick={() => {
                    if (filteredPosts.length === 0) {
                      message.info("先发一条内容再看详情");
                      return;
                    }
                    openDetail(filteredPosts[0]);
                  }}
                >
                  打开最新帖子
                </Button>
              </div>
            </Card>
          </div>
        </section>

        <Card className="rounded-[28px] border-slate-100 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="!mr-0">当前显示 {filteredPosts.length} 条</Tag>
              <Tag className="!mr-0">全部 {posts.length} 条</Tag>
              {category !== "全部" ? <Tag color="blue" className="!mr-0">分类：{category}</Tag> : null}
              {keyword.trim() ? <Tag color="purple" className="!mr-0">搜索：{keyword.trim()}</Tag> : null}
              {sortMode !== "latest" ? <Tag color="green" className="!mr-0">排序：{sortMode === "hot" ? "最多点赞" : "评论最多"}</Tag> : null}
            </div>
            {hasActiveFilters ? (
              <Button size="small" onClick={clearFilters}>
                清空筛选
              </Button>
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px_220px]">
            <Input
              size="large"
              prefix={<SearchOutlined />}
              placeholder="搜索作者、内容、评论"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              size="large"
              value={category}
              options={categoryOptions.map((item) => ({ label: item, value: item }))}
              onChange={(value) => setCategory(value as TalkCategory)}
            />
            <Select
              size="large"
              value={sortMode}
              prefix={<SortAscendingOutlined />}
              options={[
                { label: "最新发布", value: "latest" },
                { label: "最多点赞", value: "hot" },
                { label: "评论最多", value: "commented" },
              ]}
              onChange={(value) => setSortMode(value as SortMode)}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {categoryOptions.map((item) => {
              const active = item === category;
              const count = item === "全部" ? posts.length : categoryStats.find((entry) => entry.category === item)?.count ?? 0;
              return (
                <Button
                  key={item}
                  size="small"
                  type={active ? "primary" : "default"}
                  className={active ? "rounded-full bg-[#2a6df4]" : "rounded-full"}
                  onClick={() => setCategory(item)}
                >
                  {item} {count}
                </Button>
              );
            })}
          </div>
        </Card>

        <Card className="rounded-[28px] border-slate-100 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div>
              <div className="mb-3 text-lg font-semibold text-slate-900">发布一条内容</div>
              <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <Select
                  value={publishCategory}
                  options={talkCategories.map((item) => ({ label: item, value: item }))}
                  onChange={(value) => setPublishCategory(value as Exclude<TalkCategory, "全部">)}
                />
                <TextArea
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="说点什么，或者分享一个问题、一个想法。"
                  maxLength={TALK_CONTENT_MAX_LENGTH}
                  showCount
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-400">发布到 {publishCategory}</span>
                <Button type="primary" icon={<SendOutlined />} onClick={() => void handlePublish()} disabled={!content.trim()}>
                  发布
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] bg-[linear-gradient(180deg,#f8fbff,#f3f7fd)] p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <HeartOutlined className="text-[#ef4444]" />
                热门内容
              </div>
              <div className="mt-4 space-y-3">
                {topPosts.length === 0 ? (
                  <StatusState compact title="暂无热门内容" description="先发一条内容，或者切换分类看看。" />
                ) : (
                  topPosts.map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      className="w-full rounded-2xl border border-white bg-white px-4 py-3 text-left shadow-sm transition hover:border-[#cfe0ff]"
                      onClick={() => openDetail(post)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-slate-900">{post.author}</div>
                        <Badge count={post.likes} style={{ backgroundColor: "#2a6df4" }} />
                      </div>
                      <div className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{post.content}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4">
          {loading ? (
            <Card className="rounded-[28px] border-slate-100 shadow-sm">
              <div className="flex justify-center py-12">
                <Spin />
              </div>
            </Card>
          ) : filteredPosts.length === 0 ? (
            <Card className="rounded-[28px] border-slate-100 shadow-sm">
              <StatusState compact title="没有找到匹配内容" description="试试换个关键词，或者直接发布一条新内容。" />
            </Card>
          ) : (
            filteredPosts.map((post) => (
              <Card key={post.id} className="rounded-[28px] border-slate-100 shadow-sm transition hover:border-[#d8e4f4]">
                <div className="flex items-start gap-4">
                  <Avatar className="bg-[#2a6df4]">{getAvatarLabel(post.author)}</Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium text-slate-900">{post.author}</div>
                      <Tag color={post.pinned ? "gold" : "blue"}>{post.category}</Tag>
                      {post.pinned ? <Tag color="gold">置顶</Tag> : null}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <ClockCircleOutlined /> {formatTime(post.createdAt)}
                      </span>
                      <span>评论 {post.comments?.length ?? 0}</span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">{post.content}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button icon={<MessageOutlined />} onClick={() => openDetail(post)}>
                        查看评论
                      </Button>
                      <Button icon={<HeartOutlined />} onClick={() => void handleLike(post.id)}>
                        点赞 {post.likes}
                      </Button>
                      {post.author === (nickname.trim() || "匿名游客") ? (
                        <Button danger icon={<DeleteOutlined />} onClick={() => void handleDelete(post.id)}>
                          删除
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <Drawer title="帖子详情" open={detailOpen} width={720} onClose={() => setDetailOpen(false)}>
        {activePost ? (
          <div className="space-y-6">
            <div className="rounded-[28px] bg-slate-50 p-5">
              <div className="flex items-center gap-3">
                <Avatar className="bg-[#2a6df4]">{getAvatarLabel(activePost.author)}</Avatar>
                <div>
                  <div className="font-medium text-slate-900">{activePost.author}</div>
                  <div className="text-xs text-slate-400">{formatTime(activePost.createdAt)}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Tag color="blue">{activePost.category}</Tag>
                {activePost.pinned ? <Tag color="gold">置顶</Tag> : null}
              </div>
              <div className="mt-4 whitespace-pre-wrap leading-7 text-slate-700">{activePost.content}</div>
            </div>

            <Card className="rounded-[28px] border-slate-100 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-lg font-semibold text-slate-900">评论 {activePost.comments?.length ?? 0}</div>
                <Button icon={<PlusOutlined />} onClick={() => setCommentInput((current) => current)}>
                  写回复
                </Button>
              </div>
              <TextArea
                rows={4}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="写下你的回复"
                maxLength={TALK_COMMENT_MAX_LENGTH}
                showCount
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-400">回复给 {activePost.author}</span>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => void handleAddComment()}
                  disabled={!commentInput.trim()}
                >
                  发送回复
                </Button>
              </div>
            </Card>

            <div className="space-y-3">
              {(activePost.comments ?? []).length === 0 ? (
                <StatusState compact title="还没有评论" description="写下第一条回复，把这条内容聊起来。" />
              ) : (
                activePost.comments.map((comment) => (
                  <Card key={comment.id} className="rounded-[24px] border-slate-100 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Avatar className="bg-[#334155]">{getAvatarLabel(comment.author)}</Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-slate-900">{comment.author}</div>
                          <div className="text-xs text-slate-400">{formatTime(comment.createdAt)}</div>
                        </div>
                        <div className="mt-2 whitespace-pre-wrap leading-7 text-slate-600">{comment.content}</div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        ) : null}
      </Drawer>
    </MainLayout>
  );
}

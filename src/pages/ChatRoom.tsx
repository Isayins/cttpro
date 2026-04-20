import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar, Button, Empty, Input, Segmented, Select, Spin, Tag, message } from "antd";
import { ClearOutlined, EyeInvisibleOutlined, MessageOutlined, SendOutlined, UserOutlined } from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";
import StatusState from "../components/StatusState";
import { useAuth } from "../context/useAuth";
import { chatRooms, readChatProfile, type ChatMessage } from "../lib/community";
import {
  clearChatMessages,
  fetchChatMessages,
  fetchOnlinePrivateChatUsers,
  fetchPrivateMessages,
  getChatPresenceMode,
  sendChatMessage,
  sendPrivateMessage,
  updateChatPresenceMode,
} from "../services/communityService";
import type { ChatPresenceMode, PrivateChatMessage, PrivateChatUser } from "../types/app";

const { TextArea } = Input;
type ChatViewMode = "PRIVATE" | "GROUP";

function getAvatarLabel(name: string) {
  return (name || "U")[0]?.toUpperCase() || "U";
}

function formatMessageTime(value: number) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatRoom() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ChatViewMode>("GROUP");

  const [presenceMode, setPresenceMode] = useState<ChatPresenceMode>("ONLINE");
  const [users, setUsers] = useState<PrivateChatUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [privateMessages, setPrivateMessages] = useState<PrivateChatMessage[]>([]);
  const [privateDraft, setPrivateDraft] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPrivateMessages, setLoadingPrivateMessages] = useState(false);
  const [updatingPresence, setUpdatingPresence] = useState(false);
  const privateMessageListRef = useRef<HTMLDivElement | null>(null);

  const [groupRoomId, setGroupRoomId] = useState<string>(chatRooms[0]?.id ?? "general");
  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>([]);
  const [groupDraft, setGroupDraft] = useState("");
  const [loadingGroupMessages, setLoadingGroupMessages] = useState(false);
  const [clearingGroup, setClearingGroup] = useState(false);
  const groupMessageListRef = useRef<HTMLDivElement | null>(null);

  const chatProfile = useMemo(() => readChatProfile(), []);
  const currentAuthor = useMemo(() => chatProfile.nickname?.trim() || user?.nickname || "匿名游客", [chatProfile.nickname, user?.nickname]);
  const currentAvatarSeed = useMemo(() => chatProfile.avatarSeed?.trim() || currentAuthor, [chatProfile.avatarSeed, currentAuthor]);

  const activeUser = useMemo(
    () => users.find((item) => item.id === activeUserId) ?? null,
    [activeUserId, users],
  );

  const activeGroupRoom = useMemo(
    () => chatRooms.find((room) => room.id === groupRoomId) ?? chatRooms[0] ?? null,
    [groupRoomId],
  );

  useEffect(() => {
    if (!privateMessageListRef.current) {
      return;
    }
    privateMessageListRef.current.scrollTo({
      top: privateMessageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [privateMessages]);

  useEffect(() => {
    if (!groupMessageListRef.current) {
      return;
    }
    groupMessageListRef.current.scrollTo({
      top: groupMessageListRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [groupMessages]);

  useEffect(() => {
    if (viewMode !== "PRIVATE") {
      return;
    }

    let active = true;

    const loadPresenceAndUsers = async (silent = false) => {
      if (!silent) {
        setLoadingUsers(true);
      }

      try {
        const [mode, list] = await Promise.all([getChatPresenceMode(), fetchOnlinePrivateChatUsers()]);
        if (!active) {
          return;
        }
        setPresenceMode(mode);
        setUsers(list);
        setActiveUserId((current) => {
          if (current && list.some((item) => item.id === current)) {
            return current;
          }
          return list[0]?.id ?? null;
        });
      } catch (error) {
        if (!silent) {
          message.error(error instanceof Error ? error.message : "加载在线用户失败");
        }
      } finally {
        if (active && !silent) {
          setLoadingUsers(false);
        }
      }
    };

    void loadPresenceAndUsers();
    const timer = window.setInterval(() => {
      void loadPresenceAndUsers(true);
    }, 8000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "PRIVATE") {
      return;
    }

    if (!activeUserId) {
      setPrivateMessages([]);
      return;
    }

    let active = true;

    const loadMessages = async (silent = false) => {
      if (!silent) {
        setLoadingPrivateMessages(true);
      }
      try {
        const list = await fetchPrivateMessages(activeUserId);
        if (!active) {
          return;
        }
        setPrivateMessages(list);
      } catch (error) {
        if (!silent) {
          message.error(error instanceof Error ? error.message : "加载私聊消息失败");
        }
      } finally {
        if (active && !silent) {
          setLoadingPrivateMessages(false);
        }
      }
    };

    void loadMessages();
    const timer = window.setInterval(() => {
      void loadMessages(true);
    }, 4000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeUserId, viewMode]);

  useEffect(() => {
    if (viewMode !== "GROUP") {
      return;
    }

    if (!activeGroupRoom?.id) {
      setGroupMessages([]);
      return;
    }

    let active = true;
    const loadGroupMessages = async (silent = false) => {
      if (!silent) {
        setLoadingGroupMessages(true);
      }
      try {
        const list = await fetchChatMessages(activeGroupRoom.id);
        if (!active) {
          return;
        }
        setGroupMessages(list);
      } catch (error) {
        if (!silent) {
          message.error(error instanceof Error ? error.message : "加载群聊消息失败");
        }
      } finally {
        if (active && !silent) {
          setLoadingGroupMessages(false);
        }
      }
    };

    void loadGroupMessages();
    const timer = window.setInterval(() => {
      void loadGroupMessages(true);
    }, 4000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeGroupRoom?.id, viewMode]);

  async function handleModeChange(nextMode: ChatPresenceMode) {
    if (nextMode === presenceMode) {
      return;
    }

    setUpdatingPresence(true);
    try {
      const updated = await updateChatPresenceMode(nextMode);
      setPresenceMode(updated);
      if (updated === "INVISIBLE") {
        message.success("已切换为隐身模式，其他用户无法在在线列表发现你");
      } else {
        message.success("已切换为在线模式");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "切换在线模式失败");
    } finally {
      setUpdatingPresence(false);
    }
  }

  async function handleSendPrivate() {
    const content = privateDraft.trim();
    if (!activeUserId) {
      message.warning("请先选择一个在线用户");
      return;
    }
    if (!content) {
      message.warning("请输入要发送的消息");
      return;
    }

    try {
      const sent = await sendPrivateMessage({
        recipientUserId: activeUserId,
        content,
      });
      setPrivateMessages((current) => [...current, sent]);
      setPrivateDraft("");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "消息发送失败");
    }
  }

  async function handleSendGroup() {
    const content = groupDraft.trim();
    if (!activeGroupRoom?.id) {
      message.warning("请先选择聊天室");
      return;
    }
    if (!content) {
      message.warning("请输入要发送的消息");
      return;
    }

    try {
      const sent = await sendChatMessage({
        roomId: activeGroupRoom.id,
        author: currentAuthor,
        avatarSeed: currentAvatarSeed,
        content,
      });
      setGroupMessages((current) => [...current, sent]);
      setGroupDraft("");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "群聊消息发送失败");
    }
  }

  async function handleClearGroupMessages() {
    if (!activeGroupRoom?.id) {
      return;
    }
    if (!window.confirm("确认清空当前聊天室消息吗？")) {
      return;
    }

    setClearingGroup(true);
    try {
      await clearChatMessages(activeGroupRoom.id);
      setGroupMessages([]);
      message.success("聊天室消息已清空");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "清空聊天室失败");
    } finally {
      setClearingGroup(false);
    }
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="py-8">
          <StatusState title="请先登录" description="登录后才可以查看在线用户并发起私聊。" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="py-8">
        <div className="mb-4 flex justify-end">
          <Segmented<ChatViewMode>
            value={viewMode}
            onChange={(value) => setViewMode(value)}
            options={[
              { label: "群聊", value: "GROUP" },
              { label: "私聊", value: "PRIVATE" },
            ]}
          />
        </div>

        {viewMode === "GROUP" ? (
          <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
            <div className="grid min-h-[720px] lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="border-r border-slate-100 bg-slate-50/80 p-5">
                <div className="flex items-center gap-3">
                  <Avatar size={42} className="bg-[linear-gradient(135deg,#34d399,#059669)]">
                    {getAvatarLabel(currentAuthor)}
                  </Avatar>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{currentAuthor}</div>
                    <div className="text-xs text-slate-500">群聊大厅</div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="text-xs font-semibold tracking-wide text-slate-500">聊天室</div>
                  <Tag color="green">{chatRooms.length}</Tag>
                </div>

                <div className="mt-3 space-y-2">
                  {chatRooms.map((room) => {
                    const active = room.id === activeGroupRoom?.id;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setGroupRoomId(room.id)}
                        className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-emerald-300 bg-emerald-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                        }`}
                      >
                        <div className="text-sm font-medium text-slate-900">{room.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{room.description}</div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <main className="flex min-h-0 flex-col bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <div>
                    <div className="text-base font-semibold text-slate-900">{activeGroupRoom?.name ?? "群聊"}</div>
                    <div className="text-xs text-slate-500">{activeGroupRoom?.topic ?? "欢迎聊天"}</div>
                  </div>
                  <Button danger icon={<ClearOutlined />} loading={clearingGroup} onClick={() => void handleClearGroupMessages()}>
                    清空当前房间
                  </Button>
                </div>

                <div ref={groupMessageListRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-6 py-5">
                  {loadingGroupMessages ? (
                    <div className="flex justify-center py-10">
                      <Spin />
                    </div>
                  ) : null}

                  {!loadingGroupMessages && groupMessages.length === 0 ? (
                    <StatusState
                      title="还没有群聊消息"
                      description="发一条消息，重新激活这个聊天室。"
                      icon={<MessageOutlined className="text-xl" />}
                    />
                  ) : null}

                  {groupMessages.map((item) => {
                    const mine = item.author === currentAuthor || item.author === (user?.nickname ?? "");
                    return (
                      <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            mine ? "bg-emerald-500 text-white" : "border border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <div className={`mb-1 text-xs ${mine ? "text-emerald-100" : "text-slate-400"}`}>
                            {mine ? "我" : item.author} · {formatMessageTime(item.createdAt)}
                          </div>
                          <div className="leading-7 break-words whitespace-pre-wrap">{item.content}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-100 bg-white px-6 py-4">
                  <TextArea
                    value={groupDraft}
                    onChange={(event) => setGroupDraft(event.target.value)}
                    placeholder={activeGroupRoom ? `发送到 ${activeGroupRoom.name}` : "请先选择聊天室"}
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    maxLength={1000}
                    disabled={!activeGroupRoom}
                    onPressEnter={(event) => {
                      if (event.shiftKey) {
                        return;
                      }
                      event.preventDefault();
                      void handleSendGroup();
                    }}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-xs text-slate-400">{groupDraft.length}/1000</div>
                    <Button type="primary" icon={<SendOutlined />} onClick={() => void handleSendGroup()} disabled={!activeGroupRoom}>
                      发送
                    </Button>
                  </div>
                </div>
              </main>
            </div>
          </section>
        ) : null}

        {viewMode === "PRIVATE" ? (
        <section className="overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
          <div className="grid min-h-[720px] lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="border-r border-slate-100 bg-slate-50/80 p-5">
              <div className="flex items-center gap-3">
                <Avatar size={42} className="bg-[linear-gradient(135deg,#60a5fa,#2563eb)]">
                  {getAvatarLabel(user.nickname)}
                </Avatar>
                <div>
                  <div className="text-sm font-semibold text-slate-900">{user.nickname}</div>
                  <div className="text-xs text-slate-500">私聊中心</div>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500">在线模式</div>
                <Select<ChatPresenceMode>
                  className="w-full"
                  value={presenceMode}
                  onChange={(value) => void handleModeChange(value)}
                  loading={updatingPresence}
                  options={[
                    { label: "在线", value: "ONLINE" },
                    { label: "隐身", value: "INVISIBLE" },
                  ]}
                />
                {presenceMode === "INVISIBLE" ? (
                  <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <EyeInvisibleOutlined className="mr-1" />
                    你当前处于隐身状态，不会出现在他人的在线用户列表中。
                  </div>
                ) : null}
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="text-xs font-semibold tracking-wide text-slate-500">在线用户</div>
                <Tag color="blue">{users.length}</Tag>
              </div>

              <div className="mt-3 max-h-[460px] space-y-2 overflow-y-auto pr-1">
                {loadingUsers ? (
                  <div className="flex justify-center py-10">
                    <Spin />
                  </div>
                ) : null}

                {!loadingUsers && users.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可私聊的在线用户" />
                ) : null}

                {!loadingUsers
                  ? users.map((item) => {
                      const active = item.id === activeUserId;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setActiveUserId(item.id)}
                          className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                            active
                              ? "border-blue-300 bg-blue-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar src={item.avatarUrl || undefined} icon={<UserOutlined />}>
                              {getAvatarLabel(item.nickname)}
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-slate-900">{item.nickname}</div>
                              <div className="truncate text-xs text-slate-500">{item.bio || "这个用户很低调，还没写简介。"}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  : null}
              </div>
            </aside>

            <main className="flex min-h-0 flex-col bg-white">
              <div className="border-b border-slate-100 px-6 py-4">
                {activeUser ? (
                  <div className="flex items-center gap-3">
                    <Avatar src={activeUser.avatarUrl || undefined} icon={<UserOutlined />}>
                      {getAvatarLabel(activeUser.nickname)}
                    </Avatar>
                    <div>
                      <div className="text-base font-semibold text-slate-900">{activeUser.nickname}</div>
                      <div className="text-xs text-slate-500">点对点私聊</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">请选择一个在线用户开始私聊</div>
                )}
              </div>

              <div ref={privateMessageListRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-6 py-5">
                {loadingPrivateMessages && activeUser ? (
                  <div className="flex justify-center py-10">
                    <Spin />
                  </div>
                ) : null}

                {!loadingPrivateMessages && activeUser && privateMessages.length === 0 ? (
                  <StatusState
                    title="还没有消息"
                    description="发送第一条消息，开始你们的私聊。"
                    icon={<MessageOutlined className="text-xl" />}
                  />
                ) : null}

                {privateMessages.map((item) => {
                  const mine = item.senderId === user.id;
                  return (
                    <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          mine ? "bg-blue-500 text-white" : "border border-slate-200 bg-white text-slate-800"
                        }`}
                      >
                        <div className={`mb-1 text-xs ${mine ? "text-blue-100" : "text-slate-400"}`}>
                          {mine ? "我" : item.senderNickname} · {formatMessageTime(item.createdAt)}
                        </div>
                        <div className="leading-7 break-words whitespace-pre-wrap">{item.content}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 bg-white px-6 py-4">
                <TextArea
                  value={privateDraft}
                  onChange={(event) => setPrivateDraft(event.target.value)}
                  placeholder={activeUser ? `发消息给 ${activeUser.nickname}` : "请先选择在线用户"}
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  maxLength={1000}
                  disabled={!activeUser}
                  onPressEnter={(event) => {
                    if (event.shiftKey) {
                      return;
                    }
                    event.preventDefault();
                    void handleSendPrivate();
                  }}
                />
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-slate-400">{privateDraft.length}/1000</div>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => void handleSendPrivate()}
                    disabled={!activeUser}
                  >
                    发送
                  </Button>
                </div>
              </div>
            </main>
          </div>
        </section>
        ) : null}
      </div>
    </MainLayout>
  );
}

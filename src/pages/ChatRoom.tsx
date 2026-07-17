import {
  type ChangeEvent,
  type ClipboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Avatar,
  Button,
  Empty,
  Input,
  Popover,
  Segmented,
  Select,
  Spin,
  Tag,
  message,
} from "antd";
import {
  ClearOutlined,
  EyeInvisibleOutlined,
  MessageOutlined,
  PictureOutlined,
  SendOutlined,
  SmileOutlined,
  UserOutlined,
} from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";
import StatusState from "../components/StatusState";
import { useAuth } from "../context/useAuth";
import { chatRooms, type ChatMessage } from "../lib/community";
import { getErrorMessage } from "../lib/errorMessage";
import { resolveAssetUrl } from "../lib/media";
import {
  buildImageMarkup,
  CHAT_EMOJIS,
  getClipboardImageFile,
  getImageFileValidationError,
  IMAGE_ACCEPT,
  renderEmojiPanel,
  renderImageMarkupLines,
} from "../lib/richContent";
import {
  clearChatMessages,
  fetchChatMessages,
  fetchOnlinePrivateChatUsers,
  fetchPrivateMessages,
  getChatPresenceMode,
  sendChatMessage,
  sendPrivateMessage,
  updateChatPresenceMode,
  uploadChatImage,
} from "../services/communityService";
import type {
  ChatPresenceMode,
  PrivateChatMessage,
  PrivateChatUser,
} from "../types/app";

const { TextArea } = Input;
type ChatViewMode = "PRIVATE" | "GROUP";

const PRIVATE_USERS_POLL_INTERVAL_MS = 15_000;
const PRIVATE_MESSAGES_POLL_INTERVAL_MS = 8_000;
const GROUP_MESSAGES_POLL_INTERVAL_MS = 8_000;
const PRIVATE_IMAGE_UPLOAD_MESSAGE_KEY = "private-image-upload";
const GROUP_IMAGE_UPLOAD_MESSAGE_KEY = "group-image-upload";
const CHAT_DRAFT_MAX_LENGTH = 1000;

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

function renderMessageContent(content: string) {
  return renderImageMarkupLines(content, {
    alt: "聊天图片",
    imageClassName: "max-h-72 max-w-full rounded-xl object-contain",
    linkImages: true,
    textClassName: "leading-7 break-words whitespace-pre-wrap",
  });
}

export default function ChatRoom() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ChatViewMode>("GROUP");

  const [presenceMode, setPresenceMode] = useState<ChatPresenceMode>("ONLINE");
  const [users, setUsers] = useState<PrivateChatUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [privateMessages, setPrivateMessages] = useState<PrivateChatMessage[]>(
    [],
  );
  const [privateDraft, setPrivateDraft] = useState("");
  const [sendingPrivateMessage, setSendingPrivateMessage] = useState(false);
  const [uploadingPrivateImage, setUploadingPrivateImage] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingPrivateMessages, setLoadingPrivateMessages] = useState(false);
  const [updatingPresence, setUpdatingPresence] = useState(false);
  const privateMessageListRef = useRef<HTMLDivElement | null>(null);
  const privateImageInputRef = useRef<HTMLInputElement | null>(null);
  const privateMessageInFlightRef = useRef(false);
  const privateImageUploadInFlightRef = useRef(false);
  const privateUsersRequestRef = useRef(0);
  const privateMessagesRequestRef = useRef(0);

  const [groupRoomId, setGroupRoomId] = useState<string>(
    chatRooms[0]?.id ?? "general",
  );
  const [groupMessages, setGroupMessages] = useState<ChatMessage[]>([]);
  const [groupDraft, setGroupDraft] = useState("");
  const [sendingGroupMessage, setSendingGroupMessage] = useState(false);
  const [uploadingGroupImage, setUploadingGroupImage] = useState(false);
  const [loadingGroupMessages, setLoadingGroupMessages] = useState(false);
  const [clearingGroup, setClearingGroup] = useState(false);
  const groupMessageListRef = useRef<HTMLDivElement | null>(null);
  const groupImageInputRef = useRef<HTMLInputElement | null>(null);
  const groupMessageInFlightRef = useRef(false);
  const groupImageUploadInFlightRef = useRef(false);
  const groupMessagesRequestRef = useRef(0);

  const currentAuthor = user?.nickname?.trim() || user?.username || "用户";

  const activeUser = useMemo(
    () => users.find((item) => item.id === activeUserId) ?? null,
    [activeUserId, users],
  );

  const activeGroupRoom = useMemo(
    () =>
      chatRooms.find((room) => room.id === groupRoomId) ?? chatRooms[0] ?? null,
    [groupRoomId],
  );

  const groupDraftTextLength = groupDraft.trim().length;
  const privateDraftTextLength = privateDraft.trim().length;
  const latestGroupMessage = groupMessages[groupMessages.length - 1] ?? null;
  const latestPrivateMessage =
    privateMessages[privateMessages.length - 1] ?? null;
  const canSendGroupMessage = Boolean(
    activeGroupRoom && groupDraftTextLength > 0 && !sendingGroupMessage,
  );
  const canSendPrivateMessage = Boolean(
    activeUser && privateDraftTextLength > 0 && !sendingPrivateMessage,
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
      const requestId = privateUsersRequestRef.current + 1;
      privateUsersRequestRef.current = requestId;
      const isLatestRequest = () =>
        active && privateUsersRequestRef.current === requestId;

      if (!silent) {
        setLoadingUsers(true);
      }

      try {
        const [mode, list] = await Promise.all([
          getChatPresenceMode(),
          fetchOnlinePrivateChatUsers(),
        ]);
        if (!isLatestRequest()) {
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
        if (isLatestRequest() && !silent) {
          message.error(getErrorMessage(error, "加载在线用户失败"));
        }
      } finally {
        if (isLatestRequest()) {
          setLoadingUsers(false);
        }
      }
    };

    void loadPresenceAndUsers();
    const timer = window.setInterval(() => {
      void loadPresenceAndUsers(true);
    }, PRIVATE_USERS_POLL_INTERVAL_MS);

    return () => {
      active = false;
      privateUsersRequestRef.current += 1;
      window.clearInterval(timer);
    };
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "PRIVATE") {
      return;
    }

    if (!activeUserId) {
      privateMessagesRequestRef.current += 1;
      setLoadingPrivateMessages(false);
      setPrivateMessages([]);
      return;
    }

    let active = true;

    const loadMessages = async (silent = false) => {
      const requestId = privateMessagesRequestRef.current + 1;
      privateMessagesRequestRef.current = requestId;
      const isLatestRequest = () =>
        active && privateMessagesRequestRef.current === requestId;

      if (!silent) {
        setLoadingPrivateMessages(true);
      }
      try {
        const list = await fetchPrivateMessages(activeUserId);
        if (!isLatestRequest()) {
          return;
        }
        setPrivateMessages(list);
      } catch (error) {
        if (isLatestRequest() && !silent) {
          message.error(getErrorMessage(error, "加载私聊消息失败"));
        }
      } finally {
        if (isLatestRequest()) {
          setLoadingPrivateMessages(false);
        }
      }
    };

    void loadMessages();
    const timer = window.setInterval(() => {
      void loadMessages(true);
    }, PRIVATE_MESSAGES_POLL_INTERVAL_MS);

    return () => {
      active = false;
      privateMessagesRequestRef.current += 1;
      window.clearInterval(timer);
    };
  }, [activeUserId, viewMode]);

  useEffect(() => {
    if (viewMode !== "GROUP") {
      return;
    }

    if (!activeGroupRoom?.id) {
      groupMessagesRequestRef.current += 1;
      setLoadingGroupMessages(false);
      setGroupMessages([]);
      return;
    }

    let active = true;
    const loadGroupMessages = async (silent = false) => {
      const requestId = groupMessagesRequestRef.current + 1;
      groupMessagesRequestRef.current = requestId;
      const isLatestRequest = () =>
        active && groupMessagesRequestRef.current === requestId;

      if (!silent) {
        setLoadingGroupMessages(true);
      }
      try {
        const list = await fetchChatMessages(activeGroupRoom.id);
        if (!isLatestRequest()) {
          return;
        }
        setGroupMessages(list);
      } catch (error) {
        if (isLatestRequest() && !silent) {
          message.error(getErrorMessage(error, "加载群聊消息失败"));
        }
      } finally {
        if (isLatestRequest()) {
          setLoadingGroupMessages(false);
        }
      }
    };

    void loadGroupMessages();
    const timer = window.setInterval(() => {
      void loadGroupMessages(true);
    }, GROUP_MESSAGES_POLL_INTERVAL_MS);

    return () => {
      active = false;
      groupMessagesRequestRef.current += 1;
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
      message.error(getErrorMessage(error, "切换在线模式失败"));
    } finally {
      setUpdatingPresence(false);
    }
  }

  async function handleSendPrivate() {
    const content = privateDraft.trim();
    if (privateMessageInFlightRef.current) {
      message.warning("消息正在发送中，请稍候");
      return;
    }
    if (!activeUserId) {
      message.warning("请先选择一个在线用户");
      return;
    }
    if (!content) {
      message.warning("请输入要发送的消息");
      return;
    }

    privateMessageInFlightRef.current = true;
    setSendingPrivateMessage(true);
    try {
      const sent = await sendPrivateMessage({
        recipientUserId: activeUserId,
        content,
      });
      setPrivateMessages((current) => [...current, sent]);
      setPrivateDraft((current) => (current.trim() === content ? "" : current));
    } catch (error) {
      message.error(getErrorMessage(error, "消息发送失败"));
    } finally {
      privateMessageInFlightRef.current = false;
      setSendingPrivateMessage(false);
    }
  }

  function appendPrivateEmoji(emoji: string) {
    setPrivateDraft((current) => `${current}${emoji}`);
  }

  function appendGroupEmoji(emoji: string) {
    setGroupDraft((current) => `${current}${emoji}`);
  }

  async function handlePrivateImageUpload(file: File | null | undefined) {
    if (!file) {
      return;
    }
    if (privateImageUploadInFlightRef.current) {
      message.warning("图片正在发送中，请稍候");
      return;
    }
    if (!activeUserId) {
      message.warning("请先选择一个在线用户");
      return;
    }
    const validationError = getImageFileValidationError(file, "聊天图片");
    if (validationError) {
      message.error(validationError);
      return;
    }

    privateImageUploadInFlightRef.current = true;
    setUploadingPrivateImage(true);
    message.open({
      type: "loading",
      key: PRIVATE_IMAGE_UPLOAD_MESSAGE_KEY,
      content: "图片发送中...",
      duration: 0,
    });
    try {
      const uploaded = await uploadChatImage(file);
      const sent = await sendPrivateMessage({
        recipientUserId: activeUserId,
        content: buildImageMarkup(uploaded.url),
      });
      setPrivateMessages((current) => [...current, sent]);
      message.success({
        key: PRIVATE_IMAGE_UPLOAD_MESSAGE_KEY,
        content: "图片已发送",
        duration: 2,
      });
    } catch (error) {
      message.error({
        key: PRIVATE_IMAGE_UPLOAD_MESSAGE_KEY,
        content: getErrorMessage(error, "图片发送失败"),
        duration: 4,
      });
    } finally {
      privateImageUploadInFlightRef.current = false;
      setUploadingPrivateImage(false);
      if (privateImageInputRef.current) {
        privateImageInputRef.current.value = "";
      }
    }
  }

  async function handleSendGroup() {
    const content = groupDraft.trim();
    if (groupMessageInFlightRef.current) {
      message.warning("消息正在发送中，请稍候");
      return;
    }
    if (!activeGroupRoom?.id) {
      message.warning("请先选择聊天室");
      return;
    }
    if (!content) {
      message.warning("请输入要发送的消息");
      return;
    }

    groupMessageInFlightRef.current = true;
    setSendingGroupMessage(true);
    try {
      const sent = await sendChatMessage({
        roomId: activeGroupRoom.id,
        content,
      });
      setGroupMessages((current) => [...current, sent]);
      setGroupDraft((current) => (current.trim() === content ? "" : current));
    } catch (error) {
      message.error(getErrorMessage(error, "群聊消息发送失败"));
    } finally {
      groupMessageInFlightRef.current = false;
      setSendingGroupMessage(false);
    }
  }

  async function handleGroupImageUpload(file: File | null | undefined) {
    if (!file) {
      return;
    }
    if (groupImageUploadInFlightRef.current) {
      message.warning("图片正在发送中，请稍候");
      return;
    }
    if (!activeGroupRoom?.id) {
      message.warning("请先选择聊天室");
      return;
    }
    const validationError = getImageFileValidationError(file, "聊天图片");
    if (validationError) {
      message.error(validationError);
      return;
    }

    groupImageUploadInFlightRef.current = true;
    setUploadingGroupImage(true);
    message.open({
      type: "loading",
      key: GROUP_IMAGE_UPLOAD_MESSAGE_KEY,
      content: "图片发送中...",
      duration: 0,
    });
    try {
      const uploaded = await uploadChatImage(file);
      const sent = await sendChatMessage({
        roomId: activeGroupRoom.id,
        content: buildImageMarkup(uploaded.url),
      });
      setGroupMessages((current) => [...current, sent]);
      message.success({
        key: GROUP_IMAGE_UPLOAD_MESSAGE_KEY,
        content: "图片已发送",
        duration: 2,
      });
    } catch (error) {
      message.error({
        key: GROUP_IMAGE_UPLOAD_MESSAGE_KEY,
        content: getErrorMessage(error, "图片发送失败"),
        duration: 4,
      });
    } finally {
      groupImageUploadInFlightRef.current = false;
      setUploadingGroupImage(false);
      if (groupImageInputRef.current) {
        groupImageInputRef.current.value = "";
      }
    }
  }

  function handleGroupImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void handleGroupImageUpload(file);
  }

  function handlePrivateImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void handlePrivateImageUpload(file);
  }

  function handleGroupPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = getClipboardImageFile(event.clipboardData);
    if (!file) {
      return;
    }
    event.preventDefault();
    void handleGroupImageUpload(file);
  }

  function handlePrivatePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const file = getClipboardImageFile(event.clipboardData);
    if (!file) {
      return;
    }
    event.preventDefault();
    void handlePrivateImageUpload(file);
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
      message.error(getErrorMessage(error, "清空聊天室失败"));
    } finally {
      setClearingGroup(false);
    }
  }

  if (!user) {
    return (
      <MainLayout contentWidth="wide">
        <div className="py-8">
          <StatusState
            title="请先登录"
            description="登录后才可以查看在线用户并发起私聊。"
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout contentWidth="wide">
      <div className="py-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-2xl font-black text-slate-950">聊天室</div>
            <div className="mt-1 text-sm text-slate-500">
              群聊按房间同步，私聊只展示当前在线用户。
            </div>
          </div>
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
          <section className="overflow-hidden rounded-lg border border-white/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
            <div className="grid min-h-[720px] lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="border-r border-slate-100 bg-slate-50/80 p-5">
                <div className="flex items-center gap-3">
                  <Avatar
                    size={42}
                    className="bg-[linear-gradient(135deg,#34d399,#059669)]"
                  >
                    {getAvatarLabel(currentAuthor)}
                  </Avatar>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {currentAuthor}
                    </div>
                    <div className="text-xs text-slate-500">群聊大厅</div>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="text-xs font-semibold tracking-wide text-slate-500">
                    聊天室
                  </div>
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
                        className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                          active
                            ? "border-emerald-300 bg-emerald-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {room.name}
                          </div>
                          {active ? (
                            <Tag color="green" className="!mr-0">
                              当前
                            </Tag>
                          ) : null}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {room.description}
                        </div>
                        {active ? (
                          <div className="mt-2 text-xs font-semibold text-emerald-700">
                            {groupMessages.length} 条消息
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </aside>

              <main className="flex min-h-0 flex-col bg-white">
                <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold text-slate-900">
                      {activeGroupRoom?.name ?? "群聊"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {activeGroupRoom?.topic ?? "欢迎聊天"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      <Tag color="green" className="!mr-0">
                        每 {GROUP_MESSAGES_POLL_INTERVAL_MS / 1000}s 同步
                      </Tag>
                      <Tag className="!mr-0">{groupMessages.length} 条消息</Tag>
                      {latestGroupMessage ? (
                        <Tag className="!mr-0">
                          最新 {formatMessageTime(latestGroupMessage.createdAt)}
                        </Tag>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    danger
                    icon={<ClearOutlined />}
                    loading={clearingGroup}
                    disabled={groupMessages.length === 0 || clearingGroup}
                    onClick={() => void handleClearGroupMessages()}
                  >
                    清空当前房间
                  </Button>
                </div>

                <div
                  ref={groupMessageListRef}
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-6 py-5"
                >
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
                    const mine =
                      item.author === currentAuthor ||
                      item.author === (user?.nickname ?? "");
                    return (
                      <div
                        key={item.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            mine
                              ? "bg-emerald-500 text-white"
                              : "border border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <div
                            className={`mb-1 text-xs ${mine ? "text-emerald-100" : "text-slate-400"}`}
                          >
                            {mine ? "我" : item.author} ·{" "}
                            {formatMessageTime(item.createdAt)}
                          </div>
                          {renderMessageContent(item.content)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-100 bg-white px-6 py-4">
                  <input
                    ref={groupImageInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    className="hidden"
                    onChange={handleGroupImageChange}
                  />
                  <TextArea
                    value={groupDraft}
                    onChange={(event) => setGroupDraft(event.target.value)}
                    onPaste={handleGroupPaste}
                    placeholder={
                      activeGroupRoom
                        ? `发送到 ${activeGroupRoom.name}`
                        : "请先选择聊天室"
                    }
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    maxLength={CHAT_DRAFT_MAX_LENGTH}
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
                    <div
                      className={`text-xs ${groupDraft.length > CHAT_DRAFT_MAX_LENGTH * 0.9 ? "text-amber-600" : "text-slate-400"}`}
                    >
                      {groupDraft.length}/{CHAT_DRAFT_MAX_LENGTH}
                    </div>
                    <div className="flex items-center gap-2">
                      <Popover
                        trigger="click"
                        placement="topRight"
                        content={renderEmojiPanel(
                          CHAT_EMOJIS,
                          appendGroupEmoji,
                        )}
                      >
                        <Button
                          icon={<SmileOutlined />}
                          disabled={!activeGroupRoom}
                          aria-label="插入表情"
                          title="插入表情"
                        />
                      </Popover>
                      <Button
                        icon={<PictureOutlined />}
                        loading={uploadingGroupImage}
                        disabled={!activeGroupRoom || uploadingGroupImage}
                        aria-label="发送图片"
                        title="发送图片"
                        onClick={() => groupImageInputRef.current?.click()}
                      />
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={sendingGroupMessage}
                        onClick={() => void handleSendGroup()}
                        disabled={!canSendGroupMessage}
                      >
                        发送
                      </Button>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </section>
        ) : null}

        {viewMode === "PRIVATE" ? (
          <section className="overflow-hidden rounded-lg border border-white/70 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.10)]">
            <div className="grid min-h-[720px] lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="border-r border-slate-100 bg-slate-50/80 p-5">
                <div className="flex items-center gap-3">
                  <Avatar
                    size={42}
                    className="bg-[linear-gradient(135deg,#60a5fa,#2563eb)]"
                  >
                    {getAvatarLabel(user.nickname)}
                  </Avatar>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {user.nickname}
                    </div>
                    <div className="text-xs text-slate-500">私聊中心</div>
                  </div>
                </div>

                <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500">
                    在线模式
                  </div>
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
                    <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <EyeInvisibleOutlined className="mr-1" />
                      你当前处于隐身状态，不会出现在他人的在线用户列表中。
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div className="text-xs font-semibold tracking-wide text-slate-500">
                    在线用户
                  </div>
                  <Tag color="blue">{users.length}</Tag>
                </div>

                <div className="mt-3 max-h-[460px] space-y-2 overflow-y-auto pr-1">
                  {loadingUsers ? (
                    <div className="flex justify-center py-10">
                      <Spin />
                    </div>
                  ) : null}

                  {!loadingUsers && users.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="暂无可私聊的在线用户"
                    />
                  ) : null}

                  {!loadingUsers
                    ? users.map((item) => {
                        const active = item.id === activeUserId;
                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => setActiveUserId(item.id)}
                            className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                              active
                                ? "border-blue-300 bg-blue-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={resolveAssetUrl(item.avatarUrl)}
                                icon={<UserOutlined />}
                              >
                                {getAvatarLabel(item.nickname)}
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="truncate text-sm font-medium text-slate-900">
                                    {item.nickname}
                                  </div>
                                  {active ? (
                                    <Tag color="blue" className="!mr-0">
                                      当前
                                    </Tag>
                                  ) : null}
                                </div>
                                <div className="truncate text-xs text-slate-500">
                                  {item.bio || "这个用户很低调，还没写简介。"}
                                </div>
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
                      <Avatar
                        src={resolveAssetUrl(activeUser.avatarUrl)}
                        icon={<UserOutlined />}
                      >
                        {getAvatarLabel(activeUser.nickname)}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold text-slate-900">
                          {activeUser.nickname}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {activeUser.bio || "点对点私聊"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                          <Tag color="blue" className="!mr-0">
                            每 {PRIVATE_MESSAGES_POLL_INTERVAL_MS / 1000}s 同步
                          </Tag>
                          <Tag className="!mr-0">
                            {privateMessages.length} 条消息
                          </Tag>
                          {latestPrivateMessage ? (
                            <Tag className="!mr-0">
                              最新{" "}
                              {formatMessageTime(
                                latestPrivateMessage.createdAt,
                              )}
                            </Tag>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        请选择一个在线用户
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        左侧用户上线后会自动刷新。
                      </div>
                    </div>
                  )}
                </div>

                <div
                  ref={privateMessageListRef}
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-6 py-5"
                >
                  {loadingPrivateMessages && activeUser ? (
                    <div className="flex justify-center py-10">
                      <Spin />
                    </div>
                  ) : null}

                  {!loadingPrivateMessages &&
                  activeUser &&
                  privateMessages.length === 0 ? (
                    <StatusState
                      title="还没有消息"
                      description="发送第一条消息，开始你们的私聊。"
                      icon={<MessageOutlined className="text-xl" />}
                    />
                  ) : null}

                  {privateMessages.map((item) => {
                    const mine = item.senderId === user.id;
                    return (
                      <div
                        key={item.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            mine
                              ? "bg-blue-500 text-white"
                              : "border border-slate-200 bg-white text-slate-800"
                          }`}
                        >
                          <div
                            className={`mb-1 text-xs ${mine ? "text-blue-100" : "text-slate-400"}`}
                          >
                            {mine ? "我" : item.senderNickname} ·{" "}
                            {formatMessageTime(item.createdAt)}
                          </div>
                          {renderMessageContent(item.content)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-100 bg-white px-6 py-4">
                  <input
                    ref={privateImageInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    className="hidden"
                    onChange={handlePrivateImageChange}
                  />
                  <TextArea
                    value={privateDraft}
                    onChange={(event) => setPrivateDraft(event.target.value)}
                    onPaste={handlePrivatePaste}
                    placeholder={
                      activeUser
                        ? `发消息给 ${activeUser.nickname}`
                        : "请先选择在线用户"
                    }
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    maxLength={CHAT_DRAFT_MAX_LENGTH}
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
                    <div
                      className={`text-xs ${privateDraft.length > CHAT_DRAFT_MAX_LENGTH * 0.9 ? "text-amber-600" : "text-slate-400"}`}
                    >
                      {privateDraft.length}/{CHAT_DRAFT_MAX_LENGTH}
                    </div>
                    <div className="flex items-center gap-2">
                      <Popover
                        trigger="click"
                        placement="topRight"
                        content={renderEmojiPanel(
                          CHAT_EMOJIS,
                          appendPrivateEmoji,
                        )}
                      >
                        <Button
                          icon={<SmileOutlined />}
                          disabled={!activeUser}
                          aria-label="插入表情"
                          title="插入表情"
                        />
                      </Popover>
                      <Button
                        icon={<PictureOutlined />}
                        loading={uploadingPrivateImage}
                        disabled={!activeUser || uploadingPrivateImage}
                        aria-label="发送图片"
                        title="发送图片"
                        onClick={() => privateImageInputRef.current?.click()}
                      />
                      <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={sendingPrivateMessage}
                        onClick={() => void handleSendPrivate()}
                        disabled={!canSendPrivateMessage}
                      >
                        发送
                      </Button>
                    </div>
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

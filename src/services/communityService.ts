import { API_BASE_URL } from "./api";
import type { ChatMessage, TalkComment, TalkPost } from "../lib/community";
import type { ChatPresenceMode, PrivateChatMessage, PrivateChatUser } from "../types/app";

type ChatMessageResponse = {
  id: number;
  roomId: string;
  author: string;
  avatarSeed?: string | null;
  content: string;
  createdAt: number;
};

type TalkCommentResponse = {
  id: number;
  postId: number;
  author: string;
  content: string;
  createdAt: number;
};

type TalkPostResponse = {
  id: number;
  author: string;
  avatarSeed?: string | null;
  content: string;
  category?: string | null;
  createdAt: number;
  likes?: number | null;
  pinned?: boolean | null;
  comments?: TalkCommentResponse[] | null;
};

type PrivateChatUserResponse = {
  id: number;
  nickname: string;
  avatarUrl?: string | null;
  bio?: string | null;
  online: boolean;
};

type PrivateChatMessageResponse = {
  id: number;
  senderId: number;
  senderNickname: string;
  senderAvatarUrl?: string | null;
  recipientId: number;
  content: string;
  createdAt: number;
};

type ChatPresenceModeResponse = {
  mode: string;
};

interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

function getBrowserOrigin() {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

function getApiBaseUrl() {
  return API_BASE_URL || getBrowserOrigin();
}

function buildUrl(path: string) {
  return new URL(path, getApiBaseUrl()).toString();
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("服务器返回了无法解析的数据");
  }
}

async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const requestHeaders = new Headers(headers ?? {});
  const token = typeof window === "undefined" ? null : window.localStorage.getItem("token");

  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    ...rest,
    headers: requestHeaders,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const parsed = text ? safeParseJson(text) : null;

  if (!response.ok) {
    const errorMessage =
      parsed && typeof parsed === "object" && "message" in parsed
        ? String((parsed as { message?: string }).message ?? "请求失败")
        : response.statusText || "请求失败";
    throw new Error(errorMessage);
  }

  return parsed as T;
}

function mapChatMessage(item: ChatMessageResponse): ChatMessage {
  return {
    id: String(item.id),
    roomId: item.roomId,
    author: item.author,
    avatarSeed: item.avatarSeed || item.author,
    content: item.content,
    createdAt: item.createdAt,
  };
}

function mapTalkComment(item: TalkCommentResponse): TalkComment {
  return {
    id: String(item.id),
    author: item.author,
    content: item.content,
    createdAt: item.createdAt,
  };
}

function mapTalkPost(item: TalkPostResponse): TalkPost {
  return {
    id: String(item.id),
    author: item.author,
    avatarSeed: item.avatarSeed || item.author,
    content: item.content,
    category: (item.category || "闲聊摸鱼") as TalkPost["category"],
    createdAt: item.createdAt,
    likes: item.likes ?? 0,
    pinned: Boolean(item.pinned),
    comments: (item.comments ?? []).map(mapTalkComment),
  };
}

function mapPrivateChatUser(item: PrivateChatUserResponse): PrivateChatUser {
  return {
    id: item.id,
    nickname: item.nickname,
    avatarUrl: item.avatarUrl ?? null,
    bio: item.bio ?? null,
    online: Boolean(item.online),
  };
}

function mapPrivateChatMessage(item: PrivateChatMessageResponse): PrivateChatMessage {
  return {
    id: item.id,
    senderId: item.senderId,
    senderNickname: item.senderNickname,
    senderAvatarUrl: item.senderAvatarUrl ?? null,
    recipientId: item.recipientId,
    content: item.content,
    createdAt: item.createdAt,
  };
}

function normalizePresenceMode(mode: string | null | undefined): ChatPresenceMode {
  return mode === "INVISIBLE" ? "INVISIBLE" : "ONLINE";
}

export async function fetchChatMessages(roomId: string): Promise<ChatMessage[]> {
  const items = await request<ChatMessageResponse[]>(`/api/community/chat/rooms/${encodeURIComponent(roomId)}/messages`);
  return items.map(mapChatMessage);
}

export async function sendChatMessage(payload: {
  roomId: string;
  author: string;
  avatarSeed?: string;
  content: string;
}): Promise<ChatMessage> {
  const item = await request<ChatMessageResponse>("/api/community/chat/messages", {
    method: "POST",
    body: payload,
  });
  return mapChatMessage(item);
}

export async function clearChatMessages(roomId: string): Promise<void> {
  await request<void>(`/api/community/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: "DELETE",
  });
}

export async function fetchOnlinePrivateChatUsers(): Promise<PrivateChatUser[]> {
  const items = await request<PrivateChatUserResponse[]>("/api/community/private/users");
  return items.map(mapPrivateChatUser);
}

export async function fetchPrivateMessages(targetUserId: number): Promise<PrivateChatMessage[]> {
  const items = await request<PrivateChatMessageResponse[]>(
    `/api/community/private/messages/${encodeURIComponent(String(targetUserId))}`,
  );
  return items.map(mapPrivateChatMessage);
}

export async function sendPrivateMessage(payload: {
  recipientUserId: number;
  content: string;
}): Promise<PrivateChatMessage> {
  const item = await request<PrivateChatMessageResponse>("/api/community/private/messages", {
    method: "POST",
    body: payload,
  });
  return mapPrivateChatMessage(item);
}

export async function getChatPresenceMode(): Promise<ChatPresenceMode> {
  const item = await request<ChatPresenceModeResponse>("/api/community/private/presence");
  return normalizePresenceMode(item.mode);
}

export async function updateChatPresenceMode(mode: ChatPresenceMode): Promise<ChatPresenceMode> {
  const item = await request<ChatPresenceModeResponse>("/api/community/private/presence", {
    method: "PUT",
    body: { mode },
  });
  return normalizePresenceMode(item.mode);
}

export async function fetchTalkPosts(): Promise<TalkPost[]> {
  const items = await request<TalkPostResponse[]>("/api/community/talk/posts");
  return items.map(mapTalkPost);
}

export async function publishTalkPost(payload: {
  author: string;
  avatarSeed?: string;
  content: string;
  category: string;
}): Promise<TalkPost> {
  const item = await request<TalkPostResponse>("/api/community/talk/posts", {
    method: "POST",
    body: payload,
  });
  return mapTalkPost(item);
}

export async function likeTalkPost(postId: string | number): Promise<TalkPost> {
  const item = await request<TalkPostResponse>(`/api/community/talk/posts/${encodeURIComponent(String(postId))}/like`, {
    method: "POST",
  });
  return mapTalkPost(item);
}

export async function deleteTalkPost(postId: string | number, author: string): Promise<void> {
  const params = new URLSearchParams({ author });
  await request<void>(`/api/community/talk/posts/${encodeURIComponent(String(postId))}?${params.toString()}`, {
    method: "DELETE",
  });
}

export async function addTalkComment(
  postId: string | number,
  payload: {
    author: string;
    content: string;
  },
): Promise<TalkComment> {
  const item = await request<TalkCommentResponse>(`/api/community/talk/posts/${encodeURIComponent(String(postId))}/comments`, {
    method: "POST",
    body: payload,
  });
  return mapTalkComment(item);
}

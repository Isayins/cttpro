import { apiRequest, type RequestOptions } from "./api/client";
import type { ChatMessage, TalkComment, TalkPost } from "../lib/community";
import { resolveAssetUrl } from "../lib/media";
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
  blocked: boolean;
  unreadCount?: number | null;
  lastMessageAt?: number | null;
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

type UploadedChatImageResponse = {
  url: string;
  originalFileName?: string | null;
};

const IMAGE_UPLOAD_TIMEOUT_MS = 60_000;

type CommunityRequestOptions = Omit<RequestOptions, "authMode">;

export type CommunityReportTarget = {
  targetType: "CHAT_MESSAGE" | "TALK_POST";
  targetId: number;
  label: string;
};

function request<T>(path: string, options: CommunityRequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, {
    authMode: "required",
    ...options,
  });
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
    avatarUrl: resolveAssetUrl(item.avatarUrl) ?? null,
    bio: item.bio ?? null,
    online: Boolean(item.online),
    blocked: Boolean(item.blocked),
    unreadCount: item.unreadCount ?? 0,
    lastMessageAt: item.lastMessageAt ?? null,
  };
}

function mapPrivateChatMessage(item: PrivateChatMessageResponse): PrivateChatMessage {
  return {
    id: item.id,
    senderId: item.senderId,
    senderNickname: item.senderNickname,
    senderAvatarUrl: resolveAssetUrl(item.senderAvatarUrl) ?? null,
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
  content: string;
}): Promise<ChatMessage> {
  const item = await request<ChatMessageResponse>("/api/community/chat/messages", {
    method: "POST",
    body: payload,
  });
  return mapChatMessage(item);
}

export async function uploadChatImage(file: File): Promise<UploadedChatImageResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return request<UploadedChatImageResponse>("/api/community/chat/images", {
    method: "POST",
    body: formData,
    timeoutMs: IMAGE_UPLOAD_TIMEOUT_MS,
  });
}

export async function clearChatMessages(roomId: string): Promise<void> {
  await request<void>(`/api/community/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: "DELETE",
  });
}

export async function reportCommunityContent(payload: {
  targetType: CommunityReportTarget["targetType"];
  targetId: number;
  reason: string;
  detail?: string;
}): Promise<void> {
  await request<void>("/api/community/reports", {
    method: "POST",
    body: payload,
  });
}

export async function fetchPrivateChatUsers(): Promise<PrivateChatUser[]> {
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

export async function blockPrivateChatUser(targetUserId: number): Promise<void> {
  await request<void>(`/api/community/private/users/${encodeURIComponent(String(targetUserId))}/block`, {
    method: "POST",
  });
}

export async function unblockPrivateChatUser(targetUserId: number): Promise<void> {
  await request<void>(`/api/community/private/users/${encodeURIComponent(String(targetUserId))}/block`, {
    method: "DELETE",
  });
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

export async function deleteTalkPost(postId: string | number): Promise<void> {
  await request<void>(`/api/community/talk/posts/${encodeURIComponent(String(postId))}`, {
    method: "DELETE",
  });
}

export async function addTalkComment(
  postId: string | number,
  payload: {
    content: string;
  },
): Promise<TalkComment> {
  const item = await request<TalkCommentResponse>(`/api/community/talk/posts/${encodeURIComponent(String(postId))}/comments`, {
    method: "POST",
    body: payload,
  });
  return mapTalkComment(item);
}

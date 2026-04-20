export type TalkCategory = "全部" | "技术交流" | "求助答疑" | "闲聊摸鱼" | "资源分享" | "生活杂谈";

export interface TalkComment {
  id: string;
  author: string;
  content: string;
  createdAt: number;
}

export interface TalkPost {
  id: string;
  author: string;
  avatarSeed: string;
  content: string;
  category: Exclude<TalkCategory, "全部">;
  createdAt: number;
  likes: number;
  pinned: boolean;
  comments: TalkComment[];
}

export interface ChatRoom {
  id: string;
  name: string;
  description: string;
  topic: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  author: string;
  avatarSeed: string;
  content: string;
  createdAt: number;
}

export interface CommunityProfile {
  nickname: string;
  avatarSeed: string;
}

const CHAT_PROFILE_KEY = "idncar.chat.profile.v1";

export const talkCategories: Exclude<TalkCategory, "全部">[] = [
  "技术交流",
  "求助答疑",
  "闲聊摸鱼",
  "资源分享",
  "生活杂谈",
];

export const chatRooms: ChatRoom[] = [
  {
    id: "general",
    name: "IDNCAR 广场",
    description: "适合日常聊天、打招呼和快速交流。",
    topic: "大家今天有什么想聊的？",
  },
  {
    id: "tech",
    name: "技术讨论",
    description: "代码、框架、部署和排错都可以放这里。",
    topic: "遇到什么开发问题，直接发出来。",
  },
  {
    id: "help",
    name: "互助答疑",
    description: "发需求、问问题、求建议的专用房间。",
    topic: "说清楚问题，我们一起想办法。",
  },
  {
    id: "chill",
    name: "摸鱼闲聊",
    description: "轻松一点，聊点有趣的内容。",
    topic: "今天摸鱼进度如何？",
  },
];

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function readChatProfile(): CommunityProfile {
  const storage = getStorage();
  const fallback: CommunityProfile = {
    nickname: "匿名游客",
    avatarSeed: "匿名游客",
  };

  return safeJsonParse<CommunityProfile>(storage?.getItem(CHAT_PROFILE_KEY) ?? null, fallback);
}

export function writeChatProfile(profile: CommunityProfile) {
  const storage = getStorage();
  storage?.setItem(CHAT_PROFILE_KEY, JSON.stringify(profile));
}

export function formatTime(value: number) {
  const date = new Date(value);
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

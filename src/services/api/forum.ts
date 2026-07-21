import type {
  CreatePostPayload,
  CreatePostReportPayload,
  ForumBoard,
  ForumBoardLevelTitle,
  ForumBoardOwnerApplication,
  ForumBoardOwnerApplicationStatus,
  ForumLeaderboard,
  ForumPostFilters,
  ForumSignInStatus,
  PageResult,
  Post,
  Reply,
  SaveForumBoardPayload,
} from "../../types/app";
import { apiRequest } from "./client";

function normalizePostsResponse(response: PageResult<Post> | Post[]) {
  return Array.isArray(response) ? response : Array.isArray(response.records) ? response.records : [];
}

function getPostsResponse(filters: ForumPostFilters = {}) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page ?? 1));
  params.set("size", String(filters.size ?? 30));
  if (filters.keyword) params.set("keyword", filters.keyword);
  if (filters.category) params.set("category", filters.category);
  if (filters.mine) params.set("mine", "true");
  if (filters.favorites) params.set("favorites", "true");

  return apiRequest<PageResult<Post> | Post[]>(`/api/forum/posts?${params.toString()}`, {
    authMode: "optional",
    timeoutMs: 7000,
  });
}

function normalizePostsPage(response: PageResult<Post> | Post[], filters: ForumPostFilters): PageResult<Post> {
  if (Array.isArray(response)) {
    return {
      records: response,
      total: response.length,
      page: filters.page ?? 1,
      size: filters.size ?? 30,
    };
  }
  return {
    records: Array.isArray(response.records) ? response.records : [],
    total: Number.isFinite(response.total) ? response.total : 0,
    page: response.page ?? filters.page ?? 1,
    size: response.size ?? filters.size ?? 30,
  };
}

export const forumApi = {
  getBoards: (options: { includeInactive?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (options.includeInactive) params.set("includeInactive", "true");
    const query = params.toString();
    return apiRequest<ForumBoard[]>(`/api/forum/boards${query ? `?${query}` : ""}`, {
      authMode: options.includeInactive ? "required" : "optional",
      timeoutMs: 7000,
    });
  },
  createBoard: (payload: SaveForumBoardPayload) =>
    apiRequest<ForumBoard>("/api/forum/boards", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  updateBoard: (boardId: number, payload: SaveForumBoardPayload) =>
    apiRequest<ForumBoard>(`/api/forum/boards/${boardId}`, {
      method: "PUT",
      authMode: "required",
      body: payload,
    }),
  updateBoardLevelTitles: (boardId: number, titles: ForumBoardLevelTitle[]) =>
    apiRequest<ForumBoard>(`/api/forum/boards/${boardId}/level-titles`, {
      method: "PUT",
      authMode: "required",
      body: { titles },
    }),
  applyBoardOwner: (boardId: number, payload: { reason: string }) =>
    apiRequest<ForumBoardOwnerApplication>(`/api/forum/boards/${boardId}/owner-applications`, {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  getMyBoardOwnerApplications: (options: { status?: ForumBoardOwnerApplicationStatus } = {}) => {
    const params = new URLSearchParams();
    if (options.status) params.set("status", options.status);
    const query = params.toString();
    return apiRequest<ForumBoardOwnerApplication[]>(`/api/forum/board-owner-applications/mine${query ? `?${query}` : ""}`, {
      authMode: "required",
      timeoutMs: 7000,
    });
  },
  getBoardOwnerApplications: (options: { status?: ForumBoardOwnerApplicationStatus } = {}) => {
    const params = new URLSearchParams();
    if (options.status) params.set("status", options.status);
    const query = params.toString();
    return apiRequest<ForumBoardOwnerApplication[]>(`/api/forum/board-owner-applications${query ? `?${query}` : ""}`, {
      authMode: "required",
      timeoutMs: 7000,
    });
  },
  reviewBoardOwnerApplication: (applicationId: number, payload: { approved: boolean; reviewNote?: string | null }) =>
    apiRequest<ForumBoardOwnerApplication>(`/api/forum/board-owner-applications/${applicationId}/review`, {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  uploadBoardAvatar: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<{ url: string; originalFileName?: string }>("/api/forum/boards/avatar", {
      method: "POST",
      authMode: "required",
      body: formData,
      timeoutMs: 60_000,
    });
  },
  getPosts: (filters: ForumPostFilters = {}) => getPostsResponse(filters).then(normalizePostsResponse),
  getPostsPage: (filters: ForumPostFilters = {}) =>
    getPostsResponse(filters).then((response) => normalizePostsPage(response, filters)),
  getPost: (postId: number) =>
    apiRequest<Post>(`/api/forum/posts/${postId}`, {
      authMode: "optional",
    }),
  createPost: (payload: CreatePostPayload) =>
    apiRequest<Post>("/api/forum/posts", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  updatePost: (postId: number, payload: CreatePostPayload) =>
    apiRequest<Post>(`/api/forum/posts/${postId}`, {
      method: "PUT",
      authMode: "required",
      body: payload,
    }),
  deletePost: (postId: number) =>
    apiRequest<void>(`/api/forum/posts/${postId}`, {
      method: "DELETE",
      authMode: "required",
    }),
  getReplies: (postId: number, page = 1, size = 20) =>
    apiRequest<Reply[]>(`/api/forum/posts/${postId}/replies?page=${page}&size=${size}`, {
      authMode: "optional",
    }),
  createReply: (postId: number, payload: { content: string }) =>
    apiRequest<Reply>(`/api/forum/posts/${postId}/replies`, {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  toggleLike: (postId: number) =>
    apiRequest<Post>(`/api/forum/posts/${postId}/like`, {
      method: "POST",
      authMode: "required",
    }),
  toggleFavorite: (postId: number) =>
    apiRequest<Post>(`/api/forum/posts/${postId}/favorite`, {
      method: "POST",
      authMode: "required",
    }),
  updatePin: (postId: number, pinned: boolean) =>
    apiRequest<Post>(`/api/forum/posts/${postId}/pin?pinned=${String(pinned)}`, {
      method: "POST",
      authMode: "required",
    }),
  reportPost: (postId: number, payload: CreatePostReportPayload) =>
    apiRequest<{ message: string }>(`/api/forum/posts/${postId}/report`, {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<{ url: string; originalFileName?: string }>("/api/forum/images", {
      method: "POST",
      authMode: "required",
      body: formData,
      timeoutMs: 60_000,
    });
  },
  getLeaderboard: (options: { boardId?: number | null } = {}) => {
    const params = new URLSearchParams();
    if (options.boardId) params.set("boardId", String(options.boardId));
    const query = params.toString();
    return apiRequest<ForumLeaderboard>(`/api/forum/leaderboard${query ? `?${query}` : ""}`, {
      authMode: "optional",
      timeoutMs: 7000,
    });
  },
  getSignInStatus: (options: { boardId?: number | null } = {}) => {
    const params = new URLSearchParams();
    if (options.boardId) params.set("boardId", String(options.boardId));
    const query = params.toString();
    return apiRequest<ForumSignInStatus>(`/api/forum/sign-in/status${query ? `?${query}` : ""}`, {
      authMode: "required",
    });
  },
  signIn: (options: { boardId?: number | null } = {}) => {
    const params = new URLSearchParams();
    if (options.boardId) params.set("boardId", String(options.boardId));
    const query = params.toString();
    return apiRequest<ForumSignInStatus>(`/api/forum/sign-in${query ? `?${query}` : ""}`, {
      method: "POST",
      authMode: "required",
    });
  },
};

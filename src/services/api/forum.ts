import type { CreatePostPayload, CreatePostReportPayload, ForumPostFilters, Post, Reply } from "../../types/app";
import { apiRequest } from "./client";

export const forumApi = {
  getPosts: (filters: ForumPostFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.category) params.set("category", filters.category);
    if (filters.mine) params.set("mine", "true");
    if (filters.favorites) params.set("favorites", "true");

    const query = params.toString();
    return apiRequest<Post[]>(`/api/forum/posts${query ? `?${query}` : ""}`, {
      authMode: "optional",
    });
  },
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
  getReplies: (postId: number) =>
    apiRequest<Reply[]>(`/api/forum/posts/${postId}/replies`, {
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
};

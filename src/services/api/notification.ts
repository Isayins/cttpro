import type { UserNotification } from "../../types/app";
import { apiRequest } from "./client";

export const notificationApi = {
  getNotifications: (limit = 20) =>
    apiRequest<UserNotification[]>(`/api/notifications?limit=${limit}`, {
      authMode: "required",
    }),
  getUnreadCount: () =>
    apiRequest<{ count: number }>("/api/notifications/unread-count", {
      authMode: "required",
    }),
  markRead: (id: number) =>
    apiRequest<void>(`/api/notifications/${id}/read`, {
      method: "POST",
      authMode: "required",
    }),
  markAllRead: () =>
    apiRequest<void>("/api/notifications/read-all", {
      method: "POST",
      authMode: "required",
    }),
};

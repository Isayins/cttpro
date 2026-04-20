import type {
  AdminOperationLog,
  AdminPostReport,
  AdminUpdateUserPayload,
  CreateDownloadResourcePayload,
  DownloadResource,
  InviteCode,
  QrCodeItem,
  QrScanLog,
  ReviewPostReportPayload,
  SaveQrCodePayload,
  SaveSiteNoticePayload,
  SiteAnalyticsOverview,
  SiteNotice,
  UploadedDownloadFile,
  User,
} from "../../types/app";
import { apiRequest } from "./client";

export const adminApi = {
  getUsers: () =>
    apiRequest<User[]>("/api/admin/users", {
      authMode: "required",
    }),
  updateUser: (userId: number, payload: AdminUpdateUserPayload) =>
    apiRequest<User>(`/api/admin/users/${userId}`, {
      method: "PUT",
      authMode: "required",
      body: payload,
    }),
  deleteUser: (userId: number) =>
    apiRequest<void>(`/api/admin/users/${userId}`, {
      method: "DELETE",
      authMode: "required",
    }),
  getInviteCodes: () =>
    apiRequest<InviteCode[]>("/api/admin/invite-codes", {
      authMode: "required",
    }),
  createInviteCodes: (payload: { count: number; expiresInDays: number }) =>
    apiRequest<InviteCode[]>("/api/admin/invite-codes", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  deleteInviteCode: (inviteCodeId: number) =>
    apiRequest<void>(`/api/admin/invite-codes/${inviteCodeId}`, {
      method: "DELETE",
      authMode: "required",
    }),
  createDownload: (payload: CreateDownloadResourcePayload) =>
    apiRequest<DownloadResource>("/api/admin/downloads", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  uploadDownloadFile: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<UploadedDownloadFile>("/api/admin/downloads/upload", {
      method: "POST",
      authMode: "required",
      body: formData,
    });
  },
  deleteDownload: (downloadId: number) =>
    apiRequest<void>(`/api/admin/downloads/${downloadId}`, {
      method: "DELETE",
      authMode: "required",
    }),
  getSiteNotices: () =>
    apiRequest<SiteNotice[]>("/api/admin/site-notices", {
      authMode: "required",
    }),
  createSiteNotice: (payload: SaveSiteNoticePayload) =>
    apiRequest<SiteNotice>("/api/admin/site-notices", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  updateSiteNotice: (noticeId: number, payload: SaveSiteNoticePayload) =>
    apiRequest<SiteNotice>(`/api/admin/site-notices/${noticeId}`, {
      method: "PUT",
      authMode: "required",
      body: payload,
    }),
  deleteSiteNotice: (noticeId: number) =>
    apiRequest<void>(`/api/admin/site-notices/${noticeId}`, {
      method: "DELETE",
      authMode: "required",
    }),
  getAnalyticsOverview: () =>
    apiRequest<SiteAnalyticsOverview>("/api/admin/analytics/overview", {
      authMode: "required",
    }),
  getPostReports: (status?: string) =>
    apiRequest<AdminPostReport[]>(`/api/admin/post-reports${status ? `?status=${encodeURIComponent(status)}` : ""}`, {
      authMode: "required",
    }),
  reviewPostReport: (reportId: number, payload: ReviewPostReportPayload) =>
    apiRequest<AdminPostReport>(`/api/admin/post-reports/${reportId}`, {
      method: "PUT",
      authMode: "required",
      body: payload,
    }),
  getOperationLogs: (limit = 40) =>
    apiRequest<AdminOperationLog[]>(`/api/admin/operation-logs?limit=${limit}`, {
      authMode: "required",
    }),
  getQrCodes: () =>
    apiRequest<QrCodeItem[]>("/api/admin/qr-codes", {
      authMode: "required",
    }),
  createQrCode: (payload: SaveQrCodePayload) =>
    apiRequest<QrCodeItem>("/api/admin/qr-codes", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  updateQrCode: (id: number, payload: SaveQrCodePayload) =>
    apiRequest<QrCodeItem>(`/api/admin/qr-codes/${id}`, {
      method: "PUT",
      authMode: "required",
      body: payload,
    }),
  deleteQrCode: (id: number) =>
    apiRequest<void>(`/api/admin/qr-codes/${id}`, {
      method: "DELETE",
      authMode: "required",
    }),
  getQrScanLogs: (id: number, limit = 20) =>
    apiRequest<QrScanLog[]>(`/api/admin/qr-codes/${id}/scan-logs?limit=${limit}`, {
      authMode: "required",
    }),
};

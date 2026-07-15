import type {
  AdminDownloadStats,
  AdminInviteStats,
  AdminOperationLog,
  AdminPaymentOrder,
  AdminPaymentOrderStats,
  AdminPostReport,
  AdminPostReportStats,
  AdminProductCouponStats,
  AdminProductDeliveryCodeStats,
  AdminProductStats,
  AdminSiteNoticeStats,
  AdminUpdateUserPayload,
  AdminUserStats,
  CreateProductCouponCodesPayload,
  CreateDownloadResourcePayload,
  ImportProductDeliveryCodesPayload,
  ImportProductDeliveryCodesResponse,
  DownloadResource,
  InviteCode,
  PageResult,
  Product,
  ProductCouponCode,
  ProductDeliveryCode,
  QrCodeItem,
  QrScanLog,
  ReviewPostReportPayload,
  SaveProductPayload,
  SaveQrCodePayload,
  SaveSiteNoticePayload,
  SaveVmqPaymentSettingsPayload,
  SiteAnalyticsOverview,
  SiteNotice,
  UploadedDownloadFile,
  UploadedProductImage,
  User,
  VmqPaymentSettings,
} from "../../types/app";
import { getAuthToken } from "../authToken";
import { apiRequest, buildApiRequestUrl } from "./client";

export const adminApi = {
  getUsers: () =>
    apiRequest<User[]>("/api/admin/users", {
      authMode: "required",
    }),
  getUsersPage: (params: { page?: number; size?: number; keyword?: string; role?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("size", String(params.size ?? 10));
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    if (params.role && params.role !== "ALL") {
      query.set("role", params.role);
    }
    if (params.status && params.status !== "ALL") {
      query.set("status", params.status);
    }
    return apiRequest<PageResult<User>>(`/api/admin/users/page?${query.toString()}`, {
      authMode: "required",
    });
  },
  getUserStats: () =>
    apiRequest<AdminUserStats>("/api/admin/users/stats", {
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
  getInviteCodesPage: (params: { page?: number; size?: number; keyword?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("size", String(params.size ?? 10));
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    if (params.status && params.status !== "ALL") {
      query.set("status", params.status);
    }
    return apiRequest<PageResult<InviteCode>>(`/api/admin/invite-codes/page?${query.toString()}`, {
      authMode: "required",
    });
  },
  getInviteCodeStats: () =>
    apiRequest<AdminInviteStats>("/api/admin/invite-codes/stats", {
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
  getDownloadsPage: (params: { page?: number; size?: number; keyword?: string; mode?: string } = {}) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("size", String(params.size ?? 10));
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    if (params.mode && params.mode !== "ALL") {
      query.set("mode", params.mode);
    }
    return apiRequest<PageResult<DownloadResource>>(`/api/admin/downloads/page?${query.toString()}`, {
      authMode: "required",
    });
  },
  getDownloadStats: () =>
    apiRequest<AdminDownloadStats>("/api/admin/downloads/stats", {
      authMode: "required",
    }),
  createDownload: (payload: CreateDownloadResourcePayload) =>
    apiRequest<DownloadResource>("/api/admin/downloads", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  updateDownload: (downloadId: number, payload: CreateDownloadResourcePayload) =>
    apiRequest<DownloadResource>(`/api/admin/downloads/${downloadId}`, {
      method: "PUT",
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
      timeoutMs: 900_000,
    });
  },
  deleteDownload: (downloadId: number) =>
    apiRequest<void>(`/api/admin/downloads/${downloadId}`, {
      method: "DELETE",
      authMode: "required",
    }),
  getProducts: () =>
    apiRequest<Product[]>("/api/admin/products", {
      authMode: "required",
    }),
  getProductsPage: (params: { page?: number; size?: number; keyword?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("size", String(params.size ?? 10));
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    if (params.status && params.status !== "ALL") {
      query.set("status", params.status);
    }
    return apiRequest<PageResult<Product>>(`/api/admin/products/page?${query.toString()}`, {
      authMode: "required",
    });
  },
  getProductStats: () =>
    apiRequest<AdminProductStats>("/api/admin/products/stats", {
      authMode: "required",
    }),
  createProduct: (payload: SaveProductPayload) =>
    apiRequest<Product>("/api/admin/products", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  updateProduct: (productId: number, payload: SaveProductPayload) =>
    apiRequest<Product>(`/api/admin/products/${productId}`, {
      method: "PUT",
      authMode: "required",
      body: payload,
    }),
  uploadProductImage: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<UploadedProductImage>("/api/admin/products/images", {
      method: "POST",
      authMode: "required",
      body: formData,
      timeoutMs: 60_000,
    });
  },
  deleteProduct: (productId: number) =>
    apiRequest<void>(`/api/admin/products/${productId}`, {
      method: "DELETE",
      authMode: "required",
    }),
  getProductDeliveryCodes: (params: { page?: number; size?: number; keyword?: string; productId?: number | string; status?: string } = {}) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("size", String(params.size ?? 8));
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    if (params.productId && params.productId !== "ALL") {
      query.set("productId", String(params.productId));
    }
    if (params.status && params.status !== "ALL") {
      query.set("status", params.status);
    }
    return apiRequest<PageResult<ProductDeliveryCode>>(`/api/admin/product-delivery-codes?${query.toString()}`, {
      authMode: "required",
    });
  },
  getProductDeliveryCodeStats: () =>
    apiRequest<AdminProductDeliveryCodeStats>("/api/admin/product-delivery-codes/stats", {
      authMode: "required",
    }),
  importProductDeliveryCodes: (payload: ImportProductDeliveryCodesPayload) =>
    apiRequest<ImportProductDeliveryCodesResponse>("/api/admin/product-delivery-codes/import", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  disableProductDeliveryCode: (codeId: number) =>
    apiRequest<ProductDeliveryCode>(`/api/admin/product-delivery-codes/${codeId}/disable`, {
      method: "PATCH",
      authMode: "required",
    }),
  resendProductDeliveryCode: (codeId: number) =>
    apiRequest<ProductDeliveryCode>(`/api/admin/product-delivery-codes/${codeId}/resend`, {
      method: "PATCH",
      authMode: "required",
    }),
  disableProductDeliveryCodeBatch: (batchNo: string) =>
    apiRequest<ProductDeliveryCode[]>(`/api/admin/product-delivery-codes/batches/${encodeURIComponent(batchNo)}/disable`, {
      method: "PATCH",
      authMode: "required",
    }),
  exportProductDeliveryCodes: async (params: { keyword?: string; productId?: number | string; status?: string } = {}) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("请先登录");
    }
    const query = new URLSearchParams();
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    if (params.productId && params.productId !== "ALL") {
      query.set("productId", String(params.productId));
    }
    if (params.status && params.status !== "ALL") {
      query.set("status", params.status);
    }
    const response = await fetch(buildApiRequestUrl(`/api/admin/product-delivery-codes/export?${query.toString()}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const text = await response.text();
      if (!text) {
        throw new Error(response.statusText || "导出CDK失败");
      }
      let errorMessage = text;
      try {
        const errorData = JSON.parse(text) as { message?: string; detail?: string; error?: string };
        errorMessage = errorData.message || errorData.detail || errorData.error || errorMessage;
      } catch {
        // Keep plain text errors readable.
      }
      throw new Error(errorMessage);
    }
    return response.blob();
  },
  getProductCouponCodes: (params: { page?: number; size?: number; keyword?: string; productId?: number | string; status?: string } = {}) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("size", String(params.size ?? 8));
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    if (params.productId && params.productId !== "ALL") {
      query.set("productId", String(params.productId));
    }
    if (params.status && params.status !== "ALL") {
      query.set("status", params.status);
    }
    return apiRequest<PageResult<ProductCouponCode>>(`/api/admin/product-coupon-codes?${query.toString()}`, {
      authMode: "required",
    });
  },
  getProductCouponStats: () =>
    apiRequest<AdminProductCouponStats>("/api/admin/product-coupon-codes/stats", {
      authMode: "required",
    }),
  createProductCouponCodes: (payload: CreateProductCouponCodesPayload) =>
    apiRequest<ProductCouponCode[]>("/api/admin/product-coupon-codes", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  disableProductCouponCode: (couponCodeId: number) =>
    apiRequest<ProductCouponCode>(`/api/admin/product-coupon-codes/${couponCodeId}/disable`, {
      method: "PATCH",
      authMode: "required",
    }),
  disableProductCouponBatch: (batchNo: string) =>
    apiRequest<ProductCouponCode[]>(`/api/admin/product-coupon-codes/batches/${encodeURIComponent(batchNo)}/disable`, {
      method: "PATCH",
      authMode: "required",
    }),
  exportProductCouponCodes: async (params: { keyword?: string; productId?: number | string; status?: string } = {}) => {
    const token = getAuthToken();
    if (!token) {
      throw new Error("请先登录");
    }
    const query = new URLSearchParams();
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    if (params.productId && params.productId !== "ALL") {
      query.set("productId", String(params.productId));
    }
    if (params.status && params.status !== "ALL") {
      query.set("status", params.status);
    }
    const response = await fetch(buildApiRequestUrl(`/api/admin/product-coupon-codes/export?${query.toString()}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const text = await response.text();
      if (!text) {
        throw new Error(response.statusText || "导出优惠码失败");
      }
      let errorMessage = text;
      try {
        const errorData = JSON.parse(text) as { message?: string; detail?: string; error?: string };
        errorMessage = errorData.message || errorData.detail || errorData.error || errorMessage;
      } catch {
        // Keep plain text errors readable.
      }
      throw new Error(errorMessage);
    }
    return response.blob();
  },
  getPaymentOrders: (params: { page?: number; size?: number; keyword?: string; status?: string; resourceType?: string; hasError?: boolean; hasCoupon?: boolean } = {}) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("size", String(params.size ?? 8));
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    if (params.status && params.status !== "ALL") {
      query.set("status", params.status);
    }
    if (params.resourceType && params.resourceType !== "ALL") {
      query.set("resourceType", params.resourceType);
    }
    if (typeof params.hasError === "boolean") {
      query.set("hasError", String(params.hasError));
    }
    if (typeof params.hasCoupon === "boolean") {
      query.set("hasCoupon", String(params.hasCoupon));
    }
    return apiRequest<PageResult<AdminPaymentOrder>>(`/api/admin/payment-orders?${query.toString()}`, {
      authMode: "required",
    });
  },
  getPaymentOrderStats: () =>
    apiRequest<AdminPaymentOrderStats>("/api/admin/payment-orders/stats", {
      authMode: "required",
    }),
  syncPaymentOrder: (outTradeNo: string) =>
    apiRequest<AdminPaymentOrder>(`/api/admin/payment-orders/${encodeURIComponent(outTradeNo)}/sync`, {
      method: "POST",
      authMode: "required",
    }),
  closePaymentOrder: (outTradeNo: string) =>
    apiRequest<AdminPaymentOrder>(`/api/admin/payment-orders/${encodeURIComponent(outTradeNo)}/close`, {
      method: "POST",
      authMode: "required",
    }),
  manualConfirmPaymentOrder: (outTradeNo: string, payload: { note?: string } = {}) =>
    apiRequest<AdminPaymentOrder>(`/api/admin/payment-orders/${encodeURIComponent(outTradeNo)}/manual-confirm`, {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  resendPaymentOrderDelivery: (outTradeNo: string) =>
    apiRequest<AdminPaymentOrder>(`/api/admin/payment-orders/${encodeURIComponent(outTradeNo)}/resend-delivery`, {
      method: "POST",
      authMode: "required",
    }),
  resolvePaymentOrder: (outTradeNo: string, payload: { note?: string }) =>
    apiRequest<AdminPaymentOrder>(`/api/admin/payment-orders/${encodeURIComponent(outTradeNo)}/resolve`, {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  getVmqPaymentSettings: () =>
    apiRequest<VmqPaymentSettings>("/api/admin/payments/vmq/settings", {
      authMode: "required",
    }),
  saveVmqPaymentSettings: (payload: SaveVmqPaymentSettingsPayload) =>
    apiRequest<VmqPaymentSettings>("/api/admin/payments/vmq/settings", {
      method: "PUT",
      authMode: "required",
      body: payload,
    }),
  regenerateVmqPaymentKey: () =>
    apiRequest<VmqPaymentSettings>("/api/admin/payments/vmq/settings/key", {
      method: "POST",
      authMode: "required",
    }),
  getSiteNotices: () =>
    apiRequest<SiteNotice[]>("/api/admin/site-notices", {
      authMode: "required",
    }),
  getSiteNoticesPage: (params: { page?: number; size?: number; keyword?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("size", String(params.size ?? 10));
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    if (params.status && params.status !== "ALL") {
      query.set("status", params.status);
    }
    return apiRequest<PageResult<SiteNotice>>(`/api/admin/site-notices/page?${query.toString()}`, {
      authMode: "required",
    });
  },
  getSiteNoticeStats: () =>
    apiRequest<AdminSiteNoticeStats>("/api/admin/site-notices/stats", {
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
  getPostReportsPage: (params: { page?: number; size?: number; status?: string } = {}) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("size", String(params.size ?? 10));
    if (params.status && params.status !== "ALL") {
      query.set("status", params.status);
    }
    return apiRequest<PageResult<AdminPostReport>>(`/api/admin/post-reports/page?${query.toString()}`, {
      authMode: "required",
    });
  },
  getPostReportStats: () =>
    apiRequest<AdminPostReportStats>("/api/admin/post-reports/stats", {
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
  getOperationLogsPage: (params: { page?: number; size?: number; keyword?: string } = {}) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("size", String(params.size ?? 8));
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    return apiRequest<PageResult<AdminOperationLog>>(`/api/admin/operation-logs/page?${query.toString()}`, {
      authMode: "required",
    });
  },
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

import { apiRequest } from "./client";
import type { PageResult } from "../../types/app";

export interface AlipayFaceToFacePrecreatePayload {
  productId: number;
  couponCode?: string;
  deliveryEmail?: string;
}

export interface ProductCouponPreview {
  code: string;
  productId: number;
  productTitle?: string | null;
  discountType: string;
  discountValue: string;
  originalAmount: string;
  discountAmount: string;
  payableAmount: string;
  expiresAt?: string | null;
}

export interface PaymentOrder {
  id: number;
  channel: string;
  outTradeNo: string;
  tradeNo?: string | null;
  buyerLogonId?: string | null;
  subject: string;
  body?: string | null;
  originalAmount?: string | null;
  discountAmount?: string | null;
  couponCode?: string | null;
  totalAmount: string;
  status: string;
  qrCode?: string | null;
  resourceType?: string | null;
  resourceId?: number | null;
  deliveryEmail?: string | null;
  expireTime?: string | null;
  paidTime?: string | null;
  closedTime?: string | null;
  paidHandled?: boolean | null;
  lastError?: string | null;
  supportStatus?: "OPEN" | "RESOLVED" | string | null;
  supportMessage?: string | null;
  supportReply?: string | null;
  supportUpdatedAt?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export const paymentApi = {
  getAlipayOrders: (
    params: {
      page?: number;
      size?: number;
      status?: string;
      keyword?: string;
    } = {},
  ) => {
    const query = new URLSearchParams();
    query.set("page", String(params.page ?? 1));
    query.set("size", String(params.size ?? 8));
    if (params.status && params.status !== "ALL") {
      query.set("status", params.status);
    }
    if (params.keyword?.trim()) {
      query.set("keyword", params.keyword.trim());
    }
    return apiRequest<PageResult<PaymentOrder>>(
      `/api/payments/alipay/orders?${query.toString()}`,
      {
        authMode: "required",
      },
    );
  },
  precreateAlipayFaceToFaceOrder: (payload: AlipayFaceToFacePrecreatePayload) =>
    apiRequest<PaymentOrder>("/api/payments/alipay/face-to-face/orders", {
      method: "POST",
      authMode: "required",
      body: payload,
    }),
  previewProductCoupon: (payload: { productId: number; couponCode: string }) =>
    apiRequest<ProductCouponPreview>(
      "/api/payments/alipay/product-coupon-codes/preview",
      {
        method: "POST",
        authMode: "required",
        body: payload,
      },
    ),
  queryAlipayFaceToFaceOrder: (outTradeNo: string) =>
    apiRequest<PaymentOrder>(
      `/api/payments/alipay/face-to-face/orders/${encodeURIComponent(outTradeNo)}`,
      {
        authMode: "required",
      },
    ),
  closeAlipayFaceToFaceOrder: (outTradeNo: string) =>
    apiRequest<PaymentOrder>(
      `/api/payments/alipay/face-to-face/orders/${encodeURIComponent(outTradeNo)}/close`,
      {
        method: "POST",
        authMode: "required",
      },
    ),
  resendDelivery: (outTradeNo: string) =>
    apiRequest<PaymentOrder>(
      `/api/payments/alipay/face-to-face/orders/${encodeURIComponent(outTradeNo)}/resend-delivery`,
      {
        method: "POST",
        authMode: "required",
      },
    ),
  submitSupport: (outTradeNo: string, message: string) =>
    apiRequest<PaymentOrder>(
      `/api/payments/alipay/face-to-face/orders/${encodeURIComponent(outTradeNo)}/support`,
      {
        method: "POST",
        authMode: "required",
        body: { message },
      },
    ),
};

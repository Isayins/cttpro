export const PAYING_PAYMENT_STATUSES = new Set(["CREATED", "WAIT_BUYER_PAY"]);
export const PAID_PAYMENT_STATUSES = new Set([
  "TRADE_SUCCESS",
  "TRADE_FINISHED",
]);

export const PAYMENT_STATUS_OPTIONS = [
  { label: "全部状态", value: "ALL" },
  { label: "待支付", value: "WAIT_BUYER_PAY" },
  { label: "支付成功", value: "TRADE_SUCCESS" },
  { label: "交易完成", value: "TRADE_FINISHED" },
  { label: "已关闭", value: "TRADE_CLOSED" },
  { label: "失败", value: "FAILED" },
];

type PaymentAmount = string | number | null | undefined;

type PaymentOrderLike = {
  status?: string | null;
  totalAmount?: PaymentAmount;
  lastError?: string | null;
};

const cnyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  minimumFractionDigits: 2,
});

export function paymentStatusLabel(status?: string | null) {
  if (status === "WAIT_BUYER_PAY") return "待支付";
  if (status === "TRADE_SUCCESS") return "支付成功";
  if (status === "TRADE_FINISHED") return "交易完成";
  if (status === "TRADE_CLOSED") return "已关闭";
  if (status === "FAILED") return "失败";
  return "已创建";
}

export function paymentStatusColor(status?: string | null) {
  if (status === "WAIT_BUYER_PAY") return "orange";
  if (status === "TRADE_SUCCESS" || status === "TRADE_FINISHED") {
    return "green";
  }
  if (status === "TRADE_CLOSED") return "default";
  if (status === "FAILED") return "red";
  return "blue";
}

export function paymentChannelLabel(channel?: string | null) {
  if (channel === "VMQ_WECHAT") return "V免签微信";
  if (channel === "VMQ_ALIPAY") return "V免签支付宝";
  if (channel === "ALIPAY_F2F") return "官方支付宝";
  return channel || "扫码支付";
}

export function isVmqPaymentChannel(channel?: string | null) {
  return Boolean(channel?.trim().toUpperCase().startsWith("VMQ_"));
}

export function formatPrice(value: PaymentAmount) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return "¥--";
  }

  return cnyFormatter.format(amount);
}

export function formatPriceLabel(value: PaymentAmount) {
  return isFreeAmount(value) ? "免费" : formatPrice(value);
}

export function isFreeAmount(value: PaymentAmount) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount === 0;
}

export function isFreeOrder(order: PaymentOrderLike | null | undefined) {
  return isFreeAmount(order?.totalAmount);
}

export function paymentOrderLastError(
  order: PaymentOrderLike | null | undefined,
) {
  const normalizedError = order?.lastError?.trim();
  return normalizedError || null;
}

export function hasPaymentOrderIssue(
  order: PaymentOrderLike | null | undefined,
) {
  return Boolean(paymentOrderLastError(order));
}

export function paymentOrderStatusLabel(
  order: PaymentOrderLike | null | undefined,
) {
  if (
    order &&
    isFreeOrder(order) &&
    PAID_PAYMENT_STATUSES.has(order.status || "")
  ) {
    return "领取成功";
  }
  return paymentStatusLabel(order?.status);
}

export function paymentOrderCompletedMessage(
  order: PaymentOrderLike,
  suffix = "",
) {
  const baseText = isFreeOrder(order) ? "领取成功" : "支付成功";
  const lastError = paymentOrderLastError(order);
  if (lastError) {
    return `${baseText}，但发货待处理：${lastError}`;
  }
  return `${baseText}${suffix}`;
}

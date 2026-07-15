import { describe, expect, it } from "vitest";

import {
  formatPrice,
  formatPriceLabel,
  hasPaymentOrderIssue,
  paymentOrderLastError,
  paymentOrderCompletedMessage,
  paymentOrderStatusLabel,
  paymentStatusColor,
  paymentStatusLabel,
} from "./paymentDisplay";

describe("payment display helpers", () => {
  it("formats payment statuses consistently", () => {
    expect(paymentStatusLabel("WAIT_BUYER_PAY")).toBe("待支付");
    expect(paymentStatusColor("TRADE_SUCCESS")).toBe("green");
    expect(paymentStatusColor("FAILED")).toBe("red");
  });

  it("uses领取文案 for free completed orders", () => {
    const freeOrder = { status: "TRADE_SUCCESS", totalAmount: "0.00" };

    expect(paymentOrderStatusLabel(freeOrder)).toBe("领取成功");
    expect(paymentOrderCompletedMessage(freeOrder)).toBe("领取成功");
  });

  it("surfaces delivery issues in completed order messages", () => {
    const order = {
      status: "TRADE_SUCCESS",
      totalAmount: "0.00",
      lastError: "CDK邮件发送失败，CDK已锁定待后台重试",
    };

    expect(hasPaymentOrderIssue(order)).toBe(true);
    expect(paymentOrderLastError(order)).toBe(order.lastError);
    expect(paymentOrderCompletedMessage(order)).toContain("发货待处理");
  });

  it("formats prices with the shared CNY formatter", () => {
    expect(formatPrice(12.5)).toBe("¥12.50");
    expect(formatPriceLabel(0)).toBe("免费");
    expect(formatPriceLabel("bad-data")).toBe("¥--");
  });
});

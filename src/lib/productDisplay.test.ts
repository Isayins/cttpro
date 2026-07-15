import { describe, expect, it } from "vitest";

import {
  DEFAULT_CDK_PRODUCT_IMAGE_URL,
  isCdkEmailDeliveryType,
  getAvailableProductStock,
  hasAvailableProductStock,
  isCdkEmailProduct,
  isFreeProduct,
  productDeliveryCodeStockColor,
  productDeliveryTypeLabel,
  productDeliveryTypeTagColor,
  productStockText,
} from "./productDisplay";
import type { Product } from "../types/app";

function product(overrides: Partial<Product>): Product {
  return {
    id: 1,
    title: "Test Product",
    price: "9.90",
    status: "PUBLISHED",
    ...overrides,
  };
}

describe("product display helpers", () => {
  it("uses delivery code availability for CDK email products", () => {
    const item = product({
      deliveryType: "CDK_EMAIL",
      stock: 100,
      deliveryCodeAvailableCount: 2,
    });

    expect(isCdkEmailProduct(item)).toBe(true);
    expect(getAvailableProductStock(item)).toBe(2);
    expect(hasAvailableProductStock(item)).toBe(true);
    expect(productStockText(item)).toBe("可发货 2");
  });

  it("treats CDK email products with no available codes as sold out", () => {
    const item = product({
      deliveryType: "CDK_EMAIL",
      stock: 100,
      deliveryCodeAvailableCount: 0,
    });

    expect(getAvailableProductStock(item)).toBe(0);
    expect(hasAvailableProductStock(item)).toBe(false);
    expect(productStockText(item)).toBe("已售罄");
  });

  it("uses stock for normal products", () => {
    const item = product({ deliveryType: "NONE", stock: 7 });

    expect(getAvailableProductStock(item)).toBe(7);
    expect(productStockText(item)).toBe("库存 7");
  });

  it("identifies free products and exposes the CDK fallback image", () => {
    expect(isFreeProduct(product({ price: "0.00" }))).toBe(true);
    expect(DEFAULT_CDK_PRODUCT_IMAGE_URL).toContain("email-link-cdk-delivery");
  });

  it("normalizes delivery type labels and tag colors", () => {
    expect(isCdkEmailDeliveryType("cdk_email")).toBe(true);
    expect(productDeliveryTypeLabel("CDK_EMAIL")).toBe("虚拟CDK邮件");
    expect(productDeliveryTypeLabel("NONE")).toBe("普通商品");
    expect(productDeliveryTypeTagColor("CDK_EMAIL")).toBe("blue");
    expect(productDeliveryTypeTagColor("NONE")).toBe("default");
  });

  it("highlights delivery code stock by availability", () => {
    expect(productDeliveryCodeStockColor(0)).toBe("red");
    expect(productDeliveryCodeStockColor(5)).toBe("orange");
    expect(productDeliveryCodeStockColor(6)).toBe("green");
  });
});

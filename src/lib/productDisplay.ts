import { resolveAssetUrl } from "./media";
import type { Product } from "../types/app";

export const DEFAULT_CDK_PRODUCT_IMAGE_URL =
  "/images/products/email-link-cdk-delivery.png";

export const CDK_EMAIL_DELIVERY_TYPE = "CDK_EMAIL";

export function isCdkEmailDeliveryType(value?: string | null) {
  return value?.toUpperCase() === CDK_EMAIL_DELIVERY_TYPE;
}

export function isCdkEmailProduct(product: Product | null | undefined) {
  return isCdkEmailDeliveryType(product?.deliveryType);
}

export function getProductImageUrl(product: Product | null | undefined) {
  return resolveAssetUrl(
    product?.imageUrl ||
      (isCdkEmailProduct(product) ? DEFAULT_CDK_PRODUCT_IMAGE_URL : ""),
  );
}

export function getAvailableProductStock(product: Product | null | undefined) {
  if (!product) {
    return 0;
  }

  if (isCdkEmailProduct(product)) {
    return product.deliveryCodeAvailableCount ?? 0;
  }

  return product.stock ?? 0;
}

export function productStockText(product: Product) {
  if (isCdkEmailProduct(product)) {
    const availableCount = getAvailableProductStock(product);
    return availableCount > 0 ? `可发货 ${availableCount}` : "已售罄";
  }

  if (product.stock == null) {
    return "未设置库存";
  }

  if (product.stock <= 0) {
    return "已售罄";
  }

  return `库存 ${product.stock}`;
}

export function hasAvailableProductStock(product: Product | null | undefined) {
  return getAvailableProductStock(product) > 0;
}

export function isFreeProduct(product: Product | null | undefined) {
  const amount = Number(product?.price);
  return Number.isFinite(amount) && amount === 0;
}

export function productDeliveryTypeLabel(value?: string | null) {
  return isCdkEmailDeliveryType(value) ? "虚拟CDK邮件" : "普通商品";
}

export function productDeliveryTypeTagColor(value?: string | null) {
  return isCdkEmailDeliveryType(value) ? "blue" : "default";
}

export function productDeliveryCodeStockColor(
  available?: number | null,
) {
  if ((available ?? 0) <= 0) return "red";
  if ((available ?? 0) <= 5) return "orange";
  return "green";
}

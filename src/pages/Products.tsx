import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  QRCode,
  Skeleton,
  Space,
  Tag,
  message,
} from "antd";
import {
  CreditCardOutlined,
  GiftOutlined,
  MailOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../context/useAuth";
import { getErrorMessage } from "../lib/errorMessage";
import {
  PAID_PAYMENT_STATUSES as PAID_STATUSES,
  PAYING_PAYMENT_STATUSES as PAYING_STATUSES,
  formatPrice,
  formatPriceLabel,
  isFreeOrder,
  isVmqPaymentChannel,
  paymentOrderLastError,
  paymentStatusColor,
  paymentStatusLabel,
} from "../lib/paymentDisplay";
import {
  getProductImageUrl,
  hasAvailableProductStock as hasAvailableStock,
  isCdkEmailProduct,
  isFreeProduct,
  productDeliveryTypeLabel,
  productDeliveryTypeTagColor,
  productStockText as stockText,
} from "../lib/productDisplay";
import { buildRedirectFromLocation } from "../router/authRedirect";
import { routePaths } from "../router/routeAccess";
import {
  paymentApi,
  type PaymentOrder,
  type ProductCouponPreview,
} from "../services/api/payment";
import { productApi } from "../services/api/product";
import type { Product } from "../types/app";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Products() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [buyingProduct, setBuyingProduct] = useState<Product | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrder | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] =
    useState<ProductCouponPreview | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const loadProductsRequestRef = useRef(0);
  const paymentNoticeOrderNoRef = useRef<string | null>(null);

  const loadProducts = useCallback(async () => {
    const requestId = loadProductsRequestRef.current + 1;
    loadProductsRequestRef.current = requestId;
    const isLatestRequest = () => loadProductsRequestRef.current === requestId;

    setLoading(true);
    setError(null);
    try {
      const nextProducts = await productApi.getProducts();
      if (!isLatestRequest()) {
        return;
      }
      setProducts(nextProducts);
    } catch (error) {
      if (isLatestRequest()) {
        setError(getErrorMessage(error, "商品加载失败，请稍后重试"));
      }
    } finally {
      if (isLatestRequest()) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const notifyCompletedOrder = useCallback(
    (
      order: PaymentOrder,
      successText = isFreeOrder(order) ? "领取成功" : "支付成功",
    ) => {
      if (paymentNoticeOrderNoRef.current === order.outTradeNo) {
        return;
      }
      paymentNoticeOrderNoRef.current = order.outTradeNo;
      const deliveryIssue = paymentOrderLastError(order);
      if (deliveryIssue) {
        message.warning(`${successText}，但发货待处理：${deliveryIssue}`);
      } else {
        const deliveryNotice = order.deliveryEmail
          ? `，收货邮箱已记录：${order.deliveryEmail}`
          : "";
        message.success(`${successText}${deliveryNotice}`);
      }
      void loadProducts();
    },
    [loadProducts],
  );

  useEffect(() => {
    const outTradeNo = paymentOrder?.outTradeNo;
    const status = paymentOrder?.status;
    if (!outTradeNo || !status || !PAYING_STATUSES.has(status)) {
      return;
    }

    const timerId = window.setInterval(() => {
      void paymentApi
        .queryAlipayFaceToFaceOrder(outTradeNo)
        .then((order) => {
          setPaymentOrder(order);
          if (PAID_STATUSES.has(order.status)) {
            notifyCompletedOrder(order);
          }
        })
        .catch(() => {
          // Keep polling quiet; the modal still shows the last known state.
        });
    }, 3000);

    return () => window.clearInterval(timerId);
  }, [notifyCompletedOrder, paymentOrder?.outTradeNo, paymentOrder?.status]);

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return products;
    }
    return products.filter((product) =>
      [product.title, product.subtitle, product.description]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedKeyword),
        ),
    );
  }, [keyword, products]);

  const productSummary = useMemo(() => {
    const counts = products.reduce(
      (current, product) => {
        if (hasAvailableStock(product)) {
          current.available += 1;
        }
        if (isFreeProduct(product)) {
          current.free += 1;
        }
        if (isCdkEmailProduct(product)) {
          current.emailDelivery += 1;
        }
        return current;
      },
      { available: 0, free: 0, emailDelivery: 0 },
    );

    return [
      {
        label: "上架商品",
        value: loading ? "--" : products.length,
        detail: keyword.trim()
          ? `匹配 ${filteredProducts.length} 个`
          : "当前可浏览总数",
      },
      {
        label: "可购买",
        value: loading ? "--" : counts.available,
        detail: "有库存或可发货",
      },
      {
        label: "免费领取",
        value: loading ? "--" : counts.free,
        detail: "0 元商品",
      },
      {
        label: "邮箱发货",
        value: loading ? "--" : counts.emailDelivery,
        detail: "CDK 自动发送",
      },
    ];
  }, [filteredProducts.length, keyword, loading, products]);

  function startPayment(product: Product) {
    if (!isAuthenticated) {
      message.warning(
        isFreeProduct(product)
          ? "请先登录后再领取商品"
          : "请先登录后再购买商品",
      );
      navigate(routePaths.login, {
        state: { from: buildRedirectFromLocation(location) },
      });
      return;
    }
    if (!hasAvailableStock(product)) {
      message.warning("这个商品暂时没有库存");
      return;
    }

    setBuyingProduct(product);
    setPaymentOrder(null);
    paymentNoticeOrderNoRef.current = null;
    setCouponCode("");
    setCouponPreview(null);
    setDeliveryEmail((user?.email ?? "").trim().toLowerCase());
    setPaymentLoading(false);
  }

  async function applyCouponCode() {
    if (!buyingProduct) {
      return;
    }
    if (isFreeProduct(buyingProduct)) {
      setCouponPreview(null);
      message.info("免费商品无需使用优惠码");
      return;
    }
    const normalizedCode = couponCode.trim();
    if (!normalizedCode) {
      setCouponPreview(null);
      message.info("请输入优惠码");
      return;
    }

    setCouponChecking(true);
    try {
      const preview = await paymentApi.previewProductCoupon({
        productId: buyingProduct.id,
        couponCode: normalizedCode,
      });
      setCouponPreview(preview);
      setCouponCode(preview.code);
      message.success("优惠码可用");
    } catch (error) {
      setCouponPreview(null);
      message.error(getErrorMessage(error, "优惠码不可用"));
    } finally {
      setCouponChecking(false);
    }
  }

  async function createPaymentOrder() {
    if (!buyingProduct) {
      return;
    }
    const freeProduct = isFreeProduct(buyingProduct);
    const orderNeedsDeliveryEmail = true;
    const normalizedDeliveryEmail = deliveryEmail.trim().toLowerCase();
    if (orderNeedsDeliveryEmail && !normalizedDeliveryEmail) {
      message.warning("请填写收货邮箱");
      return;
    }
    if (
      orderNeedsDeliveryEmail &&
      !EMAIL_PATTERN.test(normalizedDeliveryEmail)
    ) {
      message.warning("收货邮箱格式不正确");
      return;
    }
    if (couponChecking) {
      message.warning("优惠码正在校验，请稍后再提交");
      return;
    }
    const normalizedCouponCode = couponCode.trim();
    if (
      !freeProduct &&
      normalizedCouponCode &&
      couponPreview?.code !== normalizedCouponCode
    ) {
      message.warning("请先应用优惠码后再生成订单");
      return;
    }

    setPaymentLoading(true);
    try {
      const order = await paymentApi.precreateAlipayFaceToFaceOrder({
        productId: buyingProduct.id,
        couponCode: freeProduct ? undefined : couponPreview?.code,
        deliveryEmail: normalizedDeliveryEmail,
      });
      setPaymentOrder(order);
      if (PAID_STATUSES.has(order.status)) {
        notifyCompletedOrder(order, freeProduct ? "领取成功" : "支付成功");
      }
    } catch (error) {
      message.error(
        getErrorMessage(error, freeProduct ? "领取失败" : "创建支付订单失败"),
      );
    } finally {
      setPaymentLoading(false);
    }
  }

  async function closePaymentOrder() {
    if (!paymentOrder) {
      return;
    }
    setPaymentLoading(true);
    try {
      const order = await paymentApi.closeAlipayFaceToFaceOrder(
        paymentOrder.outTradeNo,
      );
      setPaymentOrder(order);
      message.success("订单已关闭");
    } catch (error) {
      message.error(getErrorMessage(error, "关闭订单失败"));
    } finally {
      setPaymentLoading(false);
    }
  }

  async function queryPaymentStatus() {
    if (!paymentOrder) {
      return;
    }
    setCheckingPayment(true);
    try {
      const order = await paymentApi.queryAlipayFaceToFaceOrder(
        paymentOrder.outTradeNo,
      );
      setPaymentOrder(order);
      if (PAID_STATUSES.has(order.status)) {
        notifyCompletedOrder(order);
      } else if (order.status === "TRADE_CLOSED") {
        message.info("订单已关闭");
      } else {
        message.info("订单仍在等待支付");
      }
    } catch (error) {
      message.error(getErrorMessage(error, "查询支付状态失败"));
    } finally {
      setCheckingPayment(false);
    }
  }

  function closePaymentModal() {
    setBuyingProduct(null);
    setPaymentOrder(null);
    paymentNoticeOrderNoRef.current = null;
    setPaymentLoading(false);
    setCheckingPayment(false);
    setCouponCode("");
    setCouponPreview(null);
    setCouponChecking(false);
    setDeliveryEmail("");
  }

  const displayOriginalAmount =
    paymentOrder?.originalAmount ?? buyingProduct?.price;
  const displayDiscountAmount =
    paymentOrder?.discountAmount ?? couponPreview?.discountAmount;
  const displayPayableAmount =
    paymentOrder?.totalAmount ??
    couponPreview?.payableAmount ??
    buyingProduct?.price;
  const freeBuyingProduct = isFreeProduct(buyingProduct);
  const freePaymentOrder = isFreeOrder(paymentOrder) || freeBuyingProduct;
  const requiresDeliveryEmail = Boolean(buyingProduct);
  const normalizedDeliveryEmail = deliveryEmail.trim().toLowerCase();
  const deliveryEmailValid =
    !requiresDeliveryEmail || EMAIL_PATTERN.test(normalizedDeliveryEmail);
  const displayDeliveryEmail = paymentOrder?.deliveryEmail ?? null;
  const paymentOrderIssue = paymentOrderLastError(paymentOrder);
  const selectedProductImageUrl = getProductImageUrl(selectedProduct);
  const normalizedCouponCode = couponCode.trim();
  const couponNeedsPreview =
    Boolean(normalizedCouponCode) &&
    !freeBuyingProduct &&
    couponPreview?.code !== normalizedCouponCode;
  const showProductEmptyState = !error || products.length > 0;
  const createOrderButtonText = requiresDeliveryEmail
    ? freeBuyingProduct
      ? "确认邮箱并领取"
      : "确认邮箱并生成二维码"
    : freeBuyingProduct
      ? "确认领取"
      : "生成支付二维码";

  return (
    <MainLayout contentWidth="wide">
      <div className="space-y-6 py-8">
        <section className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.78fr)]">
            <div>
              <div className="text-sm text-slate-500">商品中心</div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                可购买商品
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                选择商品后确认收货信息，0
                元商品可直接领取，其余商品可通过扫码完成支付。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {productSummary.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white bg-slate-50/80 px-4 py-3"
                >
                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className="mt-1 text-2xl font-semibold leading-none text-slate-950">
                    {item.value}
                  </div>
                  <div className="mt-2 text-xs leading-5 text-slate-500">
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 flex w-full flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-500">
              {keyword.trim()
                ? `正在搜索“${keyword.trim()}”`
                : "支持按标题、摘要和商品简介搜索"}
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Input
                allowClear
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="搜索商品"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="w-full sm:!w-[260px]"
              />
              <Button
                className="w-full sm:w-auto"
                icon={<ReloadOutlined />}
                onClick={() => void loadProducts()}
              >
                刷新
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <Alert
            showIcon
            type="warning"
            message="商品加载失败"
            description={error}
            action={<Button onClick={() => void loadProducts()}>重试</Button>}
          />
        ) : null}

        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <Card
                key={item}
                className="rounded-[24px] border-slate-100 shadow-sm"
              >
                <Skeleton.Image active className="!h-44 !w-full" />
                <Skeleton active paragraph={{ rows: 4 }} className="mt-5" />
              </Card>
            ))}
          </div>
        ) : !showProductEmptyState ? null : filteredProducts.length === 0 ? (
          <div className="rounded-[28px] border border-white/70 bg-white/85 p-12 text-center shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                products.length === 0
                  ? "暂时还没有上架商品"
                  : "没有找到匹配的商品"
              }
            />
            {keyword.trim() ? (
              <Button className="mt-4" onClick={() => setKeyword("")}>
                清空搜索
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const imageUrl = getProductImageUrl(product);
              const soldOut = !hasAvailableStock(product);
              const freeProduct = isFreeProduct(product);
              return (
                <Card
                  key={product.id}
                  hoverable
                  className="h-full overflow-hidden rounded-[24px] border-white/80 bg-white shadow-sm"
                  bodyStyle={{ padding: 0 }}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="h-48 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-slate-100 text-sm text-slate-400">
                      暂无商品图片
                    </div>
                  )}
                  <div className="flex min-h-[310px] flex-col p-5">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="min-w-0 text-lg font-semibold leading-7 text-slate-900">
                          {product.title}
                        </h2>
                        <Tag
                          className="flex-shrink-0"
                          color={soldOut ? "red" : "green"}
                        >
                          {stockText(product)}
                        </Tag>
                      </div>
                      {product.subtitle ? (
                        <p className="mt-2 text-sm text-slate-500">
                          {product.subtitle}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Tag
                          color={productDeliveryTypeTagColor(
                            product.deliveryType,
                          )}
                        >
                          {productDeliveryTypeLabel(product.deliveryType)}
                        </Tag>
                        {freeProduct ? <Tag color="gold">免费领取</Tag> : null}
                        {product.salesCount != null ? (
                          <Tag color="default">已售 {product.salesCount}</Tag>
                        ) : null}
                      </div>
                    </div>
                    {product.description ? (
                      <p className="mt-4 line-clamp-3 min-h-[66px] text-sm leading-6 text-slate-600">
                        {product.description}
                      </p>
                    ) : (
                      <p className="mt-4 min-h-[66px] text-sm leading-6 text-slate-400">
                        管理员还没有填写商品简介。
                      </p>
                    )}
                    <div className="mt-auto flex flex-col gap-4 border-t border-slate-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <div className="text-xs text-slate-400">价格</div>
                        <div className="text-2xl font-semibold text-slate-950">
                          {formatPriceLabel(product.price)}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                        <Button
                          className="w-full sm:w-auto"
                          onClick={() => setSelectedProduct(product)}
                        >
                          详情
                        </Button>
                        <Button
                          className="w-full sm:w-auto"
                          type="primary"
                          icon={
                            freeProduct ? (
                              <GiftOutlined />
                            ) : (
                              <ShoppingCartOutlined />
                            )
                          }
                          disabled={soldOut}
                          onClick={() => void startPayment(product)}
                        >
                          {freeProduct ? "免费领取" : "购买"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Modal
          title={selectedProduct?.title || "商品详情"}
          open={Boolean(selectedProduct)}
          onCancel={() => setSelectedProduct(null)}
          footer={null}
          width={720}
          destroyOnClose
        >
          {selectedProduct ? (
            <div className="space-y-5">
              {selectedProductImageUrl ? (
                <img
                  src={selectedProductImageUrl}
                  alt={selectedProduct.title}
                  className="max-h-[360px] w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400">
                  暂无商品图片
                </div>
              )}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-2xl font-semibold text-slate-950">
                    {formatPriceLabel(selectedProduct.price)}
                  </div>
                  {selectedProduct.subtitle ? (
                    <div className="mt-1 text-sm text-slate-500">
                      {selectedProduct.subtitle}
                    </div>
                  ) : null}
                </div>
                <Tag
                  color={hasAvailableStock(selectedProduct) ? "green" : "red"}
                >
                  {stockText(selectedProduct)}
                </Tag>
              </div>
              <div className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                {selectedProduct.description || "管理员还没有填写商品简介。"}
              </div>
              <Space>
                <Button onClick={() => setSelectedProduct(null)}>关闭</Button>
                <Button
                  type="primary"
                  icon={
                    isFreeProduct(selectedProduct) ? (
                      <GiftOutlined />
                    ) : (
                      <ShoppingCartOutlined />
                    )
                  }
                  disabled={!hasAvailableStock(selectedProduct)}
                  onClick={() => {
                    const product = selectedProduct;
                    setSelectedProduct(null);
                    void startPayment(product);
                  }}
                >
                  {isFreeProduct(selectedProduct) ? "免费领取" : "购买"}
                </Button>
              </Space>
            </div>
          ) : null}
        </Modal>

        <Modal
          title={
            buyingProduct
              ? `${freeBuyingProduct ? "领取" : "购买"}：${buyingProduct.title}`
              : "扫码支付"
          }
          open={Boolean(buyingProduct)}
          onCancel={closePaymentModal}
          footer={null}
          destroyOnClose
        >
          <div className="space-y-5">
            {buyingProduct ? (
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-500">应付金额</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {formatPriceLabel(displayPayableAmount)}
                    </div>
                  </div>
                  {Number(displayDiscountAmount) > 0 ? (
                    <Tag color="green">
                      已优惠 {formatPrice(displayDiscountAmount)}
                    </Tag>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>原价 {formatPriceLabel(displayOriginalAmount)}</span>
                  {paymentOrder?.couponCode || couponPreview?.code ? (
                    <span>
                      优惠码 {paymentOrder?.couponCode || couponPreview?.code}
                    </span>
                  ) : null}
                  {displayDeliveryEmail ? (
                    <span>收货邮箱 {displayDeliveryEmail}</span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {!paymentOrder ? (
              <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
                {requiresDeliveryEmail ? (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-slate-700">
                      收货邮箱
                    </div>
                    <Input
                      allowClear
                      type="email"
                      prefix={<MailOutlined className="text-slate-400" />}
                      placeholder="用于接收商品发货信息的邮箱"
                      value={deliveryEmail}
                      status={!deliveryEmailValid ? "error" : undefined}
                      onChange={(event) => {
                        setDeliveryEmail(event.target.value);
                      }}
                      onBlur={(event) => {
                        setDeliveryEmail(
                          event.target.value.trim().toLowerCase(),
                        );
                      }}
                    />
                    {!deliveryEmailValid ? (
                      <div className="text-xs text-red-500">
                        {normalizedDeliveryEmail
                          ? "邮箱格式不正确"
                          : "购买商品必须填写收货邮箱"}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {freeBuyingProduct ? null : (
                  <>
                    <Input.Search
                      allowClear
                      enterButton="应用"
                      placeholder="输入优惠码（可选）"
                      value={couponCode}
                      loading={couponChecking}
                      onChange={(event) => {
                        setCouponCode(event.target.value);
                        setCouponPreview(null);
                      }}
                      onBlur={(event) => {
                        setCouponCode(event.target.value.trim());
                      }}
                      onSearch={() => void applyCouponCode()}
                    />
                    {couponNeedsPreview ? (
                      <Alert
                        showIcon
                        type="warning"
                        message="请先应用当前优惠码，再生成订单。"
                      />
                    ) : null}
                    {couponPreview ? (
                      <Alert
                        showIcon
                        type="success"
                        message={`优惠 ${formatPrice(couponPreview.discountAmount)}，实付 ${formatPriceLabel(couponPreview.payableAmount)}`}
                        description={
                          couponPreview.expiresAt
                            ? `有效期至 ${couponPreview.expiresAt}`
                            : "长期有效"
                        }
                      />
                    ) : null}
                  </>
                )}
                <Button
                  type="primary"
                  block
                  icon={freeBuyingProduct ? <GiftOutlined /> : undefined}
                  loading={paymentLoading}
                  disabled={
                    (requiresDeliveryEmail && !deliveryEmailValid) ||
                    couponChecking ||
                    couponNeedsPreview
                  }
                  onClick={() => void createPaymentOrder()}
                >
                  {createOrderButtonText}
                </Button>
              </div>
            ) : null}

            {paymentLoading && !paymentOrder ? (
              <Skeleton active paragraph={{ rows: 3 }} />
            ) : null}

            {paymentOrder?.qrCode ? (
              <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-5">
                <QRCode value={paymentOrder.qrCode} size={220} />
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                  <CreditCardOutlined />
                  扫码完成支付
                </div>
                {isVmqPaymentChannel(paymentOrder.channel) &&
                PAYING_STATUSES.has(paymentOrder.status) ? (
                  <div className="mt-2 max-w-xs text-center text-xs leading-5 text-amber-600">
                    请按上方精确金额支付，最后几分钱用于区分同时创建的订单。
                  </div>
                ) : null}
                <Tag
                  className="mt-3"
                  color={paymentStatusColor(paymentOrder.status)}
                >
                  {paymentStatusLabel(paymentOrder.status)}
                </Tag>
                {paymentOrder.expireTime ? (
                  <div className="mt-2 text-xs text-slate-500">
                    二维码有效期至 {paymentOrder.expireTime}
                  </div>
                ) : null}
              </div>
            ) : null}

            {paymentOrder && PAID_STATUSES.has(paymentOrder.status) ? (
              <>
                <Alert
                  showIcon
                  type={paymentOrderIssue ? "warning" : "success"}
                  message={
                    paymentOrderIssue
                      ? freePaymentOrder
                        ? "领取已记录，发货待处理"
                        : "支付成功，发货待处理"
                      : freePaymentOrder
                        ? "领取成功"
                        : "支付成功"
                  }
                  description={
                    paymentOrderIssue
                      ? `${paymentOrderIssue}。请到订单页查看，或联系管理员补发。`
                      : displayDeliveryEmail &&
                          buyingProduct &&
                          isCdkEmailProduct(buyingProduct)
                        ? `商品发货邮件已发送到 ${displayDeliveryEmail}。`
                        : displayDeliveryEmail
                          ? `订单已完成，收货邮箱已记录为 ${displayDeliveryEmail}。`
                          : freePaymentOrder
                            ? "订单已完成，商品已发放。"
                            : "订单已完成，感谢购买。"
                  }
                />
                <Space className="w-full" direction="vertical">
                  <Button
                    type="primary"
                    block
                    onClick={() => {
                      closePaymentModal();
                      navigate(routePaths.orders);
                    }}
                  >
                    查看订单
                  </Button>
                  <Button block onClick={closePaymentModal}>
                    完成
                  </Button>
                </Space>
              </>
            ) : null}

            {paymentOrder?.status === "TRADE_CLOSED" ? (
              <>
                <Alert
                  showIcon
                  type="info"
                  message="订单已关闭"
                  description="可以返回商品列表后重新发起购买。"
                />
                <Button block onClick={closePaymentModal}>
                  返回商品列表
                </Button>
              </>
            ) : null}

            {paymentOrder && PAYING_STATUSES.has(paymentOrder.status) ? (
              <Space wrap>
                <Button
                  loading={checkingPayment}
                  onClick={() => void queryPaymentStatus()}
                >
                  查询支付状态
                </Button>
                <Button
                  danger
                  loading={paymentLoading}
                  onClick={() => void closePaymentOrder()}
                >
                  关闭订单
                </Button>
                <Button
                  onClick={() => {
                    closePaymentModal();
                    navigate(routePaths.orders);
                  }}
                >
                  去订单页
                </Button>
              </Space>
            ) : null}
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Modal,
  Popconfirm,
  QRCode,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CopyOutlined,
  CreditCardOutlined,
  EyeOutlined,
  MailOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import { getErrorMessage } from "../lib/errorMessage";
import {
  PAID_PAYMENT_STATUSES as PAID_STATUSES,
  PAYING_PAYMENT_STATUSES as PAYING_STATUSES,
  PAYMENT_STATUS_OPTIONS as STATUS_OPTIONS,
  formatPrice,
  isFreeOrder,
  isVmqPaymentChannel,
  paymentOrderLastError,
  paymentOrderCompletedMessage,
  paymentOrderStatusLabel,
  paymentChannelLabel,
  paymentStatusColor,
} from "../lib/paymentDisplay";
import { routePaths } from "../router/routeAccess";
import { paymentApi, type PaymentOrder } from "../services/api/payment";

const DEFAULT_ORDER_PAGE_SIZE = 8;
const ORDER_STATUS_POLL_INTERVAL_MS = 3000;
const numberFormatter = new Intl.NumberFormat("zh-CN");
const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateTimeFormatter.format(date);
}

function getStatusFilterLabel(value: string) {
  return (
    STATUS_OPTIONS.find((item) => item.value === value)?.label ?? "全部状态"
  );
}

function buildSupportText(order: PaymentOrder) {
  const issue = paymentOrderLastError(order) || "请描述遇到的问题";
  return [
    "订单售后处理",
    `订单号：${order.outTradeNo}`,
    `商品：${order.subject}`,
    `状态：${paymentOrderStatusLabel(order)}`,
    `收货邮箱：${order.deliveryEmail || "-"}`,
    `金额：${isFreeOrder(order) ? "免费" : formatPrice(order.totalAmount)}`,
    `问题：${issue}`,
  ].join("\n");
}

type OrderMobileCardProps = {
  order: PaymentOrder;
  actionLoading: string | null;
  selected: boolean;
  onSelectChange: (order: PaymentOrder, checked: boolean) => void;
  onView: (order: PaymentOrder) => void;
  onQuery: (order: PaymentOrder) => void;
  onClose: (order: PaymentOrder) => void;
};

function OrderMobileCard({
  order,
  actionLoading,
  selected,
  onSelectChange,
  onView,
  onQuery,
  onClose,
}: OrderMobileCardProps) {
  const paying = PAYING_STATUSES.has(order.status);
  const canContinuePay = paying && Boolean(order.qrCode);
  const orderIssue = paymentOrderLastError(order);

  return (
    <div className="rounded-[24px] border border-white/80 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Checkbox
          checked={selected}
          onChange={(event) => onSelectChange(order, event.target.checked)}
        />
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => onView(order)}
        >
          <span className="line-clamp-2 block font-medium leading-6 text-slate-900">
            {order.subject}
          </span>
          <span className="mt-1 block break-all font-mono text-xs text-slate-500">
            {order.outTradeNo}
          </span>
        </button>
        <Tag
          className="flex-shrink-0"
          color={orderIssue ? "orange" : paymentStatusColor(order.status)}
        >
          {paymentOrderStatusLabel(order)}
        </Tag>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-500">
        <div>
          <div>金额</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {isFreeOrder(order) ? "免费" : formatPrice(order.totalAmount)}
          </div>
        </div>
        <div>
          <div>创建时间</div>
          <div className="mt-1 text-sm font-medium text-slate-700">
            {formatDateTime(order.createTime)}
          </div>
        </div>
        {order.deliveryEmail ? (
          <div className="col-span-2 flex min-w-0 items-center gap-1">
            <MailOutlined className="text-slate-400" />
            <span className="truncate font-mono">{order.deliveryEmail}</span>
          </div>
        ) : null}
        {orderIssue ? (
          <div className="col-span-2 text-amber-600">{orderIssue}</div>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button icon={<EyeOutlined />} onClick={() => onView(order)}>
          详情
        </Button>
        {canContinuePay ? (
          <Button
            type="primary"
            icon={<CreditCardOutlined />}
            onClick={() => onView(order)}
          >
            继续支付
          </Button>
        ) : null}
        {paying ? (
          <>
            <Button
              loading={actionLoading === order.outTradeNo}
              onClick={() => onQuery(order)}
            >
              同步
            </Button>
            <Popconfirm
              title="确认关闭这个未支付订单吗？"
              onConfirm={() => onClose(order)}
            >
              <Button danger loading={actionLoading === order.outTradeNo}>
                关闭
              </Button>
            </Popconfirm>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ORDER_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<PaymentOrder | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const loadOrdersRequestRef = useRef(0);
  const completedNoticeOrderNosRef = useRef<Set<string>>(new Set());

  const loadOrders = useCallback(
    async (
      nextPage = 1,
      nextPageSize = DEFAULT_ORDER_PAGE_SIZE,
      nextStatus = "ALL",
      nextKeyword = "",
    ) => {
      const requestId = loadOrdersRequestRef.current + 1;
      loadOrdersRequestRef.current = requestId;
      const isLatestRequest = () => loadOrdersRequestRef.current === requestId;

      setLoading(true);
      setError(null);
      try {
        const result = await paymentApi.getAlipayOrders({
          page: nextPage,
          size: nextPageSize,
          status: nextStatus,
          keyword: nextKeyword,
        });
        if (!isLatestRequest()) {
          return;
        }
        setOrders(result.records);
        setPage(result.page);
        setPageSize(result.size);
        setTotal(result.total);
        setAppliedKeyword(nextKeyword.trim());
        setSelectedOrderIds([]);
      } catch (error) {
        if (isLatestRequest()) {
          setError(getErrorMessage(error, "订单加载失败，请稍后重试"));
        }
      } finally {
        if (isLatestRequest()) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const summary = useMemo(
    () =>
      orders.reduce(
        (current, item) => {
          if (item.status === "WAIT_BUYER_PAY") {
            current.waiting += 1;
          }
          if (PAID_STATUSES.has(item.status)) {
            current.paid += 1;
          }
          if (item.deliveryEmail) {
            current.deliveryEmail += 1;
          }
          return current;
        },
        { waiting: 0, paid: 0, deliveryEmail: 0 },
      ),
    [orders],
  );

  const updateOrder = useCallback((updated: PaymentOrder) => {
    setOrders((current) =>
      current.map((item) =>
        item.outTradeNo === updated.outTradeNo ? updated : item,
      ),
    );
    setSelectedOrder((current) =>
      current?.outTradeNo === updated.outTradeNo ? updated : current,
    );
  }, []);

  const notifyCompletedOrder = useCallback(
    (order: PaymentOrder, suffix = "") => {
      if (completedNoticeOrderNosRef.current.has(order.outTradeNo)) {
        return;
      }
      completedNoticeOrderNosRef.current.add(order.outTradeNo);
      const completedMessage = paymentOrderCompletedMessage(order, suffix);
      if (paymentOrderLastError(order)) {
        message.warning(completedMessage);
      } else {
        message.success(completedMessage);
      }
    },
    [],
  );

  const selectedOrders = useMemo(() => {
    const selectedIdSet = new Set(selectedOrderIds);
    return orders.filter((item) => selectedIdSet.has(item.id));
  }, [orders, selectedOrderIds]);
  const payingOrderIds = useMemo(
    () =>
      orders
        .filter((item) => PAYING_STATUSES.has(item.status))
        .map((item) => item.id),
    [orders],
  );
  const selectedPayingOrders = selectedOrders.filter((item) =>
    PAYING_STATUSES.has(item.status),
  );
  const hasFilters = appliedKeyword !== "" || statusFilter !== "ALL";
  const summaryCards = useMemo(
    () => [
      {
        label: "订单总数",
        value: loading ? "--" : formatCount(total),
        detail: `本页 ${formatCount(orders.length)} 条`,
      },
      {
        label: "本页待支付",
        value: loading ? "--" : formatCount(summary.waiting),
        detail: "可继续支付或同步",
      },
      {
        label: "本页已完成",
        value: loading ? "--" : formatCount(summary.paid),
        detail: "支付成功/交易完成",
      },
      {
        label: "邮箱发货",
        value: loading ? "--" : formatCount(summary.deliveryEmail),
        detail: "CDK 或数字资源",
      },
    ],
    [
      loading,
      orders.length,
      summary.deliveryEmail,
      summary.paid,
      summary.waiting,
      total,
    ],
  );

  useEffect(() => {
    const outTradeNo = selectedOrder?.outTradeNo;
    const status = selectedOrder?.status;
    if (!outTradeNo || !status || !PAYING_STATUSES.has(status)) {
      return;
    }

    const timerId = window.setInterval(() => {
      void paymentApi
        .queryAlipayFaceToFaceOrder(outTradeNo)
        .then((updated) => {
          updateOrder(updated);
          if (PAID_STATUSES.has(updated.status)) {
            notifyCompletedOrder(updated, "，订单状态已更新");
          } else if (updated.status === "TRADE_CLOSED") {
            message.info("订单已关闭");
          }
        })
        .catch(() => {
          // Keep background polling quiet; users can still click manual sync.
        });
    }, ORDER_STATUS_POLL_INTERVAL_MS);

    return () => window.clearInterval(timerId);
  }, [
    notifyCompletedOrder,
    selectedOrder?.outTradeNo,
    selectedOrder?.status,
    updateOrder,
  ]);

  async function queryOrder(order: PaymentOrder) {
    setActionLoading(order.outTradeNo);
    try {
      const updated = await paymentApi.queryAlipayFaceToFaceOrder(
        order.outTradeNo,
      );
      updateOrder(updated);
      if (PAID_STATUSES.has(updated.status)) {
        notifyCompletedOrder(updated);
      } else if (updated.status === "TRADE_CLOSED") {
        message.info("订单已关闭");
      } else {
        message.info("订单仍在等待支付");
      }
    } catch (error) {
      message.error(getErrorMessage(error, "查询订单失败"));
    } finally {
      setActionLoading(null);
    }
  }

  async function closeOrder(order: PaymentOrder) {
    setActionLoading(order.outTradeNo);
    try {
      const updated = await paymentApi.closeAlipayFaceToFaceOrder(
        order.outTradeNo,
      );
      updateOrder(updated);
      message.success("订单已关闭");
    } catch (error) {
      message.error(getErrorMessage(error, "关闭订单失败"));
    } finally {
      setActionLoading(null);
    }
  }

  async function syncSelectedOrders() {
    if (selectedPayingOrders.length === 0) {
      message.warning("请先勾选待支付订单");
      return;
    }

    setActionLoading("batch-sync");
    try {
      const results = await Promise.allSettled(
        selectedPayingOrders.map((order) =>
          paymentApi.queryAlipayFaceToFaceOrder(order.outTradeNo),
        ),
      );
      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;
      if (successCount > 0) {
        message.success(
          `已同步 ${successCount} 个订单${failedCount > 0 ? `，${failedCount} 个失败` : ""}`,
        );
      } else {
        message.error("批量同步订单失败");
      }
      await loadOrders(page, pageSize, statusFilter, appliedKeyword);
    } catch (error) {
      message.error(getErrorMessage(error, "批量同步订单失败"));
    } finally {
      setActionLoading(null);
    }
  }

  async function closeSelectedOrders() {
    if (selectedPayingOrders.length === 0) {
      message.warning("请先勾选待支付订单");
      return;
    }

    setActionLoading("batch-close");
    try {
      const results = await Promise.allSettled(
        selectedPayingOrders.map((order) =>
          paymentApi.closeAlipayFaceToFaceOrder(order.outTradeNo),
        ),
      );
      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;
      if (successCount > 0) {
        message.success(
          `已关闭 ${successCount} 个订单${failedCount > 0 ? `，${failedCount} 个失败` : ""}`,
        );
      } else {
        message.error("批量关闭订单失败");
      }
      await loadOrders(page, pageSize, statusFilter, appliedKeyword);
    } catch (error) {
      message.error(getErrorMessage(error, "批量关闭订单失败"));
    } finally {
      setActionLoading(null);
    }
  }

  function clearFilters() {
    setKeyword("");
    setStatusFilter("ALL");
    void loadOrders(1, pageSize, "ALL", "");
  }

  function handleKeywordChange(value: string) {
    setKeyword(value);
    if (!value.trim() && appliedKeyword) {
      void loadOrders(1, pageSize, statusFilter, "");
    }
  }

  function handleKeywordSearch(value: string) {
    const normalizedValue = value.trim();
    setKeyword(normalizedValue);
    void loadOrders(1, pageSize, statusFilter, normalizedValue);
  }

  function toggleSelectedOrder(order: PaymentOrder, checked: boolean) {
    setSelectedOrderIds((current) =>
      checked
        ? Array.from(new Set([...current, order.id]))
        : current.filter((orderId) => orderId !== order.id),
    );
  }

  function selectPayingOrdersOnPage() {
    if (payingOrderIds.length === 0) {
      message.warning("本页没有待支付订单");
      return;
    }
    setSelectedOrderIds(payingOrderIds);
    message.success(`已选择本页 ${payingOrderIds.length} 个待支付订单`);
  }

  function clearSelectedOrders() {
    setSelectedOrderIds([]);
  }

  async function copyText(
    text: string | null | undefined,
    successText: string,
  ) {
    const normalizedText = String(text ?? "").trim();
    if (!normalizedText) {
      message.warning("暂无可复制内容");
      return;
    }

    try {
      await navigator.clipboard.writeText(normalizedText);
      message.success(successText);
    } catch {
      message.warning("复制失败，请手动复制");
    }
  }

  const selectedOrderIssue = paymentOrderLastError(selectedOrder);

  const columns: ColumnsType<PaymentOrder> = [
    {
      title: "订单",
      key: "order",
      render: (_, record) => (
        <div className="min-w-[260px]">
          <div className="font-medium text-slate-900">{record.subject}</div>
          <div className="mt-1 font-mono text-xs text-slate-500">
            {record.outTradeNo}
          </div>
          {record.body ? (
            <div className="mt-1 truncate text-xs text-slate-400">
              {record.body}
            </div>
          ) : null}
          {record.deliveryEmail ? (
            <div className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
              <MailOutlined className="text-slate-400" />
              <span className="font-mono">{record.deliveryEmail}</span>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "金额",
      key: "amount",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">
            {isFreeOrder(record) ? "免费" : formatPrice(record.totalAmount)}
          </div>
          {Number(record.discountAmount) > 0 ? (
            <div className="mt-1 text-xs text-green-600">
              原价 {formatPrice(record.originalAmount)}，优惠{" "}
              {formatPrice(record.discountAmount)}
            </div>
          ) : null}
          {record.couponCode ? (
            <div className="mt-1 font-mono text-xs text-slate-400">
              {record.couponCode}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (_, record) => {
        const orderIssue = paymentOrderLastError(record);
        return (
          <div>
            <Tag
              color={orderIssue ? "orange" : paymentStatusColor(record.status)}
            >
              {paymentOrderStatusLabel(record)}
            </Tag>
            {orderIssue ? (
              <div className="mt-1 max-w-[220px] text-xs leading-5 text-amber-600">
                {orderIssue}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      title: "时间",
      key: "time",
      render: (_, record) => (
        <div className="text-xs leading-5 text-slate-500">
          <div>创建 {formatDateTime(record.createTime)}</div>
          <div>失效 {formatDateTime(record.expireTime)}</div>
          <div>支付 {formatDateTime(record.paidTime)}</div>
        </div>
      ),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => setSelectedOrder(record)}
          >
            详情
          </Button>
          {PAYING_STATUSES.has(record.status) && record.qrCode ? (
            <Button type="link" onClick={() => setSelectedOrder(record)}>
              继续支付
            </Button>
          ) : null}
          <Button
            type="link"
            icon={<CopyOutlined />}
            onClick={() => void copyText(record.outTradeNo, "订单号已复制")}
          >
            复制
          </Button>
          {PAYING_STATUSES.has(record.status) ? (
            <>
              <Button
                type="link"
                loading={actionLoading === record.outTradeNo}
                onClick={() => void queryOrder(record)}
              >
                同步
              </Button>
              <Popconfirm
                title="确认关闭这个未支付订单吗？"
                onConfirm={() => void closeOrder(record)}
              >
                <Button
                  type="link"
                  danger
                  loading={actionLoading === record.outTradeNo}
                >
                  关闭
                </Button>
              </Popconfirm>
            </>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <MainLayout contentWidth="wide">
      <div className="space-y-6 py-8">
        <section className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(460px,0.85fr)]">
            <div>
              <div className="text-sm text-slate-500">我的订单</div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">
                订单记录
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                查看支付、领取和邮箱发货记录。待支付订单可以继续扫码、同步支付状态或主动关闭。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {summaryCards.map((item) => (
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

          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-slate-500">
              {hasFilters
                ? `正在查看：${statusFilter === "ALL" ? "全部状态" : getStatusFilterLabel(statusFilter)}${appliedKeyword ? `，关键词“${appliedKeyword}”` : ""}`
                : "支持按订单号、商品名称和收货邮箱搜索"}
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-[180px_minmax(0,1fr)] lg:w-auto lg:grid-cols-[170px_280px_auto_auto]">
              <Select
                value={statusFilter}
                onChange={(value) => {
                  const normalizedKeyword = keyword.trim();
                  setStatusFilter(value);
                  setKeyword(normalizedKeyword);
                  void loadOrders(1, pageSize, value, normalizedKeyword);
                }}
                className="w-full [&_.ant-select-selector]:!rounded-2xl"
                options={STATUS_OPTIONS}
              />
              <Input.Search
                allowClear
                enterButton="搜索"
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="搜索订单号、商品、邮箱"
                value={keyword}
                onChange={(event) => handleKeywordChange(event.target.value)}
                onSearch={handleKeywordSearch}
                className="w-full"
              />
              {hasFilters ? (
                <Button className="w-full lg:w-auto" onClick={clearFilters}>
                  清空筛选
                </Button>
              ) : null}
              <Button
                className="w-full lg:w-auto"
                icon={<ReloadOutlined />}
                loading={loading}
                onClick={() =>
                  void loadOrders(page, pageSize, statusFilter, appliedKeyword)
                }
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
            message="订单加载失败"
            description={error}
            action={
              <Button
                onClick={() =>
                  void loadOrders(page, pageSize, statusFilter, appliedKeyword)
                }
              >
                重试
              </Button>
            }
          />
        ) : null}

        <section className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="m-0">本页 {formatCount(orders.length)} 条</Tag>
              {hasFilters ? (
                <Tag color="blue" className="m-0">
                  筛选：{getStatusFilterLabel(statusFilter)}
                </Tag>
              ) : null}
              {appliedKeyword ? (
                <Tag className="m-0">关键词：{appliedKeyword}</Tag>
              ) : null}
              {selectedOrderIds.length > 0 ? (
                <Tag color="blue" className="m-0">
                  已选 {selectedOrderIds.length} 个，待处理{" "}
                  {selectedPayingOrders.length} 个
                </Tag>
              ) : null}
            </div>
            <Space wrap>
              <Button
                disabled={payingOrderIds.length === 0}
                onClick={selectPayingOrdersOnPage}
              >
                选择本页待支付
              </Button>
              <Button
                disabled={selectedOrderIds.length === 0}
                onClick={clearSelectedOrders}
              >
                清空选择
              </Button>
              <Button
                loading={actionLoading === "batch-sync"}
                disabled={selectedPayingOrders.length === 0}
                onClick={() => void syncSelectedOrders()}
              >
                同步所选
              </Button>
              <Popconfirm
                title={`确认关闭选中的 ${selectedPayingOrders.length} 个待支付订单吗？`}
                onConfirm={() => void closeSelectedOrders()}
                disabled={selectedPayingOrders.length === 0}
              >
                <Button
                  danger
                  loading={actionLoading === "batch-close"}
                  disabled={selectedPayingOrders.length === 0}
                >
                  关闭所选
                </Button>
              </Popconfirm>
            </Space>
          </div>
          {loading && orders.length === 0 ? (
            <Skeleton active paragraph={{ rows: 5 }} />
          ) : orders.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <div className="text-base font-medium text-slate-800">
                      {hasFilters ? "没有找到匹配的订单" : "暂无订单记录"}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {hasFilters
                        ? "可以清空筛选后再查看全部订单。"
                        : "购买或领取商品后，订单会显示在这里。"}
                    </div>
                  </div>
                }
              >
                <div className="flex flex-wrap justify-center gap-3">
                  {hasFilters ? (
                    <Button onClick={clearFilters}>清空筛选</Button>
                  ) : null}
                  <Button
                    type="primary"
                    icon={<ShoppingCartOutlined />}
                    onClick={() => navigate(routePaths.products)}
                  >
                    去商品中心
                  </Button>
                </div>
              </Empty>
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:hidden">
                {orders.map((order) => (
                  <OrderMobileCard
                    key={order.id}
                    order={order}
                    actionLoading={actionLoading}
                    selected={selectedOrderIds.includes(order.id)}
                    onSelectChange={toggleSelectedOrder}
                    onView={setSelectedOrder}
                    onQuery={(item) => void queryOrder(item)}
                    onClose={(item) => void closeOrder(item)}
                  />
                ))}
              </div>
              <div className="hidden md:block">
                <Table<PaymentOrder>
                  rowKey="id"
                  loading={loading}
                  columns={columns}
                  dataSource={orders}
                  rowSelection={{
                    selectedRowKeys: selectedOrderIds,
                    onChange: (keys) => {
                      setSelectedOrderIds(
                        keys
                          .map((key) => Number(key))
                          .filter((key) => Number.isFinite(key)),
                      );
                    },
                  }}
                  pagination={{
                    current: page,
                    pageSize,
                    total,
                    showSizeChanger: true,
                    showTotal: (value) => `共 ${value} 条`,
                  }}
                  onChange={(pagination) => {
                    void loadOrders(
                      pagination.current ?? 1,
                      pagination.pageSize ?? pageSize,
                      statusFilter,
                      appliedKeyword,
                    );
                  }}
                  scroll={{ x: 1040 }}
                />
              </div>
            </>
          )}
        </section>

        <Modal
          title={
            selectedOrder
              ? `${isFreeOrder(selectedOrder) ? "领取" : "支付"}：${selectedOrder.subject}`
              : "扫码支付"
          }
          open={Boolean(selectedOrder)}
          onCancel={() => setSelectedOrder(null)}
          footer={null}
          destroyOnClose
        >
          {selectedOrder ? (
            <div className="space-y-5">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-500">应付金额</div>
                    <div className="mt-1 text-2xl font-semibold text-slate-900">
                      {isFreeOrder(selectedOrder)
                        ? "免费"
                        : formatPrice(selectedOrder.totalAmount)}
                    </div>
                  </div>
                  <Tag
                    color={
                      selectedOrderIssue
                        ? "orange"
                        : paymentStatusColor(selectedOrder.status)
                    }
                  >
                    {paymentOrderStatusLabel(selectedOrder)}
                  </Tag>
                </div>
                {Number(selectedOrder.discountAmount) > 0 ? (
                  <div className="mt-2 text-sm text-green-600">
                    原价 {formatPrice(selectedOrder.originalAmount)}，优惠{" "}
                    {formatPrice(selectedOrder.discountAmount)}
                  </div>
                ) : null}
                {selectedOrder.couponCode ? (
                  <div className="mt-1 font-mono text-xs text-slate-500">
                    优惠码 {selectedOrder.couponCode}
                  </div>
                ) : null}
                {selectedOrder.deliveryEmail ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-slate-500">
                    <MailOutlined className="text-slate-400" />
                    收货邮箱{" "}
                    <span className="font-mono">
                      {selectedOrder.deliveryEmail}
                    </span>
                    <Button
                      size="small"
                      type="link"
                      icon={<CopyOutlined />}
                      onClick={() =>
                        void copyText(
                          selectedOrder.deliveryEmail,
                          "收货邮箱已复制",
                        )
                      }
                    >
                      复制
                    </Button>
                  </div>
                ) : null}
                <div className="mt-4 grid gap-2 rounded-2xl bg-white p-3 text-xs text-slate-500 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <div>订单号</div>
                    <div className="mt-1 flex items-start gap-2">
                      <div className="min-w-0 flex-1 break-all font-mono text-slate-700">
                        {selectedOrder.outTradeNo}
                      </div>
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() =>
                          void copyText(
                            selectedOrder.outTradeNo,
                            "订单号已复制",
                          )
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <div>创建时间</div>
                    <div className="mt-1 text-slate-700">
                      {formatDateTime(selectedOrder.createTime)}
                    </div>
                  </div>
                  <div>
                    <div>失效时间</div>
                    <div className="mt-1 text-slate-700">
                      {formatDateTime(selectedOrder.expireTime)}
                    </div>
                  </div>
                  <div>
                    <div>支付时间</div>
                    <div className="mt-1 text-slate-700">
                      {formatDateTime(selectedOrder.paidTime)}
                    </div>
                  </div>
                  <div>
                    <div>关闭时间</div>
                    <div className="mt-1 text-slate-700">
                      {formatDateTime(selectedOrder.closedTime)}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 rounded-2xl bg-white p-3 text-xs text-slate-500 sm:grid-cols-2">
                  <div>
                    <div>支付渠道</div>
                    <div className="mt-1 text-slate-700">
                      {paymentChannelLabel(selectedOrder.channel)}
                    </div>
                  </div>
                  <div>
                    <div>交易号</div>
                    <div className="mt-1 break-all font-mono text-slate-700">
                      {selectedOrder.tradeNo || "-"}
                    </div>
                  </div>
                  <div>
                    <div>资源类型</div>
                    <div className="mt-1 text-slate-700">
                      {selectedOrder.resourceType || "通用订单"}
                    </div>
                  </div>
                  <div>
                    <div>资源 ID</div>
                    <div className="mt-1 text-slate-700">
                      {selectedOrder.resourceId ?? "-"}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <div>订单说明</div>
                    <div className="mt-1 whitespace-pre-wrap text-slate-700">
                      {selectedOrder.body || "暂无说明"}
                    </div>
                  </div>
                </div>
                {selectedOrderIssue ? (
                  <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-700">
                    <div className="font-semibold">发货异常</div>
                    <div className="mt-1">{selectedOrderIssue}</div>
                  </div>
                ) : null}
              </div>

              {selectedOrder.qrCode &&
              PAYING_STATUSES.has(selectedOrder.status) ? (
                <div className="flex flex-col items-center rounded-2xl border border-slate-100 bg-white p-5">
                  <QRCode value={selectedOrder.qrCode} size={220} />
                  <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                    <CreditCardOutlined />
                    扫码完成支付
                  </div>
                  {isVmqPaymentChannel(selectedOrder.channel) ? (
                    <div className="mt-2 max-w-xs text-center text-xs leading-5 text-amber-600">
                      请按上方精确金额支付，最后几分钱用于区分同时创建的订单。
                    </div>
                  ) : null}
                  <Tag className="mt-3" color="blue">
                    自动同步中
                  </Tag>
                  {selectedOrder.expireTime ? (
                    <div className="mt-2 text-xs text-slate-500">
                      二维码有效期至 {selectedOrder.expireTime}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Alert
                showIcon
                type={
                  selectedOrderIssue
                    ? "warning"
                    : PAID_STATUSES.has(selectedOrder.status)
                      ? "success"
                      : selectedOrder.status === "TRADE_CLOSED"
                        ? "info"
                        : "warning"
                }
                message={
                  selectedOrderIssue
                    ? "发货待处理"
                    : paymentOrderStatusLabel(selectedOrder)
                }
                description={
                  selectedOrderIssue
                    ? `${selectedOrderIssue}。如未收到邮件，请联系管理员补发。`
                    : selectedOrder.deliveryEmail &&
                        PAID_STATUSES.has(selectedOrder.status)
                      ? `订单已完成，收货邮箱已记录为 ${selectedOrder.deliveryEmail}。如为自动发货商品，请查收邮件和垃圾箱。`
                      : PAYING_STATUSES.has(selectedOrder.status)
                        ? "页面会自动同步支付结果，也可以手动点击同步状态。"
                        : undefined
                }
              />

              {PAYING_STATUSES.has(selectedOrder.status) ? (
                <Space wrap>
                  <Button
                    loading={actionLoading === selectedOrder.outTradeNo}
                    onClick={() => void queryOrder(selectedOrder)}
                  >
                    同步状态
                  </Button>
                  <Popconfirm
                    title="确认关闭这个未支付订单吗？"
                    onConfirm={() => void closeOrder(selectedOrder)}
                  >
                    <Button
                      danger
                      loading={actionLoading === selectedOrder.outTradeNo}
                    >
                      关闭订单
                    </Button>
                  </Popconfirm>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() =>
                      void copyText(
                        buildSupportText(selectedOrder),
                        "售后信息已复制",
                      )
                    }
                  >
                    复制售后信息
                  </Button>
                  <Button onClick={() => navigate(routePaths.chat)}>
                    联系管理员
                  </Button>
                  <Button onClick={() => setSelectedOrder(null)}>
                    关闭详情
                  </Button>
                </Space>
              ) : (
                <Space wrap>
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() =>
                      void copyText(
                        buildSupportText(selectedOrder),
                        "售后信息已复制",
                      )
                    }
                  >
                    复制售后信息
                  </Button>
                  <Button onClick={() => navigate(routePaths.chat)}>
                    联系管理员
                  </Button>
                  <Button onClick={() => setSelectedOrder(null)}>
                    关闭详情
                  </Button>
                </Space>
              )}
            </div>
          ) : null}
        </Modal>
      </div>
    </MainLayout>
  );
}

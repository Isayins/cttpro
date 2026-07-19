import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Upload,
  message,
} from "antd";
import type { UploadProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AreaChartOutlined,
  AuditOutlined,
  BellOutlined,
  ClearOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  DownloadOutlined,
  GiftOutlined,
  HeartOutlined,
  KeyOutlined,
  MailOutlined,
  NotificationOutlined,
  QrcodeOutlined,
  SafetyOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../context/useAuth";
import { getFriendlyMessage as textError } from "../lib/errorMessage";
import { resolveAssetUrl } from "../lib/media";
import {
  formatPrice,
  formatPriceLabel as priceText,
  isFreeOrder,
  paymentChannelLabel,
  paymentOrderStatusLabel,
  paymentStatusColor,
} from "../lib/paymentDisplay";
import {
  DEFAULT_CDK_PRODUCT_IMAGE_URL,
  isCdkEmailDeliveryType,
  productDeliveryCodeStockColor,
  productDeliveryTypeLabel,
  productDeliveryTypeTagColor,
} from "../lib/productDisplay";
import {
  IMAGE_ACCEPT,
  IMAGE_MAX_SIZE_BYTES,
  isAllowedImageFile,
} from "../lib/richContent";
import {
  isAllowedDownloadResourceUrl,
  isAllowedImageResourceUrl,
} from "../lib/urlValidation";
import { adminApi } from "../services/api/admin";
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
  AdminSystemHealth,
  AdminUpdateUserPayload,
  AdminUserStats,
  CreateProductCouponCodesPayload,
  CreateDownloadResourcePayload,
  ImportProductDeliveryCodesPayload,
  DownloadResource,
  InviteCode,
  MailSendLog,
  PageResult,
  Product,
  ProductCouponCode,
  ProductDeliveryCode,
  ReviewPostReportPayload,
  SaveProductPayload,
  SaveSiteNoticePayload,
  SaveVmqPaymentSettingsPayload,
  SiteAnalyticsOverview,
  SiteNotice,
  User,
  VmqPaymentSettings,
} from "../types/app";

const roleLabel = (role?: string) => {
  if (role === "OWNER") return "网站拥有人";
  if (role === "ADMIN") return "管理员";
  return "普通用户";
};

const roleColor = (role?: string) => {
  if (role === "OWNER") return "purple";
  if (role === "ADMIN") return "gold";
  return "blue";
};

const reportColor = (status?: string) => {
  if (status === "RESOLVED") return "green";
  if (status === "REJECTED") return "red";
  return "orange";
};

const reportLabel = (status?: string) => {
  if (status === "RESOLVED") return "已处理";
  if (status === "REJECTED") return "已驳回";
  return "待处理";
};

const inviteLabel = (status?: string) => {
  if (status === "USED") return "已使用";
  if (status === "EXPIRED") return "已过期";
  return "可用";
};

const mailSendStatusLabel = (status?: string) =>
  status === "SUCCESS" ? "发送成功" : "发送失败";

const mailSendStatusColor = (status?: string) =>
  status === "SUCCESS" ? "green" : "red";

const actionLabel = (value?: string) =>
  ({
    USER_UPDATED: "更新用户",
    USER_DELETED: "删除用户",
    INVITE_CREATED: "生成邀请码",
    INVITE_DELETED: "删除邀请码",
    DOWNLOAD_CREATED: "新增下载",
    DOWNLOAD_UPDATED: "更新下载",
    DOWNLOAD_FILE_UPLOADED: "上传下载文件",
    DOWNLOAD_DELETED: "删除下载",
    PRODUCT_CREATED: "新增商品",
    PRODUCT_UPDATED: "更新商品",
    PRODUCT_IMAGE_UPLOADED: "上传商品图片",
    PRODUCT_DELETED: "删除商品",
    PRODUCT_DELIVERY_CODE_IMPORTED: "导入CDK",
    PRODUCT_DELIVERY_CODE_DISABLED: "作废CDK",
    PRODUCT_DELIVERY_CODE_BATCH_DISABLED: "整批作废CDK",
    PRODUCT_DELIVERY_CODE_RESENT: "补发CDK邮件",
    PAYMENT_ORDER_DELIVERY_RESENT: "订单重新发货",
    PRODUCT_COUPON_CREATED: "生成优惠码",
    PRODUCT_COUPON_DISABLED: "作废优惠码",
    PRODUCT_COUPON_BATCH_DISABLED: "整批作废优惠码",
    NOTICE_CREATED: "新增公告",
    NOTICE_UPDATED: "更新公告",
    NOTICE_DELETED: "删除公告",
    POST_REPORT_REVIEWED: "处理举报",
    QR_CREATED: "新增二维码",
    QR_UPDATED: "更新二维码",
    QR_DELETED: "删除二维码",
    PAYMENT_ORDER_SYNCED: "同步支付订单",
    PAYMENT_ORDER_CLOSED: "关闭支付订单",
    PAYMENT_ORDER_RESOLVED: "处理支付异常",
    VMQ_SETTING_UPDATED: "更新V免签配置",
    VMQ_KEY_REGENERATED: "重置V免签密钥",
  })[value || ""] ||
  value ||
  "未知操作";

const targetLabel = (value?: string) =>
  ({
    USER: "用户",
    INVITE_CODE: "邀请码",
    DOWNLOAD: "下载资源",
    PRODUCT: "商品",
    PRODUCT_COUPON: "商品优惠码",
    PRODUCT_DELIVERY_CODE: "商品CDK",
    SITE_NOTICE: "站点公告",
    POST_REPORT: "帖子举报",
    QR_CODE: "二维码",
    PAYMENT_ORDER: "支付订单",
    VMQ_SETTING: "V免签配置",
  })[value || ""] ||
  value ||
  "未知对象";

const validateOptionalImageUrl = (_: unknown, value?: string) =>
  isAllowedImageResourceUrl(value)
    ? Promise.resolve()
    : Promise.reject(
        new Error(
          "请输入有效的图片链接，支持 http(s)、上传路径或站内 /images 路径",
        ),
      );

const validateDownloadUrl = (_: unknown, value?: string) =>
  isAllowedDownloadResourceUrl(value)
    ? Promise.resolve()
    : Promise.reject(
        new Error("请输入有效的下载链接，支持 http(s) 或站内路径"),
      );

const parseDeliveryCodeTokens = (value?: string | null) =>
  (value ?? "")
    .split(/[\s,，;；、]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseDeliveryCodeInput = (value?: string | null) =>
  Array.from(new Set(parseDeliveryCodeTokens(value)));

const paymentErrorFilterValue = (value: string) => {
  if (value === "HAS_ERROR") return true;
  if (value === "NO_ERROR") return false;
  return undefined;
};

const paymentCouponFilterValue = (value: string) => {
  if (value === "HAS_COUPON") return true;
  if (value === "NO_COUPON") return false;
  return undefined;
};

const sortByOrder = <T extends { id: number; sortOrder?: number | null }>(
  items: T[],
) =>
  [...items].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || b.id - a.id,
  );

const getPageAfterVisibleRemovals = (
  currentPage: number,
  currentPageItemCount: number,
  removedCount: number,
) =>
  currentPage > 1 && removedCount > 0 && currentPageItemCount <= removedCount
    ? currentPage - 1
    : currentPage;

const DOWNLOAD_UPLOAD_MAX_SIZE_BYTES = 1024 * 1024 * 1024;
const DEFAULT_INVITE_PAGE_SIZE = 5;
const DEFAULT_DOWNLOAD_PAGE_SIZE = 5;
const DEFAULT_PRODUCT_PAGE_SIZE = 5;
const DEFAULT_USER_PAGE_SIZE = 6;
const DEFAULT_REPORT_PAGE_SIZE = 6;
const DEFAULT_NOTICE_PAGE_SIZE = 5;
const DEFAULT_LOG_PAGE_SIZE = 8;
const DEFAULT_PAYMENT_ORDER_PAGE_SIZE = 8;
const DEFAULT_COUPON_PAGE_SIZE = 8;
const DEFAULT_DELIVERY_CODE_PAGE_SIZE = 8;

const productStatusLabel = (status?: string) => {
  if (status === "PUBLISHED") return "已上架";
  if (status === "OFFLINE") return "已下架";
  return "草稿";
};

const productStatusColor = (status?: string) => {
  if (status === "PUBLISHED") return "green";
  if (status === "OFFLINE") return "red";
  return "default";
};

const couponStatusLabel = (status?: string) => {
  if (status === "LOCKED") return "已锁定";
  if (status === "USED") return "已使用";
  if (status === "DISABLED") return "已作废";
  if (status === "EXPIRED") return "已过期";
  return "可用";
};

const couponStatusColor = (status?: string) => {
  if (status === "ACTIVE") return "green";
  if (status === "LOCKED") return "orange";
  if (status === "USED") return "blue";
  if (status === "DISABLED" || status === "EXPIRED") return "red";
  return "default";
};

const couponDiscountText = (
  record: Pick<ProductCouponCode, "discountType" | "discountValue">,
) =>
  record.discountType === "PERCENT"
    ? `${record.discountValue}%`
    : `¥${record.discountValue}`;

const deliveryCodeStatusLabel = (status?: string) => {
  if (status === "LOCKED") return "已锁定";
  if (status === "SENT") return "已发送";
  if (status === "DISABLED") return "已作废";
  return "可发货";
};

const deliveryCodeStatusColor = (status?: string) => {
  if (status === "AVAILABLE") return "green";
  if (status === "LOCKED") return "orange";
  if (status === "SENT") return "blue";
  if (status === "DISABLED") return "red";
  return "default";
};

const deliveryCodeProductOptionLabel = (item: Product) =>
  `${item.title} / ${priceText(item.price)} / 可发货 ${item.deliveryCodeAvailableCount ?? 0}`;

const beginAdminRequest = (requestRef: { current: number }) => {
  const requestId = requestRef.current + 1;
  requestRef.current = requestId;
  return () => requestRef.current === requestId;
};

const isPaymentClosable = (status?: string) =>
  ["CREATED", "WAIT_BUYER_PAY"].includes(status || "");

const isPaymentManualConfirmable = (status?: string) =>
  ["CREATED", "WAIT_BUYER_PAY", "FAILED"].includes(status || "");

const vmqMonitorStatusLabel = (status?: string) => {
  if (status === "ONLINE") return "监听在线";
  if (status === "OFFLINE") return "监听离线";
  return "未绑定";
};

const vmqMonitorStatusColor = (status?: string) => {
  if (status === "ONLINE") return "green";
  if (status === "OFFLINE") return "red";
  return "default";
};

const systemHealthStatusLabel = (status?: string) => {
  if (status === "OK") return "正常";
  if (status === "ERROR") return "异常";
  return "关注";
};

const systemHealthStatusColor = (status?: string) => {
  if (status === "OK") return "green";
  if (status === "ERROR") return "red";
  return "orange";
};

const formatAdminRefreshTime = (date: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const sectionItems = [
  { id: "overview", label: "数据概览", icon: <AreaChartOutlined /> },
  { id: "invite", label: "邀请码", icon: <KeyOutlined /> },
  { id: "users", label: "用户管理", icon: <TeamOutlined /> },
  { id: "products", label: "商品管理", icon: <ShoppingCartOutlined /> },
  { id: "coupons", label: "优惠码", icon: <GiftOutlined /> },
  { id: "delivery-codes", label: "CDK发货", icon: <KeyOutlined /> },
  { id: "payments", label: "支付订单", icon: <CreditCardOutlined /> },
  { id: "mail-logs", label: "邮件记录", icon: <MailOutlined /> },
  { id: "vmq-payment", label: "V免签配置", icon: <QrcodeOutlined /> },
  { id: "downloads", label: "下载管理", icon: <DownloadOutlined /> },
  { id: "system-health", label: "系统状态", icon: <HeartOutlined /> },
  { id: "notices", label: "公告管理", icon: <NotificationOutlined /> },
  { id: "reports", label: "举报处理", icon: <SafetyOutlined /> },
  { id: "logs", label: "操作日志", icon: <AuditOutlined /> },
] as const;

type AdminSectionId = (typeof sectionItems)[number]["id"];

const DEFAULT_CDK_DELIVERY_INSTRUCTIONS = [
  "1. 支付成功后系统会自动把取码链接或CDK发送到订单邮箱。",
  "2. 打开邮件中的链接后，页面会自动获取验证码；如是兑换码商品，可直接复制兑换码。",
  "3. 如邮件未收到，请先检查垃圾箱；仍有问题请携带订单号联系管理员。",
].join("\n");

const defaultProductImages = [
  {
    key: "email-link-cdk",
    label: "邮箱链接/CDK发货",
    url: DEFAULT_CDK_PRODUCT_IMAGE_URL,
    hint: "适合取码链接、兑换码、激活卡",
  },
  {
    key: "brand-default",
    label: "品牌默认图",
    url: "/images/idncar-logo.png",
    hint: "适合临时占位或普通商品",
  },
] as const;

const emailProductTemplates = [
  {
    key: "hotmail",
    label: "Hotmail / Outlook",
    title: "Hotmail/Outlook 邮箱取码链接",
  },
  { key: "gmail", label: "Gmail", title: "Gmail 邮箱取码链接" },
  { key: "yahoo", label: "Yahoo", title: "Yahoo 邮箱取码链接" },
  { key: "icloud", label: "iCloud", title: "iCloud 邮箱取码链接" },
  { key: "aol", label: "AOL", title: "AOL 邮箱取码链接" },
  { key: "proton", label: "Proton Mail", title: "Proton Mail 邮箱取码链接" },
  { key: "gmx", label: "GMX", title: "GMX 邮箱取码链接" },
  { key: "zoho", label: "Zoho Mail", title: "Zoho Mail 邮箱取码链接" },
  { key: "yandex", label: "Yandex", title: "Yandex 邮箱取码链接" },
  { key: "qq", label: "QQ邮箱", title: "QQ邮箱取码链接" },
  { key: "163", label: "163邮箱", title: "163邮箱取码链接" },
  { key: "126", label: "126邮箱", title: "126邮箱取码链接" },
  { key: "sohu", label: "搜狐邮箱", title: "搜狐邮箱取码链接" },
  { key: "enterprise", label: "企业邮箱", title: "企业邮箱取码链接" },
  { key: "edu", label: "EDU邮箱", title: "EDU邮箱取码链接" },
] as const;

const productTemplates: Array<{
  key: string;
  label: string;
  values: SaveProductPayload;
}> = [
  {
    key: "normal",
    label: "普通商品模板",
    values: {
      title: "学习资料包",
      subtitle: "适合下载交付的资料型商品",
      description:
        "包含整理好的学习资料、使用说明和后续更新入口。下单后请按页面提示领取。",
      imageUrl: "",
      price: 9.9,
      stock: 100,
      deliveryType: "NONE",
      deliveryInstructions:
        "资料下载地址：https://example.com/download\n请将这里替换为实际交付地址、提取码和使用说明。",
      status: "DRAFT",
      sortOrder: 0,
    },
  },
  {
    key: "cdk",
    label: "邮箱链接/CDK商品模板",
    values: {
      title: "邮箱取码链接",
      subtitle: "支付成功后自动邮件发送取码链接",
      description:
        "邮箱取码链接商品，适合 Hotmail/Outlook、Gmail、企业邮箱等验证码代取或CDK自动发货场景。",
      imageUrl: DEFAULT_CDK_PRODUCT_IMAGE_URL,
      price: 19.9,
      stock: 0,
      deliveryType: "CDK_EMAIL",
      deliveryInstructions: DEFAULT_CDK_DELIVERY_INSTRUCTIONS,
      status: "DRAFT",
      sortOrder: 0,
    },
  },
];

const deliveryCodeImportTemplate = [
  "IDNCAR-2026-0001",
  "IDNCAR-2026-0002",
  "IDNCAR-2026-0003",
].join("\n");

function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export default function Admin() {
  const { user, isOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [noticeLoading, setNoticeLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [mailLogsLoading, setMailLogsLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentExporting, setPaymentExporting] = useState(false);
  const [systemHealthLoading, setSystemHealthLoading] = useState(false);
  const [vmqLoading, setVmqLoading] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [deliveryCodeLoading, setDeliveryCodeLoading] = useState(false);
  const [productLoading, setProductLoading] = useState(false);
  const [paymentActionLoading, setPaymentActionLoading] = useState<
    string | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDownloadFile, setUploadingDownloadFile] = useState(false);
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Record<string, string>>(
    {},
  );
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [activeSection, setActiveSection] =
    useState<AdminSectionId>("overview");
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<AdminUserStats>({
    total: 0,
    owner: 0,
    admin: 0,
    regular: 0,
    disabled: 0,
  });
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [inviteStats, setInviteStats] = useState<AdminInviteStats>({
    total: 0,
    active: 0,
    used: 0,
    expired: 0,
  });
  const [downloads, setDownloads] = useState<DownloadResource[]>([]);
  const [downloadStats, setDownloadStats] = useState<AdminDownloadStats>({
    total: 0,
    locked: 0,
    open: 0,
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [couponProductOptions, setCouponProductOptions] = useState<Product[]>(
    [],
  );
  const [productStats, setProductStats] = useState<AdminProductStats>({
    total: 0,
    published: 0,
    draft: 0,
    offline: 0,
  });
  const [couponCodes, setCouponCodes] = useState<ProductCouponCode[]>([]);
  const [couponStats, setCouponStats] = useState<AdminProductCouponStats>({
    total: 0,
    active: 0,
    locked: 0,
    used: 0,
    disabled: 0,
    expired: 0,
  });
  const [deliveryCodes, setDeliveryCodes] = useState<ProductDeliveryCode[]>([]);
  const [deliveryCodeStats, setDeliveryCodeStats] =
    useState<AdminProductDeliveryCodeStats>({
      total: 0,
      available: 0,
      locked: 0,
      sent: 0,
      disabled: 0,
    });
  const [paymentOrders, setPaymentOrders] = useState<AdminPaymentOrder[]>([]);
  const [paymentStats, setPaymentStats] = useState<AdminPaymentOrderStats>({
    total: 0,
    created: 0,
    waiting: 0,
    paid: 0,
    closed: 0,
    failed: 0,
    errors: 0,
    openSupport: 0,
  });
  const [systemHealth, setSystemHealth] = useState<AdminSystemHealth | null>(
    null,
  );
  const [vmqSettings, setVmqSettings] = useState<VmqPaymentSettings | null>(
    null,
  );
  const [siteNotices, setSiteNotices] = useState<SiteNotice[]>([]);
  const [noticeStats, setNoticeStats] = useState<AdminSiteNoticeStats>({
    total: 0,
    published: 0,
    draft: 0,
  });
  const [analytics, setAnalytics] = useState<SiteAnalyticsOverview | null>(
    null,
  );
  const [postReports, setPostReports] = useState<AdminPostReport[]>([]);
  const [reportStats, setReportStats] = useState<AdminPostReportStats>({
    total: 0,
    pending: 0,
    resolved: 0,
    rejected: 0,
  });
  const [operationLogs, setOperationLogs] = useState<AdminOperationLog[]>([]);
  const [mailSendLogs, setMailSendLogs] = useState<MailSendLog[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingDownload, setEditingDownload] =
    useState<DownloadResource | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingNotice, setEditingNotice] = useState<SiteNotice | null>(null);
  const [reviewingReport, setReviewingReport] =
    useState<AdminPostReport | null>(null);
  const [resolvingPaymentOrder, setResolvingPaymentOrder] =
    useState<AdminPaymentOrder | null>(null);
  const [reportStatus, setReportStatus] = useState("ALL");
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(
    DEFAULT_REPORT_PAGE_SIZE,
  );
  const [reportTotal, setReportTotal] = useState(0);
  const [selectedReportIds, setSelectedReportIds] = useState<number[]>([]);
  const [userKeyword, setUserKeyword] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [userStatusFilter, setUserStatusFilter] = useState("ALL");
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(DEFAULT_USER_PAGE_SIZE);
  const [userTotal, setUserTotal] = useState(0);
  const [inviteKeyword, setInviteKeyword] = useState("");
  const [inviteStatusFilter, setInviteStatusFilter] = useState("ALL");
  const [invitePage, setInvitePage] = useState(1);
  const [invitePageSize, setInvitePageSize] = useState(
    DEFAULT_INVITE_PAGE_SIZE,
  );
  const [inviteTotal, setInviteTotal] = useState(0);
  const [selectedInviteIds, setSelectedInviteIds] = useState<number[]>([]);
  const [downloadKeyword, setDownloadKeyword] = useState("");
  const [downloadModeFilter, setDownloadModeFilter] = useState("ALL");
  const [downloadPage, setDownloadPage] = useState(1);
  const [downloadPageSize, setDownloadPageSize] = useState(
    DEFAULT_DOWNLOAD_PAGE_SIZE,
  );
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [productKeyword, setProductKeyword] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState("ALL");
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(
    DEFAULT_PRODUCT_PAGE_SIZE,
  );
  const [productTotal, setProductTotal] = useState(0);
  const [couponKeyword, setCouponKeyword] = useState("");
  const [couponProductFilter, setCouponProductFilter] = useState<
    string | number
  >("ALL");
  const [couponStatusFilter, setCouponStatusFilter] = useState("ALL");
  const [couponPage, setCouponPage] = useState(1);
  const [couponPageSize, setCouponPageSize] = useState(
    DEFAULT_COUPON_PAGE_SIZE,
  );
  const [couponTotal, setCouponTotal] = useState(0);
  const [selectedCouponCodeIds, setSelectedCouponCodeIds] = useState<number[]>(
    [],
  );
  const [deliveryCodeKeyword, setDeliveryCodeKeyword] = useState("");
  const [deliveryCodeProductFilter, setDeliveryCodeProductFilter] = useState<
    string | number
  >("ALL");
  const [deliveryCodeStatusFilter, setDeliveryCodeStatusFilter] =
    useState("ALL");
  const [deliveryCodePage, setDeliveryCodePage] = useState(1);
  const [deliveryCodePageSize, setDeliveryCodePageSize] = useState(
    DEFAULT_DELIVERY_CODE_PAGE_SIZE,
  );
  const [deliveryCodeTotal, setDeliveryCodeTotal] = useState(0);
  const [selectedDeliveryCodeIds, setSelectedDeliveryCodeIds] = useState<
    number[]
  >([]);
  const [paymentKeyword, setPaymentKeyword] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  const [paymentResourceFilter, setPaymentResourceFilter] = useState("ALL");
  const [paymentErrorFilter, setPaymentErrorFilter] = useState("ALL");
  const [paymentCouponFilter, setPaymentCouponFilter] = useState("ALL");
  const [paymentSupportFilter, setPaymentSupportFilter] = useState("ALL");
  const [paymentPage, setPaymentPage] = useState(1);
  const [paymentPageSize, setPaymentPageSize] = useState(
    DEFAULT_PAYMENT_ORDER_PAGE_SIZE,
  );
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [noticeKeyword, setNoticeKeyword] = useState("");
  const [noticeStatusFilter, setNoticeStatusFilter] = useState("ALL");
  const [noticePage, setNoticePage] = useState(1);
  const [noticePageSize, setNoticePageSize] = useState(
    DEFAULT_NOTICE_PAGE_SIZE,
  );
  const [noticeTotal, setNoticeTotal] = useState(0);
  const [selectedNoticeIds, setSelectedNoticeIds] = useState<number[]>([]);
  const [logKeyword, setLogKeyword] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(DEFAULT_LOG_PAGE_SIZE);
  const [logTotal, setLogTotal] = useState(0);
  const [mailLogKeyword, setMailLogKeyword] = useState("");
  const [mailLogStatusFilter, setMailLogStatusFilter] = useState("ALL");
  const [mailLogPage, setMailLogPage] = useState(1);
  const [mailLogPageSize, setMailLogPageSize] = useState(DEFAULT_LOG_PAGE_SIZE);
  const [mailLogTotal, setMailLogTotal] = useState(0);
  const [userForm] = Form.useForm<AdminUpdateUserPayload>();
  const [inviteForm] = Form.useForm<{ count: number; expiresInDays: number }>();
  const [downloadForm] = Form.useForm<CreateDownloadResourcePayload>();
  const [productForm] = Form.useForm<SaveProductPayload>();
  const [couponForm] = Form.useForm<CreateProductCouponCodesPayload>();
  const [deliveryCodeForm] = Form.useForm<ImportProductDeliveryCodesPayload>();
  const [noticeForm] = Form.useForm<SaveSiteNoticePayload>();
  const [reviewForm] = Form.useForm<ReviewPostReportPayload>();
  const reportReviewStatus = Form.useWatch("status", reviewForm);
  const [paymentResolveForm] = Form.useForm<{ note?: string }>();

  useEffect(() => {
    const sectionFromHash = window.location.hash.replace("#", "");
    if (sectionItems.some((item) => item.id === sectionFromHash)) {
      setActiveSection(sectionFromHash as AdminSectionId);
    }
  }, []);
  const [vmqForm] = Form.useForm<SaveVmqPaymentSettingsPayload>();
  const deliveryCodeContent = Form.useWatch("content", deliveryCodeForm);
  const selectedDeliveryCodeProductId = Form.useWatch(
    "productId",
    deliveryCodeForm,
  );
  const deliveryCodeRawImportCount = useMemo(
    () => parseDeliveryCodeTokens(deliveryCodeContent).length,
    [deliveryCodeContent],
  );
  const deliveryCodeImportCount = useMemo(
    () => parseDeliveryCodeInput(deliveryCodeContent).length,
    [deliveryCodeContent],
  );
  const deliveryCodeDuplicateCount = Math.max(
    deliveryCodeRawImportCount - deliveryCodeImportCount,
    0,
  );
  const invitePageSizeRef = useRef(DEFAULT_INVITE_PAGE_SIZE);
  const inviteQueryMountedRef = useRef(false);
  const downloadPageSizeRef = useRef(DEFAULT_DOWNLOAD_PAGE_SIZE);
  const downloadQueryMountedRef = useRef(false);
  const noticePageSizeRef = useRef(DEFAULT_NOTICE_PAGE_SIZE);
  const noticeQueryMountedRef = useRef(false);
  const userPageSizeRef = useRef(DEFAULT_USER_PAGE_SIZE);
  const userQueryMountedRef = useRef(false);
  const reportPageSizeRef = useRef(DEFAULT_REPORT_PAGE_SIZE);
  const productPageSizeRef = useRef(DEFAULT_PRODUCT_PAGE_SIZE);
  const productQueryMountedRef = useRef(false);
  const couponPageSizeRef = useRef(DEFAULT_COUPON_PAGE_SIZE);
  const couponQueryMountedRef = useRef(false);
  const deliveryCodePageSizeRef = useRef(DEFAULT_DELIVERY_CODE_PAGE_SIZE);
  const deliveryCodeQueryMountedRef = useRef(false);
  const paymentPageSizeRef = useRef(DEFAULT_PAYMENT_ORDER_PAGE_SIZE);
  const paymentQueryMountedRef = useRef(false);
  const logPageSizeRef = useRef(DEFAULT_LOG_PAGE_SIZE);
  const logQueryMountedRef = useRef(false);
  const mailLogPageSizeRef = useRef(DEFAULT_LOG_PAGE_SIZE);
  const mailLogQueryMountedRef = useRef(false);
  const inviteRequestRef = useRef(0);
  const downloadRequestRef = useRef(0);
  const productRequestRef = useRef(0);
  const userRequestRef = useRef(0);
  const noticeRequestRef = useRef(0);
  const paymentRequestRef = useRef(0);
  const couponRequestRef = useRef(0);
  const deliveryCodeRequestRef = useRef(0);
  const logRequestRef = useRef(0);
  const mailLogRequestRef = useRef(0);
  const reportRequestRef = useRef(0);
  const loadAllRequestRef = useRef(0);

  const loadAll = useCallback(
    async (status: string) => {
      const isLatestRequest = beginAdminRequest(loadAllRequestRef);

      setLoading(true);
      const tasks: Array<{
        key: string;
        label: string;
        run: () => Promise<unknown>;
        apply: (value: unknown) => void;
      }> = [
        {
          key: "users",
          label: "用户列表",
          run: () =>
            adminApi.getUsersPage({ page: 1, size: DEFAULT_USER_PAGE_SIZE }),
          apply: (value) => {
            const result = value as PageResult<User>;
            setUsers(result.records);
            setUserPage(result.page);
            setUserPageSize(result.size);
            userPageSizeRef.current = result.size;
            setUserTotal(result.total);
          },
        },
        {
          key: "userStats",
          label: "用户统计",
          run: adminApi.getUserStats,
          apply: (value) => setUserStats(value as AdminUserStats),
        },
        {
          key: "invite",
          label: "邀请码",
          run: () =>
            adminApi.getInviteCodesPage({
              page: 1,
              size: DEFAULT_INVITE_PAGE_SIZE,
            }),
          apply: (value) => {
            const result = value as PageResult<InviteCode>;
            setInviteCodes(result.records);
            setInvitePage(result.page);
            setInvitePageSize(result.size);
            invitePageSizeRef.current = result.size;
            setInviteTotal(result.total);
            setSelectedInviteIds([]);
          },
        },
        {
          key: "inviteStats",
          label: "邀请码统计",
          run: adminApi.getInviteCodeStats,
          apply: (value) => setInviteStats(value as AdminInviteStats),
        },
        {
          key: "downloads",
          label: "下载内容",
          run: () =>
            adminApi.getDownloadsPage({
              page: 1,
              size: DEFAULT_DOWNLOAD_PAGE_SIZE,
            }),
          apply: (value) => {
            const result = value as PageResult<DownloadResource>;
            setDownloads(result.records);
            setDownloadPage(result.page);
            setDownloadPageSize(result.size);
            downloadPageSizeRef.current = result.size;
            setDownloadTotal(result.total);
          },
        },
        {
          key: "downloadStats",
          label: "下载统计",
          run: adminApi.getDownloadStats,
          apply: (value) => setDownloadStats(value as AdminDownloadStats),
        },
        {
          key: "products",
          label: "商品内容",
          run: () =>
            adminApi.getProductsPage({
              page: 1,
              size: DEFAULT_PRODUCT_PAGE_SIZE,
            }),
          apply: (value) => {
            const result = value as PageResult<Product>;
            setProducts(result.records);
            setProductPage(result.page);
            setProductPageSize(result.size);
            productPageSizeRef.current = result.size;
            setProductTotal(result.total);
          },
        },
        {
          key: "productStats",
          label: "商品统计",
          run: adminApi.getProductStats,
          apply: (value) => setProductStats(value as AdminProductStats),
        },
        {
          key: "productOptions",
          label: "商品选项",
          run: adminApi.getProducts,
          apply: (value) =>
            setCouponProductOptions(sortByOrder(value as Product[])),
        },
        {
          key: "coupons",
          label: "优惠码",
          run: () =>
            adminApi.getProductCouponCodes({
              page: 1,
              size: DEFAULT_COUPON_PAGE_SIZE,
            }),
          apply: (value) => {
            const result = value as PageResult<ProductCouponCode>;
            setCouponCodes(result.records);
            setCouponPage(result.page);
            setCouponPageSize(result.size);
            couponPageSizeRef.current = result.size;
            setCouponTotal(result.total);
          },
        },
        {
          key: "couponStats",
          label: "优惠码统计",
          run: adminApi.getProductCouponStats,
          apply: (value) => setCouponStats(value as AdminProductCouponStats),
        },
        {
          key: "deliveryCodes",
          label: "CDK库存",
          run: () =>
            adminApi.getProductDeliveryCodes({
              page: 1,
              size: DEFAULT_DELIVERY_CODE_PAGE_SIZE,
            }),
          apply: (value) => {
            const result = value as PageResult<ProductDeliveryCode>;
            setDeliveryCodes(result.records);
            setDeliveryCodePage(result.page);
            setDeliveryCodePageSize(result.size);
            deliveryCodePageSizeRef.current = result.size;
            setDeliveryCodeTotal(result.total);
            setSelectedDeliveryCodeIds([]);
          },
        },
        {
          key: "deliveryCodeStats",
          label: "CDK统计",
          run: adminApi.getProductDeliveryCodeStats,
          apply: (value) =>
            setDeliveryCodeStats(value as AdminProductDeliveryCodeStats),
        },
        {
          key: "payments",
          label: "支付订单",
          run: () =>
            adminApi.getPaymentOrders({
              page: 1,
              size: DEFAULT_PAYMENT_ORDER_PAGE_SIZE,
            }),
          apply: (value) => {
            const result = value as PageResult<AdminPaymentOrder>;
            setPaymentOrders(result.records);
            setPaymentPage(result.page);
            setPaymentPageSize(result.size);
            paymentPageSizeRef.current = result.size;
            setPaymentTotal(result.total);
          },
        },
        {
          key: "paymentStats",
          label: "支付订单统计",
          run: adminApi.getPaymentOrderStats,
          apply: (value) => setPaymentStats(value as AdminPaymentOrderStats),
        },
        {
          key: "systemHealth",
          label: "系统状态",
          run: adminApi.getSystemHealth,
          apply: (value) => setSystemHealth(value as AdminSystemHealth),
        },
        {
          key: "vmqPayment",
          label: "V免签配置",
          run: adminApi.getVmqPaymentSettings,
          apply: (value) => {
            const settings = value as VmqPaymentSettings;
            setVmqSettings(settings);
            vmqForm.setFieldsValue({
              enabled: settings.enabled,
              preferred: settings.preferred,
              payType: settings.payType,
              communicationKey: settings.communicationKey,
              wxPayUrl: settings.wxPayUrl || "",
              alipayPayUrl: settings.alipayPayUrl || "",
              amountStrategy: settings.amountStrategy || "INCREASE",
              orderTimeoutMinutes: settings.orderTimeoutMinutes || 5,
            });
          },
        },
        {
          key: "notices",
          label: "站点公告",
          run: () =>
            adminApi.getSiteNoticesPage({
              page: 1,
              size: DEFAULT_NOTICE_PAGE_SIZE,
            }),
          apply: (value) => {
            const result = value as PageResult<SiteNotice>;
            setSiteNotices(result.records);
            setNoticePage(result.page);
            setNoticePageSize(result.size);
            noticePageSizeRef.current = result.size;
            setNoticeTotal(result.total);
            setSelectedNoticeIds([]);
          },
        },
        {
          key: "noticeStats",
          label: "公告统计",
          run: adminApi.getSiteNoticeStats,
          apply: (value) => setNoticeStats(value as AdminSiteNoticeStats),
        },
        {
          key: "analytics",
          label: "访问概览",
          run: adminApi.getAnalyticsOverview,
          apply: (value) => setAnalytics(value as SiteAnalyticsOverview),
        },
        {
          key: "reports",
          label: "举报记录",
          run: () =>
            adminApi.getPostReportsPage({
              page: 1,
              size: DEFAULT_REPORT_PAGE_SIZE,
              status,
            }),
          apply: (value) => {
            const result = value as PageResult<AdminPostReport>;
            setPostReports(result.records);
            setReportPage(result.page);
            setReportPageSize(result.size);
            reportPageSizeRef.current = result.size;
            setReportTotal(result.total);
            setSelectedReportIds([]);
          },
        },
        {
          key: "reportStats",
          label: "举报统计",
          run: adminApi.getPostReportStats,
          apply: (value) => setReportStats(value as AdminPostReportStats),
        },
        {
          key: "logs",
          label: "操作日志",
          run: () =>
            adminApi.getOperationLogsPage({
              page: 1,
              size: DEFAULT_LOG_PAGE_SIZE,
            }),
          apply: (value) => {
            const result = value as PageResult<AdminOperationLog>;
            setOperationLogs(result.records);
            setLogPage(result.page);
            setLogPageSize(result.size);
            logPageSizeRef.current = result.size;
            setLogTotal(result.total);
          },
        },
        {
          key: "mailLogs",
          label: "邮件记录",
          run: () =>
            adminApi.getMailSendLogs({
              page: 1,
              size: DEFAULT_LOG_PAGE_SIZE,
            }),
          apply: (value) => {
            const result = value as PageResult<MailSendLog>;
            setMailSendLogs(result.records);
            setMailLogPage(result.page);
            setMailLogPageSize(result.size);
            mailLogPageSizeRef.current = result.size;
            setMailLogTotal(result.total);
          },
        },
      ];

      const results = await Promise.allSettled(tasks.map((task) => task.run()));
      if (!isLatestRequest()) {
        return;
      }

      const nextErrors: Record<string, string> = {};

      results.forEach((result, index) => {
        const task = tasks[index];
        if (result.status === "fulfilled") {
          task.apply(result.value);
          return;
        }

        nextErrors[task.key] = textError(
          result.reason,
          `${task.label}加载失败`,
        );
      });

      setSectionErrors(nextErrors);
      setLastLoadedAt(formatAdminRefreshTime(new Date()));
      setLoading(false);

      const failedCount = Object.keys(nextErrors).length;
      if (failedCount > 0) {
        message.warning(`后台有 ${failedCount} 个模块加载失败，其余数据已保留`);
      }
    },
    [vmqForm],
  );

  const loadSystemHealth = useCallback(async () => {
    setSystemHealthLoading(true);
    try {
      const health = await adminApi.getSystemHealth();
      setSystemHealth(health);
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.systemHealth;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新系统状态失败");
      setSectionErrors((current) => ({ ...current, systemHealth: errorText }));
      message.error(errorText);
    } finally {
      setSystemHealthLoading(false);
    }
  }, []);

  const loadInviteCodes = useCallback(
    async (
      page = 1,
      size = DEFAULT_INVITE_PAGE_SIZE,
      keyword = "",
      status = "ALL",
    ) => {
      const isLatestRequest = beginAdminRequest(inviteRequestRef);
      setInviteLoading(true);
      try {
        const result = await adminApi.getInviteCodesPage({
          page,
          size,
          keyword,
          status,
        });
        if (!isLatestRequest()) {
          return;
        }
        setInviteCodes(result.records);
        setInvitePage(result.page);
        setInvitePageSize(result.size);
        invitePageSizeRef.current = result.size;
        setInviteTotal(result.total);
        setSelectedInviteIds([]);
        setSectionErrors((current) => {
          const next = { ...current };
          delete next.invite;
          return next;
        });
      } catch (error) {
        if (!isLatestRequest()) {
          return;
        }
        const errorText = textError(error, "刷新邀请码失败");
        setSectionErrors((current) => ({ ...current, invite: errorText }));
        message.error(errorText);
      } finally {
        if (isLatestRequest()) {
          setInviteLoading(false);
        }
      }
    },
    [],
  );

  const loadInviteStats = useCallback(async () => {
    try {
      const stats = await adminApi.getInviteCodeStats();
      setInviteStats(stats);
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.inviteStats;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新邀请码统计失败");
      setSectionErrors((current) => ({ ...current, inviteStats: errorText }));
      message.error(errorText);
    }
  }, []);

  const loadDownloads = useCallback(
    async (
      page = 1,
      size = DEFAULT_DOWNLOAD_PAGE_SIZE,
      keyword = "",
      mode = "ALL",
    ) => {
      const isLatestRequest = beginAdminRequest(downloadRequestRef);
      setDownloadLoading(true);
      try {
        const result = await adminApi.getDownloadsPage({
          page,
          size,
          keyword,
          mode,
        });
        if (!isLatestRequest()) {
          return;
        }
        setDownloads(result.records);
        setDownloadPage(result.page);
        setDownloadPageSize(result.size);
        downloadPageSizeRef.current = result.size;
        setDownloadTotal(result.total);
        setSectionErrors((current) => {
          const next = { ...current };
          delete next.downloads;
          return next;
        });
      } catch (error) {
        if (!isLatestRequest()) {
          return;
        }
        const errorText = textError(error, "刷新下载内容失败");
        setSectionErrors((current) => ({ ...current, downloads: errorText }));
        message.error(errorText);
      } finally {
        if (isLatestRequest()) {
          setDownloadLoading(false);
        }
      }
    },
    [],
  );

  const loadDownloadStats = useCallback(async () => {
    try {
      const stats = await adminApi.getDownloadStats();
      setDownloadStats(stats);
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.downloadStats;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新下载统计失败");
      setSectionErrors((current) => ({ ...current, downloadStats: errorText }));
      message.error(errorText);
    }
  }, []);

  const loadProducts = useCallback(
    async (
      page = 1,
      size = DEFAULT_PRODUCT_PAGE_SIZE,
      keyword = "",
      status = "ALL",
    ) => {
      const isLatestRequest = beginAdminRequest(productRequestRef);
      setProductLoading(true);
      try {
        const result = await adminApi.getProductsPage({
          page,
          size,
          keyword,
          status,
        });
        if (!isLatestRequest()) {
          return;
        }
        setProducts(result.records);
        setProductPage(result.page);
        setProductPageSize(result.size);
        productPageSizeRef.current = result.size;
        setProductTotal(result.total);
        setSectionErrors((current) => {
          const next = { ...current };
          delete next.products;
          return next;
        });
      } catch (error) {
        if (!isLatestRequest()) {
          return;
        }
        const errorText = textError(error, "刷新商品内容失败");
        setSectionErrors((current) => ({ ...current, products: errorText }));
        message.error(errorText);
      } finally {
        if (isLatestRequest()) {
          setProductLoading(false);
        }
      }
    },
    [],
  );

  const loadProductStats = useCallback(async () => {
    try {
      const stats = await adminApi.getProductStats();
      setProductStats(stats);
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.productStats;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新商品统计失败");
      setSectionErrors((current) => ({ ...current, productStats: errorText }));
      message.error(errorText);
    }
  }, []);

  const loadProductOptions = useCallback(async () => {
    try {
      const options = await adminApi.getProducts();
      setCouponProductOptions(sortByOrder(options));
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.productOptions;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新商品选项失败");
      setSectionErrors((current) => ({
        ...current,
        productOptions: errorText,
      }));
      message.error(errorText);
    }
  }, []);

  const loadUsers = useCallback(
    async (
      page = 1,
      size = DEFAULT_USER_PAGE_SIZE,
      keyword = "",
      role = "ALL",
      status = "ALL",
    ) => {
      const isLatestRequest = beginAdminRequest(userRequestRef);
      setUserLoading(true);
      try {
        const result = await adminApi.getUsersPage({
          page,
          size,
          keyword,
          role,
          status,
        });
        if (!isLatestRequest()) {
          return;
        }
        setUsers(result.records);
        setUserPage(result.page);
        setUserPageSize(result.size);
        userPageSizeRef.current = result.size;
        setUserTotal(result.total);
        setSectionErrors((current) => {
          const next = { ...current };
          delete next.users;
          return next;
        });
      } catch (error) {
        if (!isLatestRequest()) {
          return;
        }
        const errorText = textError(error, "刷新用户列表失败");
        setSectionErrors((current) => ({ ...current, users: errorText }));
        message.error(errorText);
      } finally {
        if (isLatestRequest()) {
          setUserLoading(false);
        }
      }
    },
    [],
  );

  const loadUserStats = useCallback(async () => {
    try {
      const stats = await adminApi.getUserStats();
      setUserStats(stats);
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.userStats;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新用户统计失败");
      setSectionErrors((current) => ({ ...current, userStats: errorText }));
      message.error(errorText);
    }
  }, []);

  const loadSiteNotices = useCallback(
    async (
      page = 1,
      size = DEFAULT_NOTICE_PAGE_SIZE,
      keyword = "",
      status = "ALL",
    ) => {
      const isLatestRequest = beginAdminRequest(noticeRequestRef);
      setNoticeLoading(true);
      try {
        const result = await adminApi.getSiteNoticesPage({
          page,
          size,
          keyword,
          status,
        });
        if (!isLatestRequest()) {
          return;
        }
        setSiteNotices(result.records);
        setNoticePage(result.page);
        setNoticePageSize(result.size);
        noticePageSizeRef.current = result.size;
        setNoticeTotal(result.total);
        setSelectedNoticeIds([]);
        setSectionErrors((current) => {
          const next = { ...current };
          delete next.notices;
          return next;
        });
      } catch (error) {
        if (!isLatestRequest()) {
          return;
        }
        const errorText = textError(error, "刷新站点公告失败");
        setSectionErrors((current) => ({ ...current, notices: errorText }));
        message.error(errorText);
      } finally {
        if (isLatestRequest()) {
          setNoticeLoading(false);
        }
      }
    },
    [],
  );

  const loadSiteNoticeStats = useCallback(async () => {
    try {
      const stats = await adminApi.getSiteNoticeStats();
      setNoticeStats(stats);
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.noticeStats;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新公告统计失败");
      setSectionErrors((current) => ({ ...current, noticeStats: errorText }));
      message.error(errorText);
    }
  }, []);

  const loadPaymentOrders = useCallback(
    async (
      page = 1,
      size = DEFAULT_PAYMENT_ORDER_PAGE_SIZE,
      keyword = "",
      status = "ALL",
      resourceType = "ALL",
      errorFilter = "ALL",
      couponFilter = "ALL",
      supportFilter = "ALL",
    ) => {
      const isLatestRequest = beginAdminRequest(paymentRequestRef);
      setPaymentLoading(true);
      try {
        const result = await adminApi.getPaymentOrders({
          page,
          size,
          keyword,
          status,
          resourceType,
          hasError: paymentErrorFilterValue(errorFilter),
          hasCoupon: paymentCouponFilterValue(couponFilter),
          supportStatus: supportFilter,
        });
        if (!isLatestRequest()) {
          return;
        }
        setPaymentOrders(result.records);
        setPaymentPage(result.page);
        setPaymentPageSize(result.size);
        paymentPageSizeRef.current = result.size;
        setPaymentTotal(result.total);
        setSectionErrors((current) => {
          const next = { ...current };
          delete next.payments;
          return next;
        });
      } catch (error) {
        if (!isLatestRequest()) {
          return;
        }
        const errorText = textError(error, "刷新支付订单失败");
        setSectionErrors((current) => ({ ...current, payments: errorText }));
        message.error(errorText);
      } finally {
        if (isLatestRequest()) {
          setPaymentLoading(false);
        }
      }
    },
    [],
  );

  const loadPaymentStats = useCallback(async () => {
    try {
      const stats = await adminApi.getPaymentOrderStats();
      setPaymentStats(stats);
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.paymentStats;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新支付订单统计失败");
      setSectionErrors((current) => ({ ...current, paymentStats: errorText }));
      message.error(errorText);
    }
  }, []);

  const loadCouponCodes = useCallback(
    async (
      page = 1,
      size = DEFAULT_COUPON_PAGE_SIZE,
      keyword = "",
      productId: string | number = "ALL",
      status = "ALL",
    ) => {
      const isLatestRequest = beginAdminRequest(couponRequestRef);
      setCouponLoading(true);
      try {
        const result = await adminApi.getProductCouponCodes({
          page,
          size,
          keyword,
          productId,
          status,
        });
        if (!isLatestRequest()) {
          return;
        }
        setCouponCodes(result.records);
        setCouponPage(result.page);
        setCouponPageSize(result.size);
        couponPageSizeRef.current = result.size;
        setCouponTotal(result.total);
        setSelectedCouponCodeIds([]);
        setSectionErrors((current) => {
          const next = { ...current };
          delete next.coupons;
          return next;
        });
      } catch (error) {
        if (!isLatestRequest()) {
          return;
        }
        const errorText = textError(error, "刷新优惠码失败");
        setSectionErrors((current) => ({ ...current, coupons: errorText }));
        message.error(errorText);
      } finally {
        if (isLatestRequest()) {
          setCouponLoading(false);
        }
      }
    },
    [],
  );

  const loadCouponStats = useCallback(async () => {
    try {
      const stats = await adminApi.getProductCouponStats();
      setCouponStats(stats);
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.couponStats;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新优惠码统计失败");
      setSectionErrors((current) => ({ ...current, couponStats: errorText }));
      message.error(errorText);
    }
  }, []);

  const loadDeliveryCodes = useCallback(
    async (
      page = 1,
      size = DEFAULT_DELIVERY_CODE_PAGE_SIZE,
      keyword = "",
      productId: string | number = "ALL",
      status = "ALL",
    ) => {
      const isLatestRequest = beginAdminRequest(deliveryCodeRequestRef);
      setDeliveryCodeLoading(true);
      try {
        const result = await adminApi.getProductDeliveryCodes({
          page,
          size,
          keyword,
          productId,
          status,
        });
        if (!isLatestRequest()) {
          return;
        }
        setDeliveryCodes(result.records);
        setDeliveryCodePage(result.page);
        setDeliveryCodePageSize(result.size);
        deliveryCodePageSizeRef.current = result.size;
        setDeliveryCodeTotal(result.total);
        setSelectedDeliveryCodeIds([]);
        setSectionErrors((current) => {
          const next = { ...current };
          delete next.deliveryCodes;
          return next;
        });
      } catch (error) {
        if (!isLatestRequest()) {
          return;
        }
        const errorText = textError(error, "刷新CDK库存失败");
        setSectionErrors((current) => ({
          ...current,
          deliveryCodes: errorText,
        }));
        message.error(errorText);
      } finally {
        if (isLatestRequest()) {
          setDeliveryCodeLoading(false);
        }
      }
    },
    [],
  );

  const loadDeliveryCodeStats = useCallback(async () => {
    try {
      const stats = await adminApi.getProductDeliveryCodeStats();
      setDeliveryCodeStats(stats);
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.deliveryCodeStats;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新CDK统计失败");
      setSectionErrors((current) => ({
        ...current,
        deliveryCodeStats: errorText,
      }));
      message.error(errorText);
    }
  }, []);

  useEffect(() => {
    if (!couponQueryMountedRef.current) {
      couponQueryMountedRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadCouponCodes(
        1,
        couponPageSizeRef.current,
        couponKeyword,
        couponProductFilter,
        couponStatusFilter,
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    couponKeyword,
    couponProductFilter,
    couponStatusFilter,
    loadCouponCodes,
  ]);

  useEffect(() => {
    if (!deliveryCodeQueryMountedRef.current) {
      deliveryCodeQueryMountedRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadDeliveryCodes(
        1,
        deliveryCodePageSizeRef.current,
        deliveryCodeKeyword,
        deliveryCodeProductFilter,
        deliveryCodeStatusFilter,
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    deliveryCodeKeyword,
    deliveryCodeProductFilter,
    deliveryCodeStatusFilter,
    loadDeliveryCodes,
  ]);

  useEffect(() => {
    if (!paymentQueryMountedRef.current) {
      paymentQueryMountedRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadPaymentOrders(
        1,
        paymentPageSizeRef.current,
        paymentKeyword,
        paymentStatusFilter,
        paymentResourceFilter,
        paymentErrorFilter,
        paymentCouponFilter,
        paymentSupportFilter,
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    loadPaymentOrders,
    paymentCouponFilter,
    paymentErrorFilter,
    paymentKeyword,
    paymentResourceFilter,
    paymentStatusFilter,
    paymentSupportFilter,
  ]);

  useEffect(() => {
    inviteForm.setFieldsValue({ count: 3, expiresInDays: 7 });
    downloadForm.setFieldsValue({
      locked: false,
      passwordProtected: false,
      sortOrder: 0,
    });
    productForm.setFieldsValue({
      stock: 0,
      deliveryType: "NONE",
      status: "PUBLISHED",
      sortOrder: 0,
    });
    couponForm.setFieldsValue({
      count: 10,
      discountType: "AMOUNT",
      expiresInDays: 30,
      prefix: "IDN",
    });
    deliveryCodeForm.setFieldsValue({ note: "" });
    noticeForm.setFieldsValue({ published: true, sortOrder: 0 });
    vmqForm.setFieldsValue({
      enabled: false,
      preferred: true,
      payType: 2,
      amountStrategy: "INCREASE",
      orderTimeoutMinutes: 5,
    });
    void loadAll("ALL");
  }, [
    couponForm,
    deliveryCodeForm,
    downloadForm,
    inviteForm,
    loadAll,
    noticeForm,
    productForm,
    vmqForm,
  ]);

  useEffect(() => {
    if (!userQueryMountedRef.current) {
      userQueryMountedRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadUsers(
        1,
        userPageSizeRef.current,
        userKeyword,
        userRoleFilter,
        userStatusFilter,
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loadUsers, userKeyword, userRoleFilter, userStatusFilter]);

  useEffect(() => {
    if (!inviteQueryMountedRef.current) {
      inviteQueryMountedRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadInviteCodes(
        1,
        invitePageSizeRef.current,
        inviteKeyword,
        inviteStatusFilter,
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [inviteKeyword, inviteStatusFilter, loadInviteCodes]);

  useEffect(() => {
    if (!downloadQueryMountedRef.current) {
      downloadQueryMountedRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadDownloads(
        1,
        downloadPageSizeRef.current,
        downloadKeyword,
        downloadModeFilter,
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [downloadKeyword, downloadModeFilter, loadDownloads]);

  useEffect(() => {
    if (!productQueryMountedRef.current) {
      productQueryMountedRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadProducts(
        1,
        productPageSizeRef.current,
        productKeyword,
        productStatusFilter,
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loadProducts, productKeyword, productStatusFilter]);

  useEffect(() => {
    if (!noticeQueryMountedRef.current) {
      noticeQueryMountedRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadSiteNotices(
        1,
        noticePageSizeRef.current,
        noticeKeyword,
        noticeStatusFilter,
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loadSiteNotices, noticeKeyword, noticeStatusFilter]);

  const loadOperationLogs = useCallback(
    async (page = 1, size = DEFAULT_LOG_PAGE_SIZE, keyword = "") => {
      const isLatestRequest = beginAdminRequest(logRequestRef);
      setLogsLoading(true);
      try {
        const result = await adminApi.getOperationLogsPage({
          page,
          size,
          keyword,
        });
        if (!isLatestRequest()) {
          return;
        }
        setOperationLogs(result.records);
        setLogPage(result.page);
        setLogPageSize(result.size);
        logPageSizeRef.current = result.size;
        setLogTotal(result.total);
        setSectionErrors((current) => {
          const next = { ...current };
          delete next.logs;
          return next;
        });
      } catch (error) {
        if (!isLatestRequest()) {
          return;
        }
        const errorText = textError(error, "刷新操作日志失败");
        setSectionErrors((current) => ({ ...current, logs: errorText }));
        message.error(errorText);
      } finally {
        if (isLatestRequest()) {
          setLogsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!logQueryMountedRef.current) {
      logQueryMountedRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadOperationLogs(1, logPageSizeRef.current, logKeyword);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loadOperationLogs, logKeyword]);

  async function refreshLogs() {
    await loadOperationLogs(logPage, logPageSizeRef.current, logKeyword);
  }

  const loadMailSendLogs = useCallback(
    async (
      page = 1,
      size = DEFAULT_LOG_PAGE_SIZE,
      keyword = "",
      status = "ALL",
    ) => {
      const isLatestRequest = beginAdminRequest(mailLogRequestRef);
      setMailLogsLoading(true);
      try {
        const result = await adminApi.getMailSendLogs({
          page,
          size,
          keyword,
          status,
        });
        if (!isLatestRequest()) {
          return;
        }
        setMailSendLogs(result.records);
        setMailLogPage(result.page);
        setMailLogPageSize(result.size);
        mailLogPageSizeRef.current = result.size;
        setMailLogTotal(result.total);
        setSectionErrors((current) => {
          const next = { ...current };
          delete next.mailLogs;
          return next;
        });
      } catch (error) {
        if (!isLatestRequest()) {
          return;
        }
        const errorText = textError(error, "刷新邮件记录失败");
        setSectionErrors((current) => ({ ...current, mailLogs: errorText }));
        message.error(errorText);
      } finally {
        if (isLatestRequest()) {
          setMailLogsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!mailLogQueryMountedRef.current) {
      mailLogQueryMountedRef.current = true;
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void loadMailSendLogs(
        1,
        mailLogPageSizeRef.current,
        mailLogKeyword,
        mailLogStatusFilter,
      );
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loadMailSendLogs, mailLogKeyword, mailLogStatusFilter]);

  async function refreshMailLogs() {
    await loadMailSendLogs(
      mailLogPage,
      mailLogPageSizeRef.current,
      mailLogKeyword,
      mailLogStatusFilter,
    );
  }

  async function resetMailLogFilters() {
    setMailLogKeyword("");
    setMailLogStatusFilter("ALL");
    await loadMailSendLogs(1, mailLogPageSizeRef.current, "", "ALL");
  }

  const loadPostReports = useCallback(
    async (page = 1, size = DEFAULT_REPORT_PAGE_SIZE, status = "ALL") => {
      const isLatestRequest = beginAdminRequest(reportRequestRef);
      setReportLoading(true);
      try {
        const result = await adminApi.getPostReportsPage({
          page,
          size,
          status,
        });
        if (!isLatestRequest()) {
          return;
        }
        setPostReports(result.records);
        setReportPage(result.page);
        setReportPageSize(result.size);
        reportPageSizeRef.current = result.size;
        setReportTotal(result.total);
        setSelectedReportIds([]);
        setSectionErrors((current) => {
          const next = { ...current };
          delete next.reports;
          return next;
        });
      } catch (error) {
        if (!isLatestRequest()) {
          return;
        }
        const errorText = textError(error, "加载举报记录失败");
        setSectionErrors((current) => ({ ...current, reports: errorText }));
        message.error(errorText);
      } finally {
        if (isLatestRequest()) {
          setReportLoading(false);
        }
      }
    },
    [],
  );

  const loadPostReportStats = useCallback(async () => {
    try {
      const stats = await adminApi.getPostReportStats();
      setReportStats(stats);
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.reportStats;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新举报统计失败");
      setSectionErrors((current) => ({ ...current, reportStats: errorText }));
      message.error(errorText);
    }
  }, []);

  function paymentOrderMatchesCurrentFilters(order: AdminPaymentOrder) {
    const hasError = Boolean(order.lastError);
    const hasCoupon = Boolean(order.couponCode);
    return (
      (paymentStatusFilter === "ALL" || order.status === paymentStatusFilter) &&
      (paymentResourceFilter === "ALL" || order.resourceType === paymentResourceFilter) &&
      (paymentErrorFilter === "ALL" ||
        (paymentErrorFilter === "HAS_ERROR" ? hasError : !hasError)) &&
      (paymentCouponFilter === "ALL" ||
        (paymentCouponFilter === "HAS_COUPON" ? hasCoupon : !hasCoupon)) &&
      (paymentSupportFilter === "ALL" ||
        order.supportStatus === paymentSupportFilter)
    );
  }

  function getPaymentRefreshPage(updatedOrder: AdminPaymentOrder) {
    return getPageAfterVisibleRemovals(
      paymentPage,
      paymentOrders.length,
      paymentOrderMatchesCurrentFilters(updatedOrder) ? 0 : 1,
    );
  }

  async function refreshPaymentOrders(nextPage = paymentPage) {
    await Promise.all([
      loadPaymentOrders(
        nextPage,
        paymentPageSizeRef.current,
        paymentKeyword,
        paymentStatusFilter,
        paymentResourceFilter,
        paymentErrorFilter,
        paymentCouponFilter,
        paymentSupportFilter,
      ),
      loadPaymentStats(),
    ]);
  }

  function handlePaymentStatusFilter(status: string) {
    setPaymentStatusFilter(status);
  }

  function handlePaymentResourceFilter(resourceType: string) {
    setPaymentResourceFilter(resourceType);
  }

  function handlePaymentErrorFilter(errorFilter: string) {
    setPaymentErrorFilter(errorFilter);
  }

  function handlePaymentCouponFilter(couponFilter: string) {
    setPaymentCouponFilter(couponFilter);
  }

  function handlePaymentSupportFilter(supportFilter: string) {
    setPaymentSupportFilter(supportFilter);
  }

  async function handleSyncPaymentOrder(outTradeNo: string) {
    setPaymentActionLoading(outTradeNo);
    try {
      const updated = await adminApi.syncPaymentOrder(outTradeNo);
      const nextPage = getPaymentRefreshPage(updated);
      message.success("订单状态已同步");
      await Promise.all([
        refreshPaymentOrders(nextPage),
        loadCouponStats(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "同步支付订单失败"));
    } finally {
      setPaymentActionLoading(null);
    }
  }

  async function handleClosePaymentOrder(outTradeNo: string) {
    setPaymentActionLoading(outTradeNo);
    try {
      const updated = await adminApi.closePaymentOrder(outTradeNo);
      const nextPage = getPaymentRefreshPage(updated);
      message.success("支付订单已关闭");
      await Promise.all([
        refreshPaymentOrders(nextPage),
        loadCouponStats(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "关闭支付订单失败"));
    } finally {
      setPaymentActionLoading(null);
    }
  }

  async function handleManualConfirmPaymentOrder(outTradeNo: string) {
    setPaymentActionLoading(outTradeNo);
    try {
      const updated = await adminApi.manualConfirmPaymentOrder(outTradeNo, {
        note: "后台人工确认实际到账",
      });
      const nextPage = getPaymentRefreshPage(updated);
      message.success("已人工确认收款");
      await Promise.all([
        refreshPaymentOrders(nextPage),
        loadCouponStats(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "人工确认收款失败"));
    } finally {
      setPaymentActionLoading(null);
    }
  }

  async function handleResendPaymentOrderDelivery(outTradeNo: string) {
    setPaymentActionLoading(outTradeNo);
    try {
      const updated = await adminApi.resendPaymentOrderDelivery(outTradeNo);
      const nextPage = getPaymentRefreshPage(updated);
      message.success("商品发货邮件已重新发送");
      await Promise.all([refreshPaymentOrders(nextPage), refreshLogs()]);
    } catch (error) {
      message.error(textError(error, "重新发货失败"));
    } finally {
      setPaymentActionLoading(null);
    }
  }

  function openPaymentSupportReply(record: AdminPaymentOrder) {
    let reply = "";
    Modal.confirm({
      title: `回复订单售后：${record.outTradeNo}`,
      okText: "回复并关闭",
      cancelText: "取消",
      content: (
        <div className="mt-4 space-y-3">
          <Alert type="warning" showIcon message={record.supportMessage} />
          <Input.TextArea
            rows={4}
            maxLength={500}
            showCount
            placeholder="请输入处理结果或解决办法"
            onChange={(event) => {
              reply = event.target.value;
            }}
          />
        </div>
      ),
      async onOk() {
        const content = reply.trim();
        if (!content) {
          message.warning("请输入售后回复");
          throw new Error("售后回复不能为空");
        }
        setPaymentActionLoading(record.outTradeNo);
        try {
          const updated = await adminApi.replyPaymentOrderSupport(
            record.outTradeNo,
            content,
          );
          const nextPage = getPaymentRefreshPage(updated);
          message.success("售后已回复并关闭");
          await Promise.all([refreshPaymentOrders(nextPage), refreshLogs()]);
        } catch (error) {
          message.error(textError(error, "售后回复失败"));
          throw error;
        } finally {
          setPaymentActionLoading(null);
        }
      },
    });
  }

  function openPaymentResolveModal(record: AdminPaymentOrder) {
    setResolvingPaymentOrder(record);
    paymentResolveForm.setFieldsValue({ note: "" });
  }

  async function handleResolvePaymentOrder(values: { note?: string }) {
    if (!resolvingPaymentOrder) {
      return;
    }
    setPaymentActionLoading(resolvingPaymentOrder.outTradeNo);
    try {
      const updated = await adminApi.resolvePaymentOrder(
        resolvingPaymentOrder.outTradeNo,
        values,
      );
      const nextPage = getPaymentRefreshPage(updated);
      setResolvingPaymentOrder(null);
      paymentResolveForm.resetFields();
      message.success("支付异常已标记处理");
      await Promise.all([refreshPaymentOrders(nextPage), refreshLogs()]);
    } catch (error) {
      message.error(textError(error, "标记支付异常失败"));
    } finally {
      setPaymentActionLoading(null);
    }
  }

  function applyVmqSettings(settings: VmqPaymentSettings) {
    setVmqSettings(settings);
    vmqForm.setFieldsValue({
      enabled: settings.enabled,
      preferred: settings.preferred,
      payType: settings.payType,
      communicationKey: settings.communicationKey,
      wxPayUrl: settings.wxPayUrl || "",
      alipayPayUrl: settings.alipayPayUrl || "",
      amountStrategy: settings.amountStrategy || "INCREASE",
      orderTimeoutMinutes: settings.orderTimeoutMinutes || 5,
    });
  }

  async function loadVmqPaymentSettings() {
    setVmqLoading(true);
    try {
      const settings = await adminApi.getVmqPaymentSettings();
      applyVmqSettings(settings);
      setSectionErrors((current) => {
        const next = { ...current };
        delete next.vmqPayment;
        return next;
      });
    } catch (error) {
      const errorText = textError(error, "刷新V免签配置失败");
      setSectionErrors((current) => ({ ...current, vmqPayment: errorText }));
      message.error(errorText);
    } finally {
      setVmqLoading(false);
    }
  }

  async function handleSaveVmqSettings(values: SaveVmqPaymentSettingsPayload) {
    setVmqLoading(true);
    try {
      const settings = await adminApi.saveVmqPaymentSettings({
        enabled: Boolean(values.enabled),
        preferred: values.preferred !== false,
        payType: values.payType || 2,
        communicationKey: values.communicationKey,
        wxPayUrl: values.wxPayUrl,
        alipayPayUrl: values.alipayPayUrl,
        amountStrategy: values.amountStrategy || "INCREASE",
        orderTimeoutMinutes: values.orderTimeoutMinutes || 5,
      });
      applyVmqSettings(settings);
      message.success("V免签配置已保存");
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "保存V免签配置失败"));
    } finally {
      setVmqLoading(false);
    }
  }

  async function handleRegenerateVmqKey() {
    setVmqLoading(true);
    try {
      const settings = await adminApi.regenerateVmqPaymentKey();
      applyVmqSettings(settings);
      message.success("通讯密钥已重新生成");
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "重新生成通讯密钥失败"));
    } finally {
      setVmqLoading(false);
    }
  }

  function switchSection(id: AdminSectionId) {
    setActiveSection(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  function sectionPanelClassName(id: AdminSectionId) {
    return activeSection === id ? "block" : "hidden";
  }

  async function copyText(text: string, successText: string) {
    try {
      await navigator.clipboard.writeText(text);
      message.success(successText);
    } catch {
      message.warning("复制失败，请手动复制");
    }
  }

  function applyProductTemplate(templateKey: string) {
    const template = productTemplates.find((item) => item.key === templateKey);
    if (!template) {
      return;
    }

    setEditingProduct(null);
    productForm.setFieldsValue(template.values);
    message.success(`${template.label}已填入`);
  }

  function applyEmailProductTemplate(templateKey: string) {
    const template = emailProductTemplates.find(
      (item) => item.key === templateKey,
    );
    if (!template) {
      return;
    }

    productForm.setFieldsValue({
      title: template.title,
      subtitle: `${template.label} 邮箱验证码/取码链接自动发货`,
      description: `${template.label} 邮箱取码链接商品，适合验证码接收、账号验证、会员兑换或数字资源交付。购买后系统会把取码链接发送到订单邮箱。`,
      imageUrl: DEFAULT_CDK_PRODUCT_IMAGE_URL,
      price: productForm.getFieldValue("price") ?? 9.9,
      stock: 0,
      deliveryType: "CDK_EMAIL",
      deliveryInstructions:
        productForm.getFieldValue("deliveryInstructions") ||
        DEFAULT_CDK_DELIVERY_INSTRUCTIONS,
      status: productForm.getFieldValue("status") ?? "DRAFT",
      sortOrder: productForm.getFieldValue("sortOrder") ?? 0,
    });
    message.success(`${template.label} 商品类型已填入`);
  }

  function applyDefaultProductImage(imageUrl: string, label: string) {
    productForm.setFieldValue("imageUrl", imageUrl);
    message.success(`已选择${label}`);
  }

  function handleProductDeliveryTypeChange(
    value: SaveProductPayload["deliveryType"],
  ) {
    if (value === "CDK_EMAIL") {
      productForm.setFieldsValue({
        stock: 0,
        imageUrl:
          productForm.getFieldValue("imageUrl") ||
          DEFAULT_CDK_PRODUCT_IMAGE_URL,
        deliveryInstructions:
          productForm.getFieldValue("deliveryInstructions") ||
          DEFAULT_CDK_DELIVERY_INSTRUCTIONS,
      });
      return;
    }

    productForm.setFieldsValue({
      stock: productForm.getFieldValue("stock") ?? 0,
    });
  }

  function applyDeliveryCodeImportTemplate() {
    deliveryCodeForm.setFieldsValue({
      content: deliveryCodeImportTemplate,
      note: deliveryCodeForm.getFieldValue("note") || "模板批次",
    });
    message.success("CDK导入示例已填入");
  }

  function downloadDeliveryCodeImportTemplate() {
    const blob = new Blob([deliveryCodeImportTemplate], {
      type: "text/plain;charset=utf-8",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cdk-import-template.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    message.success("CDK导入模板已下载");
  }

  const canManageUser = (target: User) =>
    !!user &&
    (user.role === "OWNER" ? target.role !== "OWNER" : target.role === "USER");

  const canDisableUser = (target: User) =>
    !!user &&
    user.id !== target.id &&
    target.status !== "DISABLED" &&
    (user.role === "OWNER" ? target.role !== "OWNER" : target.role === "USER");

  async function handleReportFilter(status: string) {
    setReportStatus(status);
    setSelectedReportIds([]);
    await loadPostReports(1, reportPageSizeRef.current, status);
  }

  async function handleCreateInvite(values: {
    count: number;
    expiresInDays: number;
  }) {
    setSubmitting(true);
    try {
      const created = await adminApi.createInviteCodes(values);
      message.success(`邀请码生成成功，本次新增 ${created.length} 个`);
      await Promise.all([
        loadInviteCodes(
          1,
          invitePageSizeRef.current,
          inviteKeyword,
          inviteStatusFilter,
        ),
        loadInviteStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "邀请码生成失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteInvite(id: number) {
    setSubmitting(true);
    try {
      await adminApi.deleteInviteCode(id);
      setSelectedInviteIds((current) => current.filter((item) => item !== id));
      const nextPage =
        inviteCodes.length <= 1 && invitePage > 1 ? invitePage - 1 : invitePage;
      message.success("邀请码已删除");
      await Promise.all([
        loadInviteCodes(
          nextPage,
          invitePageSizeRef.current,
          inviteKeyword,
          inviteStatusFilter,
        ),
        loadInviteStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "删除邀请码失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSelectedInvites() {
    if (selectedInviteIds.length === 0) {
      message.warning("请先勾选要删除的邀请码");
      return;
    }

    const selectedIdSet = new Set(selectedInviteIds);
    const targets = inviteCodes.filter((item) => selectedIdSet.has(item.id));
    if (targets.length === 0) {
      message.warning("所选邀请码不存在或已被删除");
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        targets.map((item) => adminApi.deleteInviteCode(item.id)),
      );
      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;
      if (successCount > 0) {
        message.success(
          `已删除 ${successCount} 个邀请码${failedCount > 0 ? `，${failedCount} 个失败` : ""}`,
        );
      } else {
        message.error("批量删除邀请码失败");
      }
      setSelectedInviteIds([]);
      const nextPage =
        inviteCodes.length <= successCount && invitePage > 1
          ? invitePage - 1
          : invitePage;
      await Promise.all([
        loadInviteCodes(
          nextPage,
          invitePageSizeRef.current,
          inviteKeyword,
          inviteStatusFilter,
        ),
        loadInviteStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "批量删除邀请码失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveUser(values: AdminUpdateUserPayload) {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      await adminApi.updateUser(editingUser.id, values);
      setEditingUser(null);
      userForm.resetFields();
      message.success("用户资料已更新");
      await Promise.all([
        loadUsers(
          userPage,
          userPageSizeRef.current,
          userKeyword,
          userRoleFilter,
          userStatusFilter,
        ),
        loadUserStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "更新用户失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisableUser(id: number) {
    setSubmitting(true);
    try {
      await adminApi.updateUser(id, { status: "DISABLED" });
      message.success("用户已禁用，当前登录会话已撤销");
      await Promise.all([
        loadUsers(
          userPage,
          userPageSizeRef.current,
          userKeyword,
          userRoleFilter,
          userStatusFilter,
        ),
        loadUserStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "禁用用户失败"));
    } finally {
      setSubmitting(false);
    }
  }

  function resetDownloadEditor() {
    setEditingDownload(null);
    downloadForm.resetFields();
    downloadForm.setFieldsValue({
      locked: false,
      passwordProtected: false,
      sortOrder: 0,
    });
  }

  function openDownloadEditor(record: DownloadResource) {
    setEditingDownload(record);
    downloadForm.setFieldsValue({
      title: record.title,
      category: record.category ?? "",
      version: record.version ?? "",
      url: record.url,
      fileSize: record.fileSize ?? "",
      sortOrder: record.sortOrder ?? 0,
      checksumSha256: record.checksumSha256 ?? "",
      changelog: record.changelog ?? "",
      locked: record.locked,
      passwordProtected: record.passwordProtected,
      downloadPassword: "",
    });
    switchSection("downloads");
  }

  async function handleSaveDownload(values: CreateDownloadResourcePayload) {
    setSubmitting(true);
    try {
      const wasEditing = Boolean(editingDownload);
      if (editingDownload) {
        await adminApi.updateDownload(editingDownload.id, values);
        message.success("下载内容更新成功");
      } else {
        await adminApi.createDownload(values);
        message.success("下载内容新增成功");
      }
      resetDownloadEditor();
      await Promise.all([
        loadDownloads(
          wasEditing ? downloadPage : 1,
          downloadPageSizeRef.current,
          downloadKeyword,
          downloadModeFilter,
        ),
        loadDownloadStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(
        textError(
          error,
          editingDownload ? "下载内容更新失败" : "下载内容新增失败",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadDownloadFile(file: File) {
    if (uploadingDownloadFile) {
      message.warning("文件正在上传中，请稍候");
      return;
    }
    if (file.size > DOWNLOAD_UPLOAD_MAX_SIZE_BYTES) {
      message.error("文件大小不能超过 1GB");
      return;
    }

    setUploadingDownloadFile(true);
    try {
      const uploaded = await adminApi.uploadDownloadFile(file);
      const currentTitle = String(
        downloadForm.getFieldValue("title") ?? "",
      ).trim();
      const autoTitle = uploaded.originalFileName.replace(/\.[^/.]+$/, "");
      downloadForm.setFieldsValue({
        title: currentTitle || autoTitle || uploaded.originalFileName,
        url: uploaded.fileUrl,
        fileSize: uploaded.fileSizeText || undefined,
      });
      message.success("文件上传成功，已自动填充下载链接和文件大小");
    } catch (error) {
      message.error(textError(error, "上传下载文件失败"));
    } finally {
      setUploadingDownloadFile(false);
    }
  }

  const handleDownloadFileBeforeUpload: UploadProps["beforeUpload"] = (
    file,
  ) => {
    void uploadDownloadFile(file as File);
    return false;
  };

  async function handleDeleteDownload(id: number) {
    setSubmitting(true);
    try {
      await adminApi.deleteDownload(id);
      const nextPage =
        downloads.length <= 1 && downloadPage > 1
          ? downloadPage - 1
          : downloadPage;
      if (editingDownload?.id === id) {
        resetDownloadEditor();
      }
      message.success("下载内容已删除");
      await Promise.all([
        loadDownloads(
          nextPage,
          downloadPageSizeRef.current,
          downloadKeyword,
          downloadModeFilter,
        ),
        loadDownloadStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "删除下载内容失败"));
    } finally {
      setSubmitting(false);
    }
  }

  function resetProductEditor() {
    setEditingProduct(null);
    productForm.resetFields();
    productForm.setFieldsValue({
      stock: 0,
      deliveryType: "NONE",
      status: "PUBLISHED",
      sortOrder: 0,
    });
  }

  function openProductEditor(record: Product) {
    setEditingProduct(record);
    productForm.setFieldsValue({
      title: record.title,
      subtitle: record.subtitle ?? "",
      description: record.description ?? "",
      imageUrl: record.imageUrl ?? "",
      price: record.price,
      stock: record.deliveryType === "CDK_EMAIL" ? 0 : (record.stock ?? 0),
      deliveryType:
        (record.deliveryType as SaveProductPayload["deliveryType"]) ?? "NONE",
      deliveryInstructions: record.deliveryInstructions ?? "",
      status: (record.status as SaveProductPayload["status"]) ?? "DRAFT",
      sortOrder: record.sortOrder ?? 0,
    });
    switchSection("products");
  }

  async function handleFilterProductDeliveryCodes(record: Product) {
    setDeliveryCodeKeyword("");
    setDeliveryCodeProductFilter(record.id);
    setDeliveryCodeStatusFilter("ALL");
    await loadDeliveryCodes(
      1,
      deliveryCodePageSizeRef.current,
      "",
      record.id,
      "ALL",
    );
    switchSection("delivery-codes");
  }

  async function openDeliveryCodeRestock(record: Product) {
    if (record.deliveryType !== "CDK_EMAIL") {
      return;
    }

    deliveryCodeForm.setFieldsValue({
      productId: record.id,
      content: "",
      note: `${record.title}补货`,
    });
    setDeliveryCodeKeyword("");
    setDeliveryCodeProductFilter(record.id);
    setDeliveryCodeStatusFilter("AVAILABLE");
    setSelectedDeliveryCodeIds([]);
    switchSection("delivery-codes");
    await loadDeliveryCodes(
      1,
      deliveryCodePageSizeRef.current,
      "",
      record.id,
      "AVAILABLE",
    );
  }

  async function handleSaveProduct(values: SaveProductPayload) {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        stock: values.deliveryType === "CDK_EMAIL" ? 0 : values.stock,
      };
      const nextPage = editingProduct ? productPage : 1;
      if (editingProduct) {
        await adminApi.updateProduct(editingProduct.id, payload);
        message.success("商品更新成功");
      } else {
        await adminApi.createProduct(payload);
        message.success("商品新增成功");
      }
      resetProductEditor();
      await Promise.all([
        loadProducts(
          nextPage,
          productPageSizeRef.current,
          productKeyword,
          productStatusFilter,
        ),
        loadProductStats(),
        loadProductOptions(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(
        textError(error, editingProduct ? "商品更新失败" : "商品新增失败"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadProductImage(file: File) {
    if (uploadingProductImage) {
      message.warning("商品图片正在上传中，请稍候");
      return;
    }
    if (!isAllowedImageFile(file)) {
      message.error("仅支持 JPG、PNG、WEBP、GIF 图片");
      return;
    }
    if (file.size > IMAGE_MAX_SIZE_BYTES) {
      message.error("商品图片不能超过 8MB");
      return;
    }

    setUploadingProductImage(true);
    try {
      const uploaded = await adminApi.uploadProductImage(file);
      productForm.setFieldsValue({ imageUrl: uploaded.url });
      message.success("商品图片上传成功");
    } catch (error) {
      message.error(textError(error, "上传商品图片失败"));
    } finally {
      setUploadingProductImage(false);
    }
  }

  const handleProductImageBeforeUpload: UploadProps["beforeUpload"] = (
    file,
  ) => {
    void uploadProductImage(file as File);
    return false;
  };

  async function handleDeleteProduct(id: number) {
    setSubmitting(true);
    try {
      await adminApi.deleteProduct(id);
      const nextPage =
        products.length <= 1 && productPage > 1 ? productPage - 1 : productPage;
      if (editingProduct?.id === id) {
        resetProductEditor();
      }
      message.success("商品已删除");
      await Promise.all([
        loadProducts(
          nextPage,
          productPageSizeRef.current,
          productKeyword,
          productStatusFilter,
        ),
        loadProductStats(),
        loadProductOptions(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "删除商品失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function resetInviteFilters() {
    setInviteKeyword("");
    setInviteStatusFilter("ALL");
    setSelectedInviteIds([]);
    await loadInviteCodes(1, invitePageSizeRef.current, "", "ALL");
  }

  async function resetUserFilters() {
    setUserKeyword("");
    setUserRoleFilter("ALL");
    setUserStatusFilter("ALL");
    await loadUsers(1, userPageSizeRef.current, "", "ALL", "ALL");
  }

  async function resetProductFilters() {
    setProductKeyword("");
    setProductStatusFilter("ALL");
    await loadProducts(1, productPageSizeRef.current, "", "ALL");
  }

  async function resetDownloadFilters() {
    setDownloadKeyword("");
    setDownloadModeFilter("ALL");
    await loadDownloads(1, downloadPageSizeRef.current, "", "ALL");
  }

  async function refreshCouponCodes(nextPage = couponPage) {
    await loadCouponCodes(
      nextPage,
      couponPageSizeRef.current,
      couponKeyword,
      couponProductFilter,
      couponStatusFilter,
    );
  }

  async function resetCouponFilters() {
    setCouponKeyword("");
    setCouponProductFilter("ALL");
    setCouponStatusFilter("ALL");
    setSelectedCouponCodeIds([]);
    await loadCouponCodes(1, couponPageSizeRef.current, "", "ALL", "ALL");
  }

  async function handleCreateCouponCodes(
    values: CreateProductCouponCodesPayload,
  ) {
    setSubmitting(true);
    try {
      const created = await adminApi.createProductCouponCodes(values);
      message.success(`优惠码生成成功，本次新增 ${created.length} 个`);
      couponForm.resetFields();
      couponForm.setFieldsValue({
        productId: values.productId,
        count: 10,
        discountType: values.discountType ?? "AMOUNT",
        expiresInDays: values.expiresInDays ?? 30,
        prefix: values.prefix || "IDN",
      });
      const batchNo = created[0]?.batchNo || "";
      if (batchNo) {
        setCouponKeyword(batchNo);
        setCouponProductFilter("ALL");
        setCouponStatusFilter("ALL");
      }
      await Promise.all([
        loadCouponCodes(
          1,
          couponPageSizeRef.current,
          batchNo || couponKeyword,
          batchNo ? "ALL" : couponProductFilter,
          batchNo ? "ALL" : couponStatusFilter,
        ),
        loadCouponStats(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "优惠码生成失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisableCouponCode(id: number) {
    const rowLeavesCurrentFilter = couponStatusFilter !== "ALL";
    const nextPage = getPageAfterVisibleRemovals(
      couponPage,
      couponCodes.length,
      rowLeavesCurrentFilter ? 1 : 0,
    );
    setSubmitting(true);
    try {
      await adminApi.disableProductCouponCode(id);
      setSelectedCouponCodeIds((current) =>
        current.filter((item) => item !== id),
      );
      message.success("优惠码已作废");
      await Promise.all([
        refreshCouponCodes(nextPage),
        loadCouponStats(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "作废优惠码失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisableSelectedCouponCodes() {
    if (selectedCouponCodeIds.length === 0) {
      message.warning("请先勾选要处理的优惠码");
      return;
    }

    const selectedIdSet = new Set(selectedCouponCodeIds);
    const targets = couponCodes.filter(
      (item) =>
        selectedIdSet.has(item.id) &&
        (item.status === "ACTIVE" || item.status === "EXPIRED"),
    );
    if (targets.length === 0) {
      message.warning("所选优惠码里没有可作废的可用或已过期项");
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        targets.map((item) => adminApi.disableProductCouponCode(item.id)),
      );
      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;
      if (successCount > 0) {
        message.success(
          `已作废 ${successCount} 个优惠码${failedCount > 0 ? `，${failedCount} 个失败` : ""}`,
        );
      } else {
        message.error("批量作废优惠码失败");
      }
      setSelectedCouponCodeIds([]);
      const nextPage = getPageAfterVisibleRemovals(
        couponPage,
        couponCodes.length,
        couponStatusFilter !== "ALL" ? successCount : 0,
      );
      await Promise.all([
        refreshCouponCodes(nextPage),
        loadCouponStats(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "批量作废优惠码失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFilterCouponBatch(batchNo?: string | null) {
    const normalizedBatchNo = String(batchNo ?? "").trim();
    if (!normalizedBatchNo) {
      return;
    }
    setCouponKeyword(normalizedBatchNo);
    setCouponProductFilter("ALL");
    setCouponStatusFilter("ALL");
    await loadCouponCodes(
      1,
      couponPageSizeRef.current,
      normalizedBatchNo,
      "ALL",
      "ALL",
    );
  }

  async function handleDisableCouponBatch(batchNo?: string | null) {
    const normalizedBatchNo = String(batchNo ?? "").trim();
    if (!normalizedBatchNo) {
      message.warning("当前优惠码没有批次号");
      return;
    }
    setSubmitting(true);
    try {
      const records =
        await adminApi.disableProductCouponBatch(normalizedBatchNo);
      setCouponKeyword(normalizedBatchNo);
      setCouponProductFilter("ALL");
      setCouponStatusFilter("ALL");
      message.success(
        `批次 ${normalizedBatchNo} 已处理，共 ${records.length} 个优惠码`,
      );
      await Promise.all([
        loadCouponCodes(
          1,
          couponPageSizeRef.current,
          normalizedBatchNo,
          "ALL",
          "ALL",
        ),
        loadCouponStats(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "整批作废优惠码失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshDeliveryCodes(nextPage = deliveryCodePage) {
    await loadDeliveryCodes(
      nextPage,
      deliveryCodePageSizeRef.current,
      deliveryCodeKeyword,
      deliveryCodeProductFilter,
      deliveryCodeStatusFilter,
    );
  }

  async function resetDeliveryCodeFilters() {
    setDeliveryCodeKeyword("");
    setDeliveryCodeProductFilter("ALL");
    setDeliveryCodeStatusFilter("ALL");
    setSelectedDeliveryCodeIds([]);
    await loadDeliveryCodes(
      1,
      deliveryCodePageSizeRef.current,
      "",
      "ALL",
      "ALL",
    );
  }

  async function handleImportDeliveryCodes(
    values: ImportProductDeliveryCodesPayload,
  ) {
    setSubmitting(true);
    try {
      const result = await adminApi.importProductDeliveryCodes(values);
      const batchNo = result.batchNo || "";
      message.success(
        `CDK导入完成，新增 ${result.importedCount} 个，跳过 ${result.skippedCount} 个`,
      );
      deliveryCodeForm.resetFields();
      deliveryCodeForm.setFieldsValue({
        productId: values.productId,
        note: values.note ?? "",
      });
      if (batchNo) {
        setDeliveryCodeKeyword(batchNo);
        setDeliveryCodeProductFilter("ALL");
        setDeliveryCodeStatusFilter("ALL");
      }
      await Promise.all([
        loadDeliveryCodes(
          1,
          deliveryCodePageSizeRef.current,
          batchNo || deliveryCodeKeyword,
          batchNo ? "ALL" : deliveryCodeProductFilter,
          batchNo ? "ALL" : deliveryCodeStatusFilter,
        ),
        loadDeliveryCodeStats(),
        loadProducts(
          productPage,
          productPageSizeRef.current,
          productKeyword,
          productStatusFilter,
        ),
        loadProductOptions(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "导入CDK失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisableDeliveryCode(id: number) {
    const nextPage = getPageAfterVisibleRemovals(
      deliveryCodePage,
      deliveryCodes.length,
      deliveryCodeStatusFilter !== "ALL" ? 1 : 0,
    );
    setSubmitting(true);
    try {
      await adminApi.disableProductDeliveryCode(id);
      setSelectedDeliveryCodeIds((current) =>
        current.filter((item) => item !== id),
      );
      message.success("CDK已作废");
      await Promise.all([
        refreshDeliveryCodes(nextPage),
        loadDeliveryCodeStats(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "作废CDK失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDisableSelectedDeliveryCodes() {
    if (selectedDeliveryCodeIds.length === 0) {
      message.warning("请先勾选要处理的CDK");
      return;
    }

    const selectedIdSet = new Set(selectedDeliveryCodeIds);
    const targets = deliveryCodes.filter(
      (item) => selectedIdSet.has(item.id) && item.status === "AVAILABLE",
    );
    if (targets.length === 0) {
      message.warning("所选CDK里没有可作废的可发货项");
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        targets.map((item) => adminApi.disableProductDeliveryCode(item.id)),
      );
      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;
      if (successCount > 0) {
        message.success(
          `已作废 ${successCount} 个CDK${failedCount > 0 ? `，${failedCount} 个失败` : ""}`,
        );
      } else {
        message.error("批量作废CDK失败");
      }
      setSelectedDeliveryCodeIds([]);
      const nextPage = getPageAfterVisibleRemovals(
        deliveryCodePage,
        deliveryCodes.length,
        deliveryCodeStatusFilter !== "ALL" ? successCount : 0,
      );
      await Promise.all([
        refreshDeliveryCodes(nextPage),
        loadDeliveryCodeStats(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "批量作废CDK失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendDeliveryCode(id: number) {
    setSubmitting(true);
    try {
      await adminApi.resendProductDeliveryCode(id);
      message.success("CDK邮件已补发");
      await Promise.all([
        refreshDeliveryCodes(),
        loadDeliveryCodeStats(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "补发CDK邮件失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFilterDeliveryCodeBatch(batchNo?: string | null) {
    const normalizedBatchNo = String(batchNo ?? "").trim();
    if (!normalizedBatchNo) {
      return;
    }
    setDeliveryCodeKeyword(normalizedBatchNo);
    setDeliveryCodeProductFilter("ALL");
    setDeliveryCodeStatusFilter("ALL");
    setSelectedDeliveryCodeIds([]);
    await loadDeliveryCodes(
      1,
      deliveryCodePageSizeRef.current,
      normalizedBatchNo,
      "ALL",
      "ALL",
    );
  }

  async function handleDisableDeliveryCodeBatch(batchNo?: string | null) {
    const normalizedBatchNo = String(batchNo ?? "").trim();
    if (!normalizedBatchNo) {
      message.warning("当前CDK没有批次号");
      return;
    }
    setSubmitting(true);
    try {
      const records =
        await adminApi.disableProductDeliveryCodeBatch(normalizedBatchNo);
      setDeliveryCodeKeyword(normalizedBatchNo);
      setDeliveryCodeProductFilter("ALL");
      setDeliveryCodeStatusFilter("ALL");
      message.success(
        `批次 ${normalizedBatchNo} 已处理，共 ${records.length} 个CDK`,
      );
      await Promise.all([
        loadDeliveryCodes(
          1,
          deliveryCodePageSizeRef.current,
          normalizedBatchNo,
          "ALL",
          "ALL",
        ),
        loadDeliveryCodeStats(),
        refreshLogs(),
      ]);
    } catch (error) {
      message.error(textError(error, "整批作废CDK失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFindDeliveryCodePaymentOrder(
    record: ProductDeliveryCode,
  ) {
    const keyword = String(record.orderNo ?? "").trim();
    if (!keyword) {
      message.warning("当前CDK还没有绑定支付订单");
      return;
    }
    setPaymentKeyword(keyword);
    setPaymentStatusFilter("ALL");
    setPaymentResourceFilter("PRODUCT");
    setPaymentErrorFilter("ALL");
    setPaymentCouponFilter("ALL");
    setPaymentSupportFilter("ALL");
    await loadPaymentOrders(
      1,
      paymentPageSizeRef.current,
      keyword,
      "ALL",
      "PRODUCT",
      "ALL",
      "ALL",
    );
    switchSection("payments");
  }

  async function handleFindCouponPaymentOrders(record: ProductCouponCode) {
    const keyword = record.usedOrderNo || record.lockOrderNo || record.code;
    setPaymentKeyword(keyword);
    setPaymentStatusFilter("ALL");
    setPaymentResourceFilter("PRODUCT");
    setPaymentErrorFilter("ALL");
    setPaymentCouponFilter("HAS_COUPON");
    setPaymentSupportFilter("ALL");
    await loadPaymentOrders(
      1,
      paymentPageSizeRef.current,
      keyword,
      "ALL",
      "PRODUCT",
      "ALL",
      "HAS_COUPON",
    );
    switchSection("payments");
  }

  async function resetPaymentFilters() {
    setPaymentKeyword("");
    setPaymentStatusFilter("ALL");
    setPaymentResourceFilter("ALL");
    setPaymentErrorFilter("ALL");
    setPaymentCouponFilter("ALL");
    setPaymentSupportFilter("ALL");
    await Promise.all([
      loadPaymentOrders(
        1,
        paymentPageSizeRef.current,
        "",
        "ALL",
        "ALL",
        "ALL",
        "ALL",
      ),
      loadPaymentStats(),
    ]);
  }

  async function resetNoticeFilters() {
    setNoticeKeyword("");
    setNoticeStatusFilter("ALL");
    setSelectedNoticeIds([]);
    await loadSiteNotices(1, noticePageSizeRef.current, "", "ALL");
  }

  async function resetReportFilters() {
    setSelectedReportIds([]);
    await handleReportFilter("ALL");
  }

  async function resetLogFilters() {
    setLogKeyword("");
    await loadOperationLogs(1, logPageSizeRef.current, "");
  }

  async function handleExportCouponCodes() {
    setCouponLoading(true);
    try {
      const blob = await adminApi.exportProductCouponCodes({
        keyword: couponKeyword,
        productId: couponProductFilter,
        status: couponStatusFilter,
      });
      saveBlob(blob, `product-coupon-codes-${Date.now()}.csv`);
      message.success("优惠码已导出");
    } catch (error) {
      message.error(textError(error, "导出优惠码失败"));
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleExportDeliveryCodes() {
    setDeliveryCodeLoading(true);
    try {
      const blob = await adminApi.exportProductDeliveryCodes({
        keyword: deliveryCodeKeyword,
        productId: deliveryCodeProductFilter,
        status: deliveryCodeStatusFilter,
      });
      saveBlob(blob, `product-delivery-codes-${Date.now()}.csv`);
      message.success("CDK已导出");
    } catch (error) {
      message.error(textError(error, "导出CDK失败"));
    } finally {
      setDeliveryCodeLoading(false);
    }
  }

  async function handleExportPaymentOrders() {
    setPaymentExporting(true);
    try {
      const blob = await adminApi.exportPaymentOrders({
        keyword: paymentKeyword,
        status: paymentStatusFilter,
        resourceType: paymentResourceFilter,
        hasError: paymentErrorFilterValue(paymentErrorFilter),
        hasCoupon: paymentCouponFilterValue(paymentCouponFilter),
        supportStatus: paymentSupportFilter,
      });
      saveBlob(blob, `payment-orders-${Date.now()}.csv`);
      message.success("支付订单已导出");
    } catch (error) {
      message.error(textError(error, "导出支付订单失败"));
    } finally {
      setPaymentExporting(false);
    }
  }

  async function handleSaveNotice(values: SaveSiteNoticePayload) {
    const rowLeavesCurrentFilter =
      Boolean(editingNotice) &&
      noticeStatusFilter !== "ALL" &&
      noticeStatusFilter !== (values.published ? "PUBLISHED" : "DRAFT");
    const nextPage = editingNotice
      ? getPageAfterVisibleRemovals(
          noticePage,
          siteNotices.length,
          rowLeavesCurrentFilter ? 1 : 0,
        )
      : 1;
    setSubmitting(true);
    try {
      if (editingNotice) {
        await adminApi.updateSiteNotice(editingNotice.id, values);
        message.success("站点公告更新成功");
      } else {
        await adminApi.createSiteNotice(values);
        message.success("站点公告新增成功");
      }
      setEditingNotice(null);
      noticeForm.resetFields();
      noticeForm.setFieldsValue({ published: true, sortOrder: 0 });
      await Promise.all([
        loadSiteNotices(
          nextPage,
          noticePageSizeRef.current,
          noticeKeyword,
          noticeStatusFilter,
        ),
        loadSiteNoticeStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "保存站点公告失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteNotice(id: number) {
    setSubmitting(true);
    try {
      await adminApi.deleteSiteNotice(id);
      setSelectedNoticeIds((current) => current.filter((item) => item !== id));
      const nextPage =
        siteNotices.length <= 1 && noticePage > 1 ? noticePage - 1 : noticePage;
      message.success("站点公告已删除");
      await Promise.all([
        loadSiteNotices(
          nextPage,
          noticePageSizeRef.current,
          noticeKeyword,
          noticeStatusFilter,
        ),
        loadSiteNoticeStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "删除站点公告失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateSelectedNotices(published: boolean) {
    if (selectedNoticeIds.length === 0) {
      message.warning("请先勾选要处理的公告");
      return;
    }

    const selectedIdSet = new Set(selectedNoticeIds);
    const targets = siteNotices.filter(
      (item) => selectedIdSet.has(item.id) && item.published !== published,
    );
    if (targets.length === 0) {
      message.warning(
        published ? "所选公告已经是发布状态" : "所选公告已经是未发布状态",
      );
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        targets.map((item) =>
          adminApi.updateSiteNotice(item.id, {
            title: item.title,
            content: item.content,
            published,
            sortOrder: item.sortOrder ?? 0,
          }),
        ),
      );
      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;
      if (successCount > 0) {
        message.success(
          `已${published ? "发布" : "下线"} ${successCount} 条公告${failedCount > 0 ? `，${failedCount} 条失败` : ""}`,
        );
      } else {
        message.error(published ? "批量发布公告失败" : "批量下线公告失败");
      }
      setSelectedNoticeIds([]);
      const nextPage = getPageAfterVisibleRemovals(
        noticePage,
        siteNotices.length,
        noticeStatusFilter !== "ALL" ? successCount : 0,
      );
      await Promise.all([
        loadSiteNotices(
          nextPage,
          noticePageSizeRef.current,
          noticeKeyword,
          noticeStatusFilter,
        ),
        loadSiteNoticeStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(
        textError(error, published ? "批量发布公告失败" : "批量下线公告失败"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSelectedNotices() {
    if (selectedNoticeIds.length === 0) {
      message.warning("请先勾选要删除的公告");
      return;
    }

    const selectedIdSet = new Set(selectedNoticeIds);
    const targets = siteNotices.filter((item) => selectedIdSet.has(item.id));
    if (targets.length === 0) {
      message.warning("所选公告不存在或已被删除");
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        targets.map((item) => adminApi.deleteSiteNotice(item.id)),
      );
      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;
      if (successCount > 0) {
        message.success(
          `已删除 ${successCount} 条公告${failedCount > 0 ? `，${failedCount} 条失败` : ""}`,
        );
      } else {
        message.error("批量删除公告失败");
      }
      setSelectedNoticeIds([]);
      const nextPage =
        siteNotices.length <= successCount && noticePage > 1
          ? noticePage - 1
          : noticePage;
      await Promise.all([
        loadSiteNotices(
          nextPage,
          noticePageSizeRef.current,
          noticeKeyword,
          noticeStatusFilter,
        ),
        loadSiteNoticeStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "批量删除公告失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(values: ReviewPostReportPayload) {
    if (!reviewingReport) return;
    const nextPage = getPageAfterVisibleRemovals(
      reportPage,
      postReports.length,
      reportStatus !== "ALL" && reportStatus !== values.status ? 1 : 0,
    );
    setSubmitting(true);
    try {
      await adminApi.reviewPostReport(reviewingReport.id, values);
      setSelectedReportIds((current) =>
        current.filter((item) => item !== reviewingReport.id),
      );
      setReviewingReport(null);
      reviewForm.resetFields();
      message.success("举报处理完成");
      await Promise.all([
        loadPostReports(nextPage, reportPageSizeRef.current, reportStatus),
        loadPostReportStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "处理举报失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReviewSelectedReports(status: "RESOLVED" | "REJECTED") {
    if (selectedReportIds.length === 0) {
      message.warning("请先勾选要处理的举报");
      return;
    }

    const selectedIdSet = new Set(selectedReportIds);
    const targets = postReports.filter(
      (item) => selectedIdSet.has(item.id) && item.status !== status,
    );
    if (targets.length === 0) {
      message.warning(
        status === "RESOLVED"
          ? "所选举报已经是已处理状态"
          : "所选举报已经是已驳回状态",
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload: ReviewPostReportPayload = {
        status,
        reviewNote: status === "RESOLVED" ? "批量标记已处理" : "批量驳回",
      };
      const results = await Promise.allSettled(
        targets.map((item) => adminApi.reviewPostReport(item.id, payload)),
      );
      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;
      if (successCount > 0) {
        message.success(
          `已${status === "RESOLVED" ? "处理" : "驳回"} ${successCount} 条举报${failedCount > 0 ? `，${failedCount} 条失败` : ""}`,
        );
      } else {
        message.error(
          status === "RESOLVED" ? "批量处理举报失败" : "批量驳回举报失败",
        );
      }
      setSelectedReportIds([]);
      const nextPage =
        getPageAfterVisibleRemovals(
          reportPage,
          postReports.length,
          reportStatus !== "ALL" ? successCount : 0,
        );
      await Promise.all([
        loadPostReports(nextPage, reportPageSizeRef.current, reportStatus),
        loadPostReportStats(),
      ]);
      await refreshLogs();
    } catch (error) {
      message.error(
        textError(
          error,
          status === "RESOLVED" ? "批量处理举报失败" : "批量驳回举报失败",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const summary = userStats;

  const sectionErrorItems = useMemo(
    () => Object.values(sectionErrors),
    [sectionErrors],
  );

  const inviteSummary = inviteStats;
  const selectedInvites = useMemo(() => {
    const selectedIdSet = new Set(selectedInviteIds);
    return inviteCodes.filter((item) => selectedIdSet.has(item.id));
  }, [inviteCodes, selectedInviteIds]);

  const downloadSummary = downloadStats;

  const productSummary = productStats;

  const couponSummary = couponStats;

  const deliveryCodeSummary = deliveryCodeStats;

  const virtualProductOptions = useMemo(
    () =>
      couponProductOptions.filter((item) => item.deliveryType === "CDK_EMAIL"),
    [couponProductOptions],
  );
  const selectedDeliveryCodeProduct = useMemo(() => {
    const productId = Number(selectedDeliveryCodeProductId);
    if (!Number.isFinite(productId)) {
      return null;
    }

    return virtualProductOptions.find((item) => item.id === productId) ?? null;
  }, [selectedDeliveryCodeProductId, virtualProductOptions]);
  const selectedDeliveryCodeAvailableCount =
    selectedDeliveryCodeProduct?.deliveryCodeAvailableCount ?? 0;
  const selectedDeliveryCodeAlertType =
    selectedDeliveryCodeAvailableCount <= 0
      ? "error"
      : selectedDeliveryCodeAvailableCount <= 5
        ? "warning"
        : "info";

  const lowDeliveryCodeProducts = useMemo(
    () =>
      virtualProductOptions.filter(
        (item) => (item.deliveryCodeAvailableCount ?? 0) <= 5,
      ),
    [virtualProductOptions],
  );

  const lowDeliveryCodeMessage = useMemo(
    () =>
      lowDeliveryCodeProducts
        .slice(0, 5)
        .map(
          (item) =>
            `${item.title} 剩余 ${item.deliveryCodeAvailableCount ?? 0}`,
        )
        .join("；"),
    [lowDeliveryCodeProducts],
  );

  const hasInviteFilters =
    inviteKeyword.trim() !== "" || inviteStatusFilter !== "ALL";
  const hasUserFilters =
    userKeyword.trim() !== "" ||
    userRoleFilter !== "ALL" ||
    userStatusFilter !== "ALL";
  const hasProductFilters =
    productKeyword.trim() !== "" || productStatusFilter !== "ALL";
  const hasDownloadFilters =
    downloadKeyword.trim() !== "" || downloadModeFilter !== "ALL";
  const hasCouponFilters =
    couponKeyword.trim() !== "" ||
    couponProductFilter !== "ALL" ||
    couponStatusFilter !== "ALL";
  const selectedCouponCodes = useMemo(() => {
    const selectedIdSet = new Set(selectedCouponCodeIds);
    return couponCodes.filter((item) => selectedIdSet.has(item.id));
  }, [couponCodes, selectedCouponCodeIds]);
  const selectedAvailableCouponCount = selectedCouponCodes.filter(
    (item) => item.status === "ACTIVE" || item.status === "EXPIRED",
  ).length;
  const hasDeliveryCodeFilters =
    deliveryCodeKeyword.trim() !== "" ||
    deliveryCodeProductFilter !== "ALL" ||
    deliveryCodeStatusFilter !== "ALL";
  const selectedDeliveryCodes = useMemo(() => {
    const selectedIdSet = new Set(selectedDeliveryCodeIds);
    return deliveryCodes.filter((item) => selectedIdSet.has(item.id));
  }, [deliveryCodes, selectedDeliveryCodeIds]);
  const selectedAvailableDeliveryCodeCount = selectedDeliveryCodes.filter(
    (item) => item.status === "AVAILABLE",
  ).length;
  const hasPaymentFilters =
    paymentKeyword.trim() !== "" ||
    paymentStatusFilter !== "ALL" ||
    paymentResourceFilter !== "ALL" ||
    paymentErrorFilter !== "ALL" ||
    paymentCouponFilter !== "ALL" ||
    paymentSupportFilter !== "ALL";
  const hasNoticeFilters =
    noticeKeyword.trim() !== "" || noticeStatusFilter !== "ALL";
  const hasReportFilters = reportStatus !== "ALL";
  const hasLogFilters = logKeyword.trim() !== "";
  const hasMailLogFilters =
    mailLogKeyword.trim() !== "" || mailLogStatusFilter !== "ALL";

  const paymentSummary = paymentStats;

  const noticeSummary = noticeStats;
  const selectedNotices = useMemo(() => {
    const selectedIdSet = new Set(selectedNoticeIds);
    return siteNotices.filter((item) => selectedIdSet.has(item.id));
  }, [siteNotices, selectedNoticeIds]);
  const selectedDraftNoticeCount = selectedNotices.filter(
    (item) => !item.published,
  ).length;
  const selectedPublishedNoticeCount = selectedNotices.filter(
    (item) => item.published,
  ).length;
  const reportSummary = reportStats;
  const selectedReports = useMemo(() => {
    const selectedIdSet = new Set(selectedReportIds);
    return postReports.filter((item) => selectedIdSet.has(item.id));
  }, [postReports, selectedReportIds]);
  const selectedUnresolvedReportCount = selectedReports.filter(
    (item) => item.status !== "RESOLVED",
  ).length;
  const selectedUnrejectedReportCount = selectedReports.filter(
    (item) => item.status !== "REJECTED",
  ).length;

  const topPages = useMemo(
    () => analytics?.topPages?.slice(0, 5) ?? [],
    [analytics],
  );
  const recentVisits = useMemo(
    () => analytics?.recentVisits?.slice(0, 5) ?? [],
    [analytics],
  );
  const dailyVisits = useMemo(
    () => analytics?.dailyVisits?.slice(-7) ?? [],
    [analytics],
  );
  const maxTopPageVisits = useMemo(
    () => Math.max(1, ...topPages.map((item) => item.visitCount ?? 0)),
    [topPages],
  );
  const maxDailyVisits = useMemo(
    () => Math.max(1, ...dailyVisits.map((item) => item.visitCount ?? 0)),
    [dailyVisits],
  );

  const attentionCount =
    paymentSummary.errors +
    paymentSummary.openSupport +
    reportSummary.pending +
    lowDeliveryCodeProducts.length;
  const hasSystemHealthAttention =
    systemHealth?.status === "WARNING" || systemHealth?.status === "ERROR";
  const systemHealthPercent =
    systemHealth?.score ??
    (sectionErrorItems.length > 0 ? 86 : paymentSummary.errors > 0 ? 92 : 98);
  const moduleCountById = useMemo<Record<string, string>>(
    () => ({
      overview: "总览",
      invite: `${inviteSummary.total}`,
      users: `${summary.total}`,
      products: `${productSummary.total}`,
      coupons: `${couponSummary.total}`,
      "delivery-codes": `${deliveryCodeSummary.total}`,
      payments: `${paymentSummary.total}`,
      "mail-logs": mailLogTotal > 0 ? `${mailLogTotal}` : "邮件",
      "vmq-payment": vmqSettings?.enabled ? "启用" : "配置",
      downloads: `${downloadSummary.total}`,
      "system-health": systemHealthStatusLabel(systemHealth?.status),
      notices: `${noticeSummary.total}`,
      reports: `${reportSummary.pending}`,
      logs: logTotal > 0 ? `${logTotal}` : "今日",
    }),
    [
      couponSummary.total,
      deliveryCodeSummary.total,
      downloadSummary.total,
      inviteSummary.total,
      logTotal,
      mailLogTotal,
      noticeSummary.total,
      paymentSummary.total,
      productSummary.total,
      reportSummary.pending,
      summary.total,
      systemHealth?.status,
      vmqSettings?.enabled,
    ],
  );
  const workspaceMetrics = useMemo(
    () => [
      {
        label: "支付订单",
        value: `${paymentSummary.total}`,
        meta: `待支付 ${paymentSummary.waiting} / 售后 ${paymentSummary.openSupport} / 异常 ${paymentSummary.errors}`,
        toneClass: "border-red-100 bg-red-50 text-red-700",
        icon: <CreditCardOutlined />,
      },
      {
        label: "用户规模",
        value: `${summary.total}`,
        meta: `管理员 ${summary.admin} / 禁用 ${summary.disabled}`,
        toneClass: "border-emerald-100 bg-emerald-50 text-emerald-700",
        icon: <TeamOutlined />,
      },
      {
        label: "CDK发货",
        value: `${deliveryCodeSummary.available}`,
        meta: `可发货 ${deliveryCodeSummary.available} / 低库存 ${lowDeliveryCodeProducts.length}`,
        toneClass: "border-amber-100 bg-amber-50 text-amber-700",
        icon: <KeyOutlined />,
      },
      {
        label: "站点访问",
        value: `${analytics?.totalVisits ?? 0}`,
        meta: `今日 ${analytics?.todayVisits ?? 0} / 下载 ${downloadSummary.total}`,
        toneClass: "border-sky-100 bg-sky-50 text-sky-700",
        icon: <DownloadOutlined />,
      },
    ],
    [
      analytics?.todayVisits,
      analytics?.totalVisits,
      deliveryCodeSummary.available,
      downloadSummary.total,
      lowDeliveryCodeProducts.length,
      paymentSummary.errors,
      paymentSummary.openSupport,
      paymentSummary.total,
      paymentSummary.waiting,
      summary.admin,
      summary.disabled,
      summary.total,
    ],
  );

  const userColumns: ColumnsType<User> = [
    {
      title: "用户",
      key: "user",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.nickname}</div>
          <div className="text-xs text-slate-500">{record.username}</div>
        </div>
      ),
    },
    {
      title: "角色",
      dataIndex: "role",
      render: (value) => <Tag color={roleColor(value)}>{roleLabel(value)}</Tag>,
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (value) => <Tag>{value === "DISABLED" ? "已禁用" : "正常"}</Tag>,
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size={4}>
          {canManageUser(record) ? (
            <Button
              type="link"
              onClick={() => {
                setEditingUser(record);
                userForm.setFieldsValue({
                  nickname: record.nickname,
                  avatarUrl: record.avatarUrl ?? "",
                  bio: record.bio ?? "",
                  role: record.role === "OWNER" ? undefined : record.role,
                  status: record.status ?? "ACTIVE",
                  password: "",
                });
              }}
            >
              编辑
            </Button>
          ) : (
            <Tag>不可编辑</Tag>
          )}
          {canDisableUser(record) ? (
            <Popconfirm
              title="确认禁用这个用户并撤销其登录会话吗？"
              onConfirm={() => void handleDisableUser(record.id)}
            >
              <Button type="link" danger>
                禁用
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const inviteColumns: ColumnsType<InviteCode> = [
    {
      title: "邀请码",
      dataIndex: "code",
      render: (value) => <code>{value}</code>,
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (value) => <Tag>{inviteLabel(value)}</Tag>,
    },
    {
      title: "使用者",
      dataIndex: "usedByNickname",
      render: (value) => value || "未使用",
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            onClick={() => void copyText(record.code, "邀请码已复制")}
          >
            复制
          </Button>
          <Popconfirm
            title="确认删除这个邀请码吗？"
            onConfirm={() => void handleDeleteInvite(record.id)}
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const downloadColumns: ColumnsType<DownloadResource> = [
    {
      title: "资源",
      key: "title",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.title}</div>
          <div className="text-xs text-slate-500">
            {record.category || "未分类"} {record.version || ""}
          </div>
        </div>
      ),
    },
    {
      title: "文件大小",
      dataIndex: "fileSize",
      render: (value) => value || "-",
    },
    {
      title: "下载数",
      dataIndex: "downloadCount",
      render: (value) => value ?? 0,
    },
    {
      title: "方式",
      dataIndex: "locked",
      render: (value, record) => {
        const protectedDownload = Boolean(value || record.passwordProtected);
        return (
          <Tag color={protectedDownload ? "orange" : "green"}>
            {record.passwordProtected
              ? value
                ? "验证码 + 密码"
                : "独立密码"
              : value
                ? "验证码"
                : "直接下载"}
          </Tag>
        );
      },
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" onClick={() => openDownloadEditor(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除这个下载内容吗？"
            onConfirm={() => void handleDeleteDownload(record.id)}
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const productColumns: ColumnsType<Product> = [
    {
      title: "商品",
      key: "product",
      render: (_, record) => (
        <div className="flex min-w-[220px] items-center gap-3">
          {record.imageUrl ? (
            <img
              src={resolveAssetUrl(record.imageUrl)}
              alt={record.title}
              className="h-12 w-16 rounded-xl object-cover"
            />
          ) : (
            <div className="flex h-12 w-16 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
              无图
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-medium text-slate-900">
              {record.title}
            </div>
            <div className="truncate text-xs text-slate-500">
              {record.subtitle || "未填写短简介"}
            </div>
          </div>
        </div>
      ),
    },
    { title: "价格", dataIndex: "price", render: (value) => priceText(value) },
    {
      title: "库存",
      dataIndex: "stock",
      render: (value, record) =>
        record.deliveryType === "CDK_EMAIL" ? (
          <Tag
            color={productDeliveryCodeStockColor(
              record.deliveryCodeAvailableCount,
            )}
          >
            可售 {record.deliveryCodeAvailableCount ?? 0}
          </Tag>
        ) : value == null ? (
          "未设置库存"
        ) : (
          value
        ),
    },
    { title: "销量", dataIndex: "salesCount", render: (value) => value ?? 0 },
    {
      title: "发货",
      dataIndex: "deliveryType",
      render: (value, record) => (
        <Space size={4} wrap>
          <Tag color={productDeliveryTypeTagColor(value)}>
            {productDeliveryTypeLabel(value)}
          </Tag>
          {isCdkEmailDeliveryType(value) ? (
            <>
              <Tag
                color={productDeliveryCodeStockColor(
                  record.deliveryCodeAvailableCount,
                )}
              >
                可发货 {record.deliveryCodeAvailableCount ?? 0}
              </Tag>
              {(record.deliveryCodeLockedCount ?? 0) > 0 ? (
                <Tag color="orange">锁定 {record.deliveryCodeLockedCount}</Tag>
              ) : null}
            </>
          ) : null}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (value) => (
        <Tag color={productStatusColor(value)}>{productStatusLabel(value)}</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" onClick={() => openProductEditor(record)}>
            编辑
          </Button>
          {record.deliveryType === "CDK_EMAIL" ? (
            <>
              <Button
                type="link"
                onClick={() => void openDeliveryCodeRestock(record)}
              >
                补CDK
              </Button>
              <Button
                type="link"
                onClick={() => void handleFilterProductDeliveryCodes(record)}
              >
                查CDK
              </Button>
            </>
          ) : null}
          <Popconfirm
            title="确认删除这个商品吗？"
            onConfirm={() => void handleDeleteProduct(record.id)}
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const couponColumns: ColumnsType<ProductCouponCode> = [
    {
      title: "优惠码",
      key: "code",
      render: (_, record) => (
        <div className="min-w-[220px]">
          <code className="text-sm font-semibold text-slate-900">
            {record.code}
          </code>
          <div className="mt-1 text-xs text-slate-500">
            {record.batchNo || "未分批次"}
          </div>
          {record.note ? (
            <div className="mt-1 truncate text-xs text-slate-400">
              {record.note}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "商品",
      key: "product",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">
            {record.productTitle || `商品 #${record.productId}`}
          </div>
          <div className="text-xs text-slate-500">ID {record.productId}</div>
        </div>
      ),
    },
    {
      title: "折扣",
      key: "discount",
      render: (_, record) => (
        <Tag color={record.discountType === "PERCENT" ? "blue" : "green"}>
          {record.discountType === "PERCENT" ? "比例" : "立减"}{" "}
          {couponDiscountText(record)}
        </Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (value) => (
        <Tag color={couponStatusColor(value)}>{couponStatusLabel(value)}</Tag>
      ),
    },
    {
      title: "有效期/使用",
      key: "time",
      render: (_, record) => (
        <div className="text-xs leading-5 text-slate-500">
          <div>有效期 {record.expiresAt || "长期有效"}</div>
          <div>锁定 {record.lockOrderNo || "-"}</div>
          <div>使用 {record.usedOrderNo || "-"}</div>
          {record.usedByName ? <div>用户 {record.usedByName}</div> : null}
        </div>
      ),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            onClick={() => void copyText(record.code, "优惠码已复制")}
          >
            复制
          </Button>
          {record.batchNo ? (
            <Button
              type="link"
              onClick={() => void handleFilterCouponBatch(record.batchNo)}
            >
              筛批次
            </Button>
          ) : null}
          {record.usedOrderNo ||
          record.lockOrderNo ||
          record.status === "USED" ||
          record.status === "LOCKED" ? (
            <Button
              type="link"
              onClick={() => void handleFindCouponPaymentOrders(record)}
            >
              查订单
            </Button>
          ) : null}
          {record.status === "ACTIVE" || record.status === "EXPIRED" ? (
            <Popconfirm
              title="确认作废这个优惠码吗？"
              onConfirm={() => void handleDisableCouponCode(record.id)}
            >
              <Button type="link" danger loading={submitting}>
                作废
              </Button>
            </Popconfirm>
          ) : null}
          {record.batchNo &&
          (record.status === "ACTIVE" ||
            record.status === "EXPIRED" ||
            record.status === "DISABLED") ? (
            <Popconfirm
              title={`确认作废批次 ${record.batchNo} 下所有可用优惠码吗？`}
              onConfirm={() => void handleDisableCouponBatch(record.batchNo)}
            >
              <Button type="link" danger loading={submitting}>
                作废本批
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const deliveryCodeColumns: ColumnsType<ProductDeliveryCode> = [
    {
      title: "CDK",
      key: "code",
      render: (_, record) => (
        <div className="min-w-[240px]">
          <code className="break-all text-sm font-semibold text-slate-900">
            {record.code}
          </code>
          <div className="mt-1 text-xs text-slate-500">
            {record.batchNo || "未分批次"}
          </div>
          {record.note ? (
            <div className="mt-1 truncate text-xs text-slate-400">
              {record.note}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "商品",
      key: "product",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">
            {record.productTitle || `商品 #${record.productId}`}
          </div>
          <div className="text-xs text-slate-500">ID {record.productId}</div>
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (value) => (
        <Tag color={deliveryCodeStatusColor(value)}>
          {deliveryCodeStatusLabel(value)}
        </Tag>
      ),
    },
    {
      title: "发货记录",
      key: "delivery",
      render: (_, record) => (
        <div className="text-xs leading-5 text-slate-500">
          <div>订单 {record.orderNo || "-"}</div>
          <div>
            用户{" "}
            {record.assignedToName ||
              (record.assignedTo ? `ID ${record.assignedTo}` : "-")}
          </div>
          <div>锁定 {record.assignedAt || "-"}</div>
          <div>发送 {record.sentAt || "-"}</div>
        </div>
      ),
    },
    {
      title: "操作",
      key: "action",
      fixed: "right",
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            onClick={() => void copyText(record.code, "CDK已复制")}
          >
            复制
          </Button>
          {record.batchNo ? (
            <Button
              type="link"
              onClick={() => void handleFilterDeliveryCodeBatch(record.batchNo)}
            >
              筛批次
            </Button>
          ) : null}
          {record.orderNo ? (
            <Button
              type="link"
              onClick={() => void handleFindDeliveryCodePaymentOrder(record)}
            >
              查订单
            </Button>
          ) : null}
          {record.status === "LOCKED" || record.status === "SENT" ? (
            <Popconfirm
              title="确认补发这个CDK邮件吗？"
              onConfirm={() => void handleResendDeliveryCode(record.id)}
            >
              <Button type="link" loading={submitting}>
                补发
              </Button>
            </Popconfirm>
          ) : null}
          {record.status === "AVAILABLE" ? (
            <Popconfirm
              title="确认作废这个CDK吗？"
              onConfirm={() => void handleDisableDeliveryCode(record.id)}
            >
              <Button type="link" danger loading={submitting}>
                作废
              </Button>
            </Popconfirm>
          ) : null}
          {record.batchNo &&
          (record.status === "AVAILABLE" || record.status === "DISABLED") ? (
            <Popconfirm
              title={`确认作废批次 ${record.batchNo} 下所有可用CDK吗？`}
              onConfirm={() =>
                void handleDisableDeliveryCodeBatch(record.batchNo)
              }
            >
              <Button type="link" danger loading={submitting}>
                作废本批
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const paymentColumns: ColumnsType<AdminPaymentOrder> = [
    {
      title: "订单",
      key: "order",
      render: (_, record) => (
        <div className="min-w-[260px]">
          <div className="font-medium text-slate-900">{record.subject}</div>
          <div className="mt-1 font-mono text-xs text-slate-500">
            {record.outTradeNo}
          </div>
          {record.tradeNo ? (
            <div className="mt-1 truncate text-xs text-slate-400">
              {paymentChannelLabel(record.channel)}：{record.tradeNo}
            </div>
          ) : null}
          {isFreeOrder(record) ? (
            <Tag className="mt-1" color="cyan">
              免费领取
            </Tag>
          ) : null}
        </div>
      ),
    },
    {
      title: "付款人",
      key: "payer",
      render: (_, record) => (
        <div>
          <div className="text-sm text-slate-900">
            {record.payerName || record.payerUsername || "未绑定用户"}
          </div>
          <div className="text-xs text-slate-500">
            {record.payerUserId ? `ID ${record.payerUserId}` : "-"}
          </div>
          {record.deliveryEmail ? (
            <div className="mt-1 max-w-[220px] truncate font-mono text-xs text-slate-500">
              收货 {record.deliveryEmail}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "资源",
      key: "resource",
      render: (_, record) => (
        <div>
          <Tag>{record.resourceType || "通用订单"}</Tag>
          <div className="mt-1 text-xs text-slate-500">
            {record.resourceId ? `资源 ID ${record.resourceId}` : "-"}
          </div>
        </div>
      ),
    },
    {
      title: "金额",
      key: "amount",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">
            {priceText(record.totalAmount)}
          </div>
          {Number(record.discountAmount) > 0 ? (
            <div className="mt-1 text-xs text-green-600">
              原价 {priceText(record.originalAmount)}，优惠{" "}
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
      key: "status",
      render: (_, record) => (
        <div>
          <Tag color={paymentStatusColor(record.status)}>
            {paymentOrderStatusLabel(record)}
          </Tag>
          {record.lastError ? (
            <div className="mt-1 max-w-[180px] truncate text-xs text-red-500">
              {record.lastError}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: "时间",
      key: "time",
      render: (_, record) => (
        <div className="text-xs leading-5 text-slate-500">
          <div>创建 {record.createTime || "-"}</div>
          <div>失效 {record.expireTime || "-"}</div>
          <div>支付 {record.paidTime || "-"}</div>
        </div>
      ),
    },
    {
      title: "售后",
      key: "support",
      render: (_, record) =>
        record.supportStatus ? (
          <div className="max-w-[220px]">
            <Tag color={record.supportStatus === "OPEN" ? "orange" : "green"}>
              {record.supportStatus === "OPEN" ? "待回复" : "已回复"}
            </Tag>
            <div className="mt-1 truncate text-xs text-slate-500">
              {record.supportMessage}
            </div>
            {record.supportReply ? (
              <div className="mt-1 truncate text-xs text-green-600">
                回复：{record.supportReply}
              </div>
            ) : null}
          </div>
        ) : (
          "-"
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
            loading={paymentActionLoading === record.outTradeNo}
            onClick={() => void handleSyncPaymentOrder(record.outTradeNo)}
          >
            同步
          </Button>
          {isPaymentClosable(record.status) ? (
            <Popconfirm
              title="确认关闭这个未支付订单吗？"
              onConfirm={() => void handleClosePaymentOrder(record.outTradeNo)}
            >
              <Button
                type="link"
                danger
                loading={paymentActionLoading === record.outTradeNo}
              >
                关单
              </Button>
            </Popconfirm>
          ) : null}
          {isPaymentManualConfirmable(record.status) ? (
            <Popconfirm
              title="确认已实际到账？"
              description="确认后订单会标记为已支付，并触发商品发货/优惠码核销等后续流程。"
              onConfirm={() =>
                void handleManualConfirmPaymentOrder(record.outTradeNo)
              }
            >
              <Button
                type="link"
                loading={paymentActionLoading === record.outTradeNo}
              >
                人工确认
              </Button>
            </Popconfirm>
          ) : null}
          {record.resourceType === "PRODUCT" &&
          Boolean(record.deliveryEmail) &&
          ["TRADE_SUCCESS", "TRADE_FINISHED"].includes(record.status) ? (
            <Popconfirm
              title="确认重新发送商品发货邮件吗？"
              description={`邮件将重新发送到 ${record.deliveryEmail}`}
              onConfirm={() =>
                void handleResendPaymentOrderDelivery(record.outTradeNo)
              }
            >
              <Button
                type="link"
                loading={paymentActionLoading === record.outTradeNo}
              >
                重新发货
              </Button>
            </Popconfirm>
          ) : null}
          {record.lastError ? (
            <Button type="link" onClick={() => openPaymentResolveModal(record)}>
              处理
            </Button>
          ) : null}
          {record.supportStatus === "OPEN" ? (
            <Button
              type="link"
              loading={paymentActionLoading === record.outTradeNo}
              onClick={() => openPaymentSupportReply(record)}
            >
              回复售后
            </Button>
          ) : null}
          <Button
            type="link"
            onClick={() => void copyText(record.outTradeNo, "订单号已复制")}
          >
            复制
          </Button>
        </Space>
      ),
    },
  ];

  const noticeColumns: ColumnsType<SiteNotice> = [
    {
      title: "公告",
      dataIndex: "title",
      render: (value, record) => (
        <div>
          <div className="font-medium text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{record.content}</div>
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "published",
      render: (value) => <Tag>{value ? "已发布" : "未发布"}</Tag>,
    },
    { title: "排序", dataIndex: "sortOrder", render: (value) => value ?? 0 },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            onClick={() => {
              setEditingNotice(record);
              noticeForm.setFieldsValue({
                title: record.title,
                content: record.content,
                published: record.published,
                sortOrder: record.sortOrder ?? 0,
              });
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除这条公告吗？"
            onConfirm={() => void handleDeleteNotice(record.id)}
          >
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const reportColumns: ColumnsType<AdminPostReport> = [
    {
      title: "举报内容",
      key: "post",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.postTitle}</div>
          <div className="text-xs text-slate-500">{record.reporterName}</div>
        </div>
      ),
    },
    { title: "原因", dataIndex: "reason" },
    {
      title: "状态",
      dataIndex: "status",
      render: (value) => (
        <Tag color={reportColor(value)}>{reportLabel(value)}</Tag>
      ),
    },
    {
      title: "处理备注",
      dataIndex: "reviewNote",
      render: (value) => value || "-",
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            setReviewingReport(record);
            reviewForm.setFieldsValue({
              status:
                record.status === "RESOLVED" || record.status === "REJECTED"
                  ? record.status
                  : "RESOLVED",
              reviewNote: record.reviewNote ?? "",
              deleteTarget: false,
            });
          }}
        >
          处理
        </Button>
      ),
    },
  ];

  const logColumns: ColumnsType<AdminOperationLog> = [
    { title: "操作人", dataIndex: "operatorName" },
    {
      title: "动作",
      dataIndex: "actionType",
      render: (value) => <Tag>{actionLabel(value)}</Tag>,
    },
    {
      title: "对象",
      key: "target",
      render: (_, record) =>
        `${targetLabel(record.targetType)} / ${record.targetName || "-"}`,
    },
    { title: "说明", dataIndex: "detail", render: (value) => value || "-" },
    { title: "时间", dataIndex: "createTime", render: (value) => value || "-" },
  ];

  const mailLogColumns: ColumnsType<MailSendLog> = [
    {
      title: "邮件",
      key: "mail",
      render: (_, record) => (
        <div className="min-w-[260px]">
          <div className="font-medium text-slate-900">
            {record.subject || "发货邮件"}
          </div>
          <div className="mt-1 truncate font-mono text-xs text-slate-500">
            {record.recipientEmail}
          </div>
        </div>
      ),
    },
    {
      title: "订单/商品",
      key: "order",
      render: (_, record) => (
        <div className="text-xs leading-5 text-slate-500">
          <div className="font-mono">{record.orderNo || "-"}</div>
          <div>{record.productTitle || "未关联商品"}</div>
          {record.deliveryCodeId ? <div>CDK #{record.deliveryCodeId}</div> : null}
        </div>
      ),
    },
    {
      title: "类型",
      key: "type",
      render: (_, record) => (
        <Space size={4} wrap>
          <Tag>{record.mailType === "CDK_DELIVERY" ? "CDK发货" : "商品发货"}</Tag>
          <Tag>{record.triggerType || "DELIVERY"}</Tag>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (value) => (
        <Tag color={mailSendStatusColor(value)}>
          {mailSendStatusLabel(value)}
        </Tag>
      ),
    },
    {
      title: "错误",
      dataIndex: "errorMessage",
      render: (value) =>
        value ? (
          <div className="max-w-[280px] truncate text-xs text-red-500">
            {value}
          </div>
        ) : (
          "-"
        ),
    },
    { title: "时间", dataIndex: "createTime", render: (value) => value || "-" },
  ];

  return (
    <MainLayout contentWidth="wide" mode="workspace">
      <div className="overflow-x-hidden pb-1">
        <div className="min-h-[calc(100vh-112px)] overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/90 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-red-600">
                Admin Console
              </div>
              <h1 className="m-0 mt-1 text-2xl font-extrabold tracking-normal text-slate-950">
                一体化管理工作台
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-6 text-slate-500">
                <span>点击左侧模块即可切换，不再下滑跳转。</span>
                <span className="hidden text-slate-300 md:inline">|</span>
                <span>
                  {lastLoadedAt ? `${lastLoadedAt} 已同步` : "等待同步"}
                </span>
                <Tag
                  color={sectionErrorItems.length > 0 ? "orange" : "green"}
                  className="m-0"
                >
                  {sectionErrorItems.length > 0 ? "部分异常" : "数据正常"}
                </Tag>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={<QrcodeOutlined />} href="/admin/qrcodes">
                二维码管理
              </Button>
              <Button
                icon={<BellOutlined />}
                loading={loading}
                onClick={() => void loadAll(reportStatus)}
              >
                刷新
              </Button>
              <Button
                type="primary"
                danger
                icon={<CreditCardOutlined />}
                onClick={() =>
                  switchSection(
                    paymentSummary.errors > 0 || paymentSummary.openSupport > 0
                      ? "payments"
                      : reportSummary.pending > 0
                        ? "reports"
                        : hasSystemHealthAttention
                          ? "system-health"
                          : "overview",
                  )
                }
              >
                处理异常
              </Button>
            </div>
          </div>

          {sectionErrorItems.length > 0 ? (
            <div className="border-b border-slate-100 px-5 py-4">
              <Alert
                showIcon
                type="warning"
                message="部分后台模块暂时没有加载成功"
                description={sectionErrorItems.join("；")}
              />
            </div>
          ) : null}

          {lowDeliveryCodeProducts.length > 0 ? (
            <div className="border-b border-amber-100 bg-amber-50/70 px-5 py-4">
              <Alert
                showIcon
                type="warning"
                message={`有 ${lowDeliveryCodeProducts.length} 个CDK商品库存偏低`}
                description={lowDeliveryCodeMessage || "请及时导入新的CDK库存。"}
                action={
                  <Button size="small" onClick={() => switchSection("delivery-codes")}>
                    去补货
                  </Button>
                }
              />
            </div>
          ) : null}

          <div className="grid xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="border-b border-slate-100 bg-slate-50/80 px-3 py-4 xl:border-b-0 xl:border-r">
              <div className="px-3 pb-3">
                <div className="text-sm font-extrabold text-slate-950">
                  管理模块
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  按对象进入，点击切换模块
                </div>
              </div>
              <div className="grid gap-1">
                {sectionItems.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => switchSection(item.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition ${
                        isActive
                          ? "bg-red-50 text-red-700 shadow-sm ring-1 ring-red-100"
                          : "text-slate-700 hover:bg-white"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="text-base">{item.icon}</span>
                        <span className="truncate text-sm font-bold">
                          {item.label}
                        </span>
                      </span>
                      <span className="ml-2 rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500">
                        {moduleCountById[item.id]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">
                    系统健康
                  </span>
                  <Tag
                    color={
                      systemHealth
                        ? systemHealthStatusColor(systemHealth.status)
                        : systemHealthPercent >= 95
                          ? "green"
                          : "orange"
                    }
                  >
                    {systemHealth
                      ? systemHealthStatusLabel(systemHealth.status)
                      : systemHealthPercent >= 95
                        ? "稳定"
                        : "关注"}
                  </Tag>
                </div>
                <div className="mt-3 text-2xl font-extrabold text-slate-950">
                  {systemHealthPercent}%
                </div>
                <Progress
                  percent={systemHealthPercent}
                  showInfo={false}
                  strokeColor="#c4362d"
                />
                <div className="mt-3 text-xs leading-5 text-slate-500">
                  需关注 {attentionCount} 项，异常模块{" "}
                  {sectionErrorItems.length} 个
                </div>
              </div>
            </aside>

            <section className="min-w-0">
              {activeSection === "overview" ? (
                <div className="grid border-b border-slate-100 md:grid-cols-2 2xl:grid-cols-4">
                  {workspaceMetrics.map((item) => (
                    <div
                      className="border-b border-r border-slate-100 p-5 2xl:border-b-0"
                      key={item.label}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm text-slate-500">
                            {item.label}
                          </div>
                          <div className="mt-2 text-3xl font-extrabold leading-none text-slate-950">
                            {item.value}
                          </div>
                        </div>
                        <span
                          className={`rounded-2xl border p-3 text-lg ${item.toneClass}`}
                        >
                          {item.icon}
                        </span>
                      </div>
                      <div
                        className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${item.toneClass}`}
                      >
                        {item.meta}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="px-5 py-5">
                <div className="space-y-6">
                  <section
                    id="overview"
                    className={sectionPanelClassName("overview")}
                  >
                    <div className="mb-4 text-xl font-semibold text-slate-900">
                      数据概览
                    </div>
                    <Row gutter={[20, 20]}>
                      <Col xs={24} md={12} xl={6}>
                        <Card className="rounded-[24px] border-slate-100 shadow-sm">
                          总访问量
                          <div className="mt-3 text-3xl font-semibold">
                            {analytics?.totalVisits ?? 0}
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} md={12} xl={6}>
                        <Card className="rounded-[24px] border-slate-100 shadow-sm">
                          独立访客
                          <div className="mt-3 text-3xl font-semibold">
                            {analytics?.uniqueVisitors ?? 0}
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} md={12} xl={6}>
                        <Card className="rounded-[24px] border-slate-100 shadow-sm">
                          今日访问
                          <div className="mt-3 text-3xl font-semibold">
                            {analytics?.todayVisits ?? 0}
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} md={12} xl={6}>
                        <Card className="rounded-[24px] border-slate-100 shadow-sm">
                          登录访问
                          <div className="mt-3 text-3xl font-semibold">
                            {analytics?.authenticatedVisits ?? 0}
                          </div>
                        </Card>
                      </Col>
                    </Row>
                    <div className="mt-5 grid gap-5 xl:grid-cols-3">
                      <Card className="rounded-[24px] border-slate-100 shadow-sm">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          热门页面
                        </div>
                        <div className="space-y-4">
                          {topPages.length > 0 ? (
                            topPages.map((item) => (
                              <div key={item.path}>
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <span className="min-w-0 truncate font-medium text-slate-800">
                                    {item.title || item.path}
                                  </span>
                                  <span className="shrink-0 text-slate-500">
                                    {item.visitCount}
                                  </span>
                                </div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full rounded-full bg-[#2a6df4]"
                                    style={{
                                      width: `${Math.max(8, (item.visitCount / maxTopPageVisits) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <div className="mt-1 truncate text-xs text-slate-400">
                                  {item.path}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-500">
                              暂无热门页面数据
                            </div>
                          )}
                        </div>
                      </Card>

                      <Card className="rounded-[24px] border-slate-100 shadow-sm">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          近 7 日访问
                        </div>
                        {dailyVisits.length > 0 ? (
                          <div className="flex h-40 items-end gap-2">
                            {dailyVisits.map((item) => (
                              <div
                                key={item.date}
                                className="flex min-w-0 flex-1 flex-col items-center gap-2"
                              >
                                <div className="text-xs font-medium text-slate-600">
                                  {item.visitCount}
                                </div>
                                <div className="flex h-24 w-full items-end rounded-full bg-slate-100">
                                  <div
                                    className="w-full rounded-full bg-[#7aa7ff]"
                                    style={{
                                      height: `${Math.max(10, (item.visitCount / maxDailyVisits) * 100)}%`,
                                    }}
                                  />
                                </div>
                                <div className="w-full truncate text-center text-[11px] text-slate-400">
                                  {item.date.slice(5)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500">
                            暂无访问趋势数据
                          </div>
                        )}
                      </Card>

                      <Card className="rounded-[24px] border-slate-100 shadow-sm">
                        <div className="mb-4 text-sm font-semibold text-slate-900">
                          最近访问
                        </div>
                        <div className="space-y-3">
                          {recentVisits.length > 0 ? (
                            recentVisits.map((item, index) => (
                              <div
                                key={`${item.path}-${item.createTime ?? index}`}
                                className="rounded-2xl bg-slate-50 px-3 py-2"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0 truncate text-sm font-medium text-slate-800">
                                    {item.title || item.path}
                                  </div>
                                  <Tag>{item.deviceType || "未知设备"}</Tag>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                  <span>
                                    {item.nickname ||
                                      item.visitorId ||
                                      "匿名访客"}
                                  </span>
                                  <span>{item.createTime || "-"}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-slate-500">
                              暂无最近访问记录
                            </div>
                          )}
                        </div>
                      </Card>
                    </div>
                  </section>

                  <section
                    id="invite"
                    className={sectionPanelClassName("invite")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          邀请码管理
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          总计 {inviteSummary.total} 个，匹配 {inviteTotal}{" "}
                          个，当前页 {inviteCodes.length} 个
                        </div>
                      </div>
                      <Space wrap>
                        <Tag color="green">可用 {inviteSummary.active}</Tag>
                        <Tag color="blue">已使用 {inviteSummary.used}</Tag>
                        <Tag color="red">已过期 {inviteSummary.expired}</Tag>
                      </Space>
                    </div>
                    <Row gutter={[24, 24]}>
                      <Col xs={24} xl={9}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <Form
                            form={inviteForm}
                            layout="vertical"
                            onFinish={(values) =>
                              void handleCreateInvite(values)
                            }
                          >
                            <Form.Item
                              name="count"
                              label="生成数量"
                              rules={[
                                { required: true, message: "请输入生成数量" },
                              ]}
                            >
                              <InputNumber
                                min={1}
                                max={20}
                                className="w-full"
                              />
                            </Form.Item>
                            <Form.Item
                              name="expiresInDays"
                              label="有效期（天）"
                              rules={[
                                { required: true, message: "请输入有效期" },
                              ]}
                            >
                              <InputNumber
                                min={1}
                                max={90}
                                className="w-full"
                              />
                            </Form.Item>
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={submitting}
                            >
                              生成邀请码
                            </Button>
                          </Form>
                        </Card>
                      </Col>
                      <Col xs={24} xl={15}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <Space wrap>
                              <Input.Search
                                allowClear
                                placeholder="搜索邀请码或使用者"
                                value={inviteKeyword}
                                onChange={(event) =>
                                  setInviteKeyword(event.target.value)
                                }
                                style={{ width: 220 }}
                              />
                              <Select
                                value={inviteStatusFilter}
                                onChange={setInviteStatusFilter}
                                style={{ width: 132 }}
                                options={[
                                  { label: "全部状态", value: "ALL" },
                                  { label: "可用", value: "ACTIVE" },
                                  { label: "已使用", value: "USED" },
                                  { label: "已过期", value: "EXPIRED" },
                                ]}
                              />
                              <Button
                                icon={<ClearOutlined />}
                                disabled={!hasInviteFilters}
                                onClick={() => void resetInviteFilters()}
                              >
                                清空
                              </Button>
                            </Space>
                            <Space wrap>
                              {selectedInviteIds.length > 0 ? (
                                <Tag color="blue" className="m-0">
                                  已选 {selectedInviteIds.length} 个
                                </Tag>
                              ) : null}
                              <Popconfirm
                                title={`确认删除选中的 ${selectedInvites.length} 个邀请码吗？`}
                                okText="删除"
                                okButtonProps={{ danger: true }}
                                onConfirm={() =>
                                  void handleDeleteSelectedInvites()
                                }
                                disabled={selectedInvites.length === 0}
                              >
                                <Button
                                  danger
                                  icon={<DeleteOutlined />}
                                  loading={submitting}
                                  disabled={selectedInvites.length === 0}
                                >
                                  删除所选
                                </Button>
                              </Popconfirm>
                            </Space>
                          </div>
                          <Table<InviteCode>
                            rowKey="id"
                            loading={loading || inviteLoading}
                            columns={inviteColumns}
                            dataSource={inviteCodes}
                            rowSelection={{
                              selectedRowKeys: selectedInviteIds,
                              onChange: (keys) => {
                                setSelectedInviteIds(
                                  keys
                                    .map((key) => Number(key))
                                    .filter((key) => Number.isFinite(key)),
                                );
                              },
                            }}
                            pagination={{
                              current: invitePage,
                              pageSize: invitePageSize,
                              total: inviteTotal,
                              showSizeChanger: true,
                              pageSizeOptions: ["5", "10", "20", "50"],
                              showTotal: (total) => `共 ${total} 个`,
                            }}
                            scroll={{ x: 640 }}
                            onChange={(pagination) => {
                              void loadInviteCodes(
                                pagination.current ?? 1,
                                pagination.pageSize ?? invitePageSize,
                                inviteKeyword,
                                inviteStatusFilter,
                              );
                            }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </section>

                  <section
                    id="users"
                    className={sectionPanelClassName("users")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          用户管理
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          总计 {summary.total} 人，匹配 {userTotal} 人，当前页{" "}
                          {users.length} 人
                        </div>
                      </div>
                      <Space wrap>
                        <Input.Search
                          allowClear
                          placeholder="搜索昵称、账号或邮箱"
                          value={userKeyword}
                          onChange={(event) =>
                            setUserKeyword(event.target.value)
                          }
                          style={{ width: 240 }}
                        />
                        <Select
                          value={userRoleFilter}
                          onChange={setUserRoleFilter}
                          style={{ width: 132 }}
                          options={[
                            { label: "全部角色", value: "ALL" },
                            { label: "拥有者", value: "OWNER" },
                            { label: "管理员", value: "ADMIN" },
                            { label: "普通用户", value: "USER" },
                          ]}
                        />
                        <Select
                          value={userStatusFilter}
                          onChange={setUserStatusFilter}
                          style={{ width: 132 }}
                          options={[
                            { label: "全部状态", value: "ALL" },
                            { label: "正常", value: "ACTIVE" },
                            { label: "已禁用", value: "DISABLED" },
                          ]}
                        />
                        <Button
                          icon={<ClearOutlined />}
                          disabled={!hasUserFilters}
                          onClick={() => void resetUserFilters()}
                        >
                          清空
                        </Button>
                      </Space>
                    </div>
                    <Card className="rounded-[28px] border-slate-100 shadow-sm">
                      <Table<User>
                        rowKey="id"
                        loading={loading || userLoading}
                        columns={userColumns}
                        dataSource={users}
                        pagination={{
                          current: userPage,
                          pageSize: userPageSize,
                          total: userTotal,
                          showSizeChanger: true,
                          pageSizeOptions: ["6", "10", "20", "50"],
                          showTotal: (total) => `共 ${total} 人`,
                        }}
                        scroll={{ x: 760 }}
                        onChange={(pagination) => {
                          void loadUsers(
                            pagination.current ?? 1,
                            pagination.pageSize ?? userPageSize,
                            userKeyword,
                            userRoleFilter,
                            userStatusFilter,
                          );
                        }}
                      />
                    </Card>
                  </section>

                  <section
                    id="products"
                    className={sectionPanelClassName("products")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          商品管理
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          总计 {productSummary.total} 个，匹配 {productTotal}{" "}
                          个，当前页 {products.length} 个
                        </div>
                      </div>
                      <Space wrap>
                        <Tag color="green">
                          已上架 {productSummary.published}
                        </Tag>
                        <Tag>草稿 {productSummary.draft}</Tag>
                        <Tag color="red">已下架 {productSummary.offline}</Tag>
                      </Space>
                    </div>
                    <Row gutter={[24, 24]}>
                      <Col xs={24} xl={9}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <div className="mb-4">
                            <div className="text-base font-semibold text-slate-900">
                              {editingProduct ? "编辑商品" : "新增商品"}
                            </div>
                            {editingProduct ? (
                              <div className="mt-1 text-sm text-slate-500">
                                正在编辑：{editingProduct.title}
                              </div>
                            ) : null}
                            {!editingProduct ? (
                              <Space className="mt-3" wrap>
                                {productTemplates.map((template) => (
                                  <Button
                                    key={template.key}
                                    size="small"
                                    icon={<ShoppingCartOutlined />}
                                    onClick={() =>
                                      applyProductTemplate(template.key)
                                    }
                                  >
                                    {template.label}
                                  </Button>
                                ))}
                                <Select
                                  size="small"
                                  showSearch
                                  value={undefined}
                                  placeholder="邮箱类型快捷填充"
                                  optionFilterProp="label"
                                  style={{ minWidth: 190 }}
                                  options={emailProductTemplates.map(
                                    (template) => ({
                                      label: template.label,
                                      value: template.key,
                                    }),
                                  )}
                                  onChange={applyEmailProductTemplate}
                                />
                              </Space>
                            ) : null}
                          </div>
                          <Form
                            form={productForm}
                            layout="vertical"
                            onFinish={(values) =>
                              void handleSaveProduct(values)
                            }
                          >
                            <Form.Item
                              name="title"
                              label="商品名称"
                              rules={[
                                { required: true, message: "请输入商品名称" },
                              ]}
                            >
                              <Input maxLength={120} showCount />
                            </Form.Item>
                            <Form.Item name="subtitle" label="短简介">
                              <Input
                                maxLength={180}
                                showCount
                                placeholder="一句话说明卖点"
                              />
                            </Form.Item>
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item
                                  name="price"
                                  label="价格"
                                  rules={[
                                    { required: true, message: "请输入价格" },
                                  ]}
                                >
                                  <InputNumber
                                    min={0}
                                    max={99999999.99}
                                    precision={2}
                                    className="w-full"
                                    addonBefore="¥"
                                  />
                                </Form.Item>
                              </Col>
                              <Form.Item shouldUpdate noStyle>
                                {({ getFieldValue }) =>
                                  getFieldValue("deliveryType") ===
                                  "CDK_EMAIL" ? null : (
                                    <Col span={12}>
                                      <Form.Item
                                        name="stock"
                                        label="库存"
                                        rules={[
                                          {
                                            required: true,
                                            message: "请输入实际库存",
                                          },
                                        ]}
                                      >
                                        <InputNumber
                                          min={0}
                                          max={999999}
                                          precision={0}
                                          className="w-full"
                                          placeholder="请输入库存数量"
                                        />
                                      </Form.Item>
                                    </Col>
                                  )
                                }
                              </Form.Item>
                            </Row>
                            <Form.Item
                              name="deliveryType"
                              label="发货方式"
                              rules={[
                                { required: true, message: "请选择发货方式" },
                              ]}
                            >
                              <Select
                                onChange={handleProductDeliveryTypeChange}
                                options={[
                                  { label: "普通商品", value: "NONE" },
                                  {
                                    label: "邮箱链接 / CDK邮件发货",
                                    value: "CDK_EMAIL",
                                  },
                                ]}
                              />
                            </Form.Item>
                            <Form.Item shouldUpdate noStyle>
                              {({ getFieldValue }) => {
                                const isCdkEmail =
                                  getFieldValue("deliveryType") ===
                                  "CDK_EMAIL";
                                return (
                                  <Form.Item
                                    name="deliveryInstructions"
                                    label={
                                      isCdkEmail
                                        ? "邮件教程"
                                        : "邮件交付内容"
                                    }
                                    extra={
                                      isCdkEmail
                                        ? "将和分配的CDK一起发送到订单收货邮箱"
                                        : "普通商品领取或支付成功后，该内容会自动发送到订单收货邮箱"
                                    }
                                  >
                                    <Input.TextArea
                                      rows={4}
                                      maxLength={5000}
                                      showCount
                                      placeholder={
                                        isCdkEmail
                                          ? "例如：CDK兑换入口、激活步骤、售后联系方式"
                                          : "例如：下载地址、提取码、使用说明和售后联系方式"
                                      }
                                    />
                                  </Form.Item>
                                );
                              }}
                            </Form.Item>
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item
                                  name="status"
                                  label="状态"
                                  rules={[
                                    { required: true, message: "请选择状态" },
                                  ]}
                                >
                                  <Select
                                    options={[
                                      { label: "已上架", value: "PUBLISHED" },
                                      { label: "草稿", value: "DRAFT" },
                                      { label: "已下架", value: "OFFLINE" },
                                    ]}
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name="sortOrder" label="排序值">
                                  <InputNumber
                                    min={0}
                                    max={999999}
                                    precision={0}
                                    className="w-full"
                                  />
                                </Form.Item>
                              </Col>
                            </Row>
                            <Form.Item label="商品图片">
                              <Upload
                                accept={IMAGE_ACCEPT}
                                beforeUpload={handleProductImageBeforeUpload}
                                showUploadList={false}
                                maxCount={1}
                              >
                                <Button
                                  icon={<UploadOutlined />}
                                  loading={uploadingProductImage}
                                  disabled={submitting || uploadingProductImage}
                                >
                                  上传商品图片
                                </Button>
                              </Upload>
                            </Form.Item>
                            <Form.Item
                              shouldUpdate={(prev, next) =>
                                prev.imageUrl !== next.imageUrl
                              }
                              noStyle
                            >
                              {() => {
                                const selectedImageUrl = String(
                                  productForm.getFieldValue("imageUrl") ?? "",
                                );
                                return (
                                  <div className="mb-4 grid gap-2 sm:grid-cols-2">
                                    {defaultProductImages.map((item) => {
                                      const selected =
                                        selectedImageUrl === item.url;
                                      return (
                                        <button
                                          key={item.key}
                                          type="button"
                                          onClick={() =>
                                            applyDefaultProductImage(
                                              item.url,
                                              item.label,
                                            )
                                          }
                                          className={`flex min-w-0 items-center gap-3 rounded-2xl border p-2 text-left transition ${
                                            selected
                                              ? "border-blue-300 bg-blue-50"
                                              : "border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white"
                                          }`}
                                        >
                                          <img
                                            src={resolveAssetUrl(item.url)}
                                            alt={item.label}
                                            className="h-14 w-16 flex-shrink-0 rounded-xl object-cover"
                                          />
                                          <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold text-slate-900">
                                              {item.label}
                                            </span>
                                            <span className="mt-1 block truncate text-xs text-slate-500">
                                              {item.hint}
                                            </span>
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              }}
                            </Form.Item>
                            <Form.Item
                              name="imageUrl"
                              label="图片链接"
                              rules={[{ validator: validateOptionalImageUrl }]}
                            >
                              <Input
                                maxLength={500}
                                placeholder="可粘贴图片 URL，也可以点选默认商品图片"
                              />
                            </Form.Item>
                            <Form.Item shouldUpdate noStyle>
                              {() => {
                                const imageUrl = resolveAssetUrl(
                                  productForm.getFieldValue("imageUrl"),
                                );
                                return imageUrl ? (
                                  <div className="mb-4 overflow-hidden rounded-2xl border border-slate-100">
                                    <img
                                      src={imageUrl}
                                      alt="商品预览"
                                      className="h-40 w-full object-cover"
                                    />
                                  </div>
                                ) : null;
                              }}
                            </Form.Item>
                            <Form.Item name="description" label="详细介绍">
                              <Input.TextArea
                                rows={5}
                                maxLength={2000}
                                showCount
                              />
                            </Form.Item>
                            <Space>
                              <Button
                                type="primary"
                                htmlType="submit"
                                loading={submitting}
                              >
                                {editingProduct ? "保存商品" : "新增商品"}
                              </Button>
                              {editingProduct ? (
                                <Button onClick={resetProductEditor}>
                                  取消编辑
                                </Button>
                              ) : null}
                            </Space>
                          </Form>
                        </Card>
                      </Col>
                      <Col xs={24} xl={15}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <Input.Search
                              allowClear
                              placeholder="搜索商品名称、简介或价格"
                              value={productKeyword}
                              onChange={(event) =>
                                setProductKeyword(event.target.value)
                              }
                              style={{ width: 260 }}
                            />
                            <Select
                              value={productStatusFilter}
                              onChange={setProductStatusFilter}
                              style={{ width: 132 }}
                              options={[
                                { label: "全部状态", value: "ALL" },
                                { label: "已上架", value: "PUBLISHED" },
                                { label: "草稿", value: "DRAFT" },
                                { label: "已下架", value: "OFFLINE" },
                              ]}
                            />
                            <Button
                              icon={<ClearOutlined />}
                              disabled={!hasProductFilters}
                              onClick={() => void resetProductFilters()}
                            >
                              清空
                            </Button>
                          </div>
                          <Table<Product>
                            rowKey="id"
                            loading={loading || productLoading}
                            columns={productColumns}
                            dataSource={products}
                            pagination={{
                              current: productPage,
                              pageSize: productPageSize,
                              total: productTotal,
                              showSizeChanger: true,
                              pageSizeOptions: ["5", "10", "20", "50"],
                              showTotal: (total) => `共 ${total} 个商品`,
                            }}
                            scroll={{ x: 900 }}
                            onChange={(pagination) => {
                              void loadProducts(
                                pagination.current ?? 1,
                                pagination.pageSize ?? productPageSize,
                                productKeyword,
                                productStatusFilter,
                              );
                            }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </section>

                  <section
                    id="coupons"
                    className={sectionPanelClassName("coupons")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          优惠码管理
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          总计 {couponSummary.total} 个，匹配 {couponTotal}{" "}
                          个，当前页 {couponCodes.length} 个
                        </div>
                      </div>
                      <Space wrap>
                        <Tag color="green">可用 {couponSummary.active}</Tag>
                        <Tag color="orange">锁定 {couponSummary.locked}</Tag>
                        <Tag color="blue">已使用 {couponSummary.used}</Tag>
                        {couponSummary.disabled > 0 ? (
                          <Tag color="red">已作废 {couponSummary.disabled}</Tag>
                        ) : null}
                        {couponSummary.expired > 0 ? (
                          <Tag color="red">已过期 {couponSummary.expired}</Tag>
                        ) : null}
                      </Space>
                    </div>
                    <Row gutter={[24, 24]}>
                      <Col xs={24} xl={9}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <div className="mb-4">
                            <div className="text-base font-semibold text-slate-900">
                              批量生成优惠码
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                              选择商品后生成一次性优惠码，可按当前筛选导出 CSV。
                            </div>
                          </div>
                          <Form
                            form={couponForm}
                            layout="vertical"
                            onFinish={(values) =>
                              void handleCreateCouponCodes(values)
                            }
                          >
                            <Form.Item
                              name="productId"
                              label="对应商品"
                              rules={[
                                { required: true, message: "请选择商品" },
                              ]}
                            >
                              <Select
                                showSearch
                                optionFilterProp="label"
                                placeholder="选择商品"
                                options={couponProductOptions.map((item) => ({
                                  label: `${item.title} / ${priceText(item.price)}`,
                                  value: item.id,
                                }))}
                              />
                            </Form.Item>
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item
                                  name="count"
                                  label="生成数量"
                                  rules={[
                                    { required: true, message: "请输入数量" },
                                  ]}
                                >
                                  <InputNumber
                                    min={1}
                                    max={500}
                                    precision={0}
                                    className="w-full"
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item
                                  name="discountType"
                                  label="折扣类型"
                                  rules={[
                                    { required: true, message: "请选择类型" },
                                  ]}
                                >
                                  <Select
                                    options={[
                                      { label: "立减金额", value: "AMOUNT" },
                                      { label: "折扣比例", value: "PERCENT" },
                                    ]}
                                  />
                                </Form.Item>
                              </Col>
                            </Row>
                            <Form.Item
                              shouldUpdate={(prev, next) =>
                                prev.discountType !== next.discountType
                              }
                              noStyle
                            >
                              {() => {
                                const type =
                                  couponForm.getFieldValue("discountType");
                                return (
                                  <Form.Item
                                    name="discountValue"
                                    label={
                                      type === "PERCENT"
                                        ? "折扣比例"
                                        : "立减金额"
                                    }
                                    rules={[
                                      {
                                        required: true,
                                        message: "请输入折扣值",
                                      },
                                    ]}
                                  >
                                    <InputNumber
                                      min={0.01}
                                      max={
                                        type === "PERCENT" ? 100 : 99999999.99
                                      }
                                      precision={2}
                                      className="w-full"
                                      addonBefore={
                                        type === "PERCENT" ? undefined : "¥"
                                      }
                                      addonAfter={
                                        type === "PERCENT" ? "%" : undefined
                                      }
                                    />
                                  </Form.Item>
                                );
                              }}
                            </Form.Item>
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item
                                  name="expiresInDays"
                                  label="有效期（天）"
                                >
                                  <InputNumber
                                    min={1}
                                    max={3650}
                                    precision={0}
                                    className="w-full"
                                    placeholder="留空长期有效"
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name="prefix" label="前缀">
                                  <Input maxLength={10} placeholder="如 IDN" />
                                </Form.Item>
                              </Col>
                            </Row>
                            <Form.Item name="note" label="备注">
                              <Input
                                maxLength={300}
                                showCount
                                placeholder="如春节活动、老用户专享"
                              />
                            </Form.Item>
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={submitting}
                            >
                              生成优惠码
                            </Button>
                          </Form>
                        </Card>
                      </Col>
                      <Col xs={24} xl={15}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <Space wrap>
                              <Input.Search
                                allowClear
                                enterButton="搜索"
                                placeholder="搜索优惠码、批次或订单号"
                                value={couponKeyword}
                                onChange={(event) =>
                                  setCouponKeyword(event.target.value)
                                }
                                onSearch={(value) =>
                                  void loadCouponCodes(
                                    1,
                                    couponPageSizeRef.current,
                                    value,
                                    couponProductFilter,
                                    couponStatusFilter,
                                  )
                                }
                                style={{ width: 260 }}
                              />
                              <Select
                                value={couponProductFilter}
                                onChange={setCouponProductFilter}
                                style={{ width: 190 }}
                                options={[
                                  { label: "全部商品", value: "ALL" },
                                  ...couponProductOptions.map((item) => ({
                                    label: item.title,
                                    value: item.id,
                                  })),
                                ]}
                              />
                              <Select
                                value={couponStatusFilter}
                                onChange={setCouponStatusFilter}
                                style={{ width: 132 }}
                                options={[
                                  { label: "全部状态", value: "ALL" },
                                  { label: "可用", value: "ACTIVE" },
                                  { label: "已锁定", value: "LOCKED" },
                                  { label: "已使用", value: "USED" },
                                  { label: "已作废", value: "DISABLED" },
                                  { label: "已过期", value: "EXPIRED" },
                                ]}
                              />
                            </Space>
                            <Space>
                              {selectedCouponCodeIds.length > 0 ? (
                                <Tag color="blue" className="m-0">
                                  已选 {selectedCouponCodeIds.length} 个，可作废{" "}
                                  {selectedAvailableCouponCount} 个
                                </Tag>
                              ) : null}
                              <Popconfirm
                                title={`确认作废选中的 ${selectedAvailableCouponCount} 个可用优惠码吗？`}
                                onConfirm={() =>
                                  void handleDisableSelectedCouponCodes()
                                }
                                disabled={selectedAvailableCouponCount === 0}
                              >
                                <Button
                                  danger
                                  icon={<DeleteOutlined />}
                                  loading={submitting}
                                  disabled={selectedAvailableCouponCount === 0}
                                >
                                  作废所选
                                </Button>
                              </Popconfirm>
                              <Button
                                icon={<DownloadOutlined />}
                                loading={couponLoading}
                                onClick={() => void handleExportCouponCodes()}
                              >
                                导出
                              </Button>
                              <Button
                                icon={<ClearOutlined />}
                                disabled={!hasCouponFilters}
                                onClick={() => void resetCouponFilters()}
                              >
                                清空
                              </Button>
                              <Button
                                icon={<GiftOutlined />}
                                loading={couponLoading}
                                onClick={() => void refreshCouponCodes()}
                              >
                                刷新
                              </Button>
                            </Space>
                          </div>
                          <Table<ProductCouponCode>
                            rowKey="id"
                            loading={loading || couponLoading}
                            columns={couponColumns}
                            dataSource={couponCodes}
                            rowSelection={{
                              selectedRowKeys: selectedCouponCodeIds,
                              onChange: (keys) => {
                                setSelectedCouponCodeIds(
                                  keys
                                    .map((key) => Number(key))
                                    .filter((key) => Number.isFinite(key)),
                                );
                              },
                            }}
                            pagination={{
                              current: couponPage,
                              pageSize: couponPageSize,
                              total: couponTotal,
                              showSizeChanger: true,
                              showTotal: (total) => `共 ${total} 个`,
                            }}
                            onChange={(pagination) => {
                              void loadCouponCodes(
                                pagination.current ?? 1,
                                pagination.pageSize ?? couponPageSize,
                                couponKeyword,
                                couponProductFilter,
                                couponStatusFilter,
                              );
                            }}
                            scroll={{ x: 1080 }}
                            locale={{
                              emptyText: hasCouponFilters
                                ? "当前筛选没有匹配优惠码，可清空筛选后重试"
                                : "暂无优惠码",
                            }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </section>

                  <section
                    id="delivery-codes"
                    className={sectionPanelClassName("delivery-codes")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          CDK发货
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          总计 {deliveryCodeSummary.total} 个，匹配{" "}
                          {deliveryCodeTotal} 个，当前页 {deliveryCodes.length}{" "}
                          个
                        </div>
                      </div>
                      <Space wrap>
                        <Tag color="green">
                          可发货 {deliveryCodeSummary.available}
                        </Tag>
                        <Tag color="orange">
                          锁定 {deliveryCodeSummary.locked}
                        </Tag>
                        <Tag color="blue">
                          已发送 {deliveryCodeSummary.sent}
                        </Tag>
                        {deliveryCodeSummary.disabled > 0 ? (
                          <Tag color="red">
                            已作废 {deliveryCodeSummary.disabled}
                          </Tag>
                        ) : null}
                      </Space>
                    </div>
                    {lowDeliveryCodeProducts.length > 0 ? (
                      <Alert
                        showIcon
                        type="warning"
                        className="mb-4"
                        message={`低库存商品：${lowDeliveryCodeMessage}${lowDeliveryCodeProducts.length > 5 ? ` 等 ${lowDeliveryCodeProducts.length} 个` : ""}`}
                      />
                    ) : null}
                    <Row gutter={[24, 24]}>
                      <Col xs={24} xl={7}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <div className="mb-4">
                            <div className="text-base font-semibold text-slate-900">
                              导入CDK库存
                            </div>
                            {selectedDeliveryCodeProduct ? (
                              <div
                                className="mt-1 truncate text-sm text-slate-500"
                                title={selectedDeliveryCodeProduct.title}
                              >
                                当前补货：{selectedDeliveryCodeProduct.title}
                              </div>
                            ) : null}
                            <Space className="mt-3" wrap>
                              <Button
                                size="small"
                                icon={<KeyOutlined />}
                                onClick={applyDeliveryCodeImportTemplate}
                              >
                                填充示例
                              </Button>
                              <Button
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={downloadDeliveryCodeImportTemplate}
                              >
                                下载模板
                              </Button>
                            </Space>
                          </div>
                          {virtualProductOptions.length === 0 ? (
                            <Alert
                              showIcon
                              type="warning"
                              className="mb-4"
                              message="暂无虚拟CDK邮件商品"
                            />
                          ) : null}
                          <Form
                            form={deliveryCodeForm}
                            layout="vertical"
                            onFinish={(values) =>
                              void handleImportDeliveryCodes(values)
                            }
                          >
                            <Form.Item
                              name="productId"
                              label="对应商品"
                              rules={[
                                { required: true, message: "请选择商品" },
                              ]}
                            >
                              <Select
                                showSearch
                                placeholder="选择虚拟商品"
                                optionFilterProp="label"
                                options={virtualProductOptions.map((item) => ({
                                  label: deliveryCodeProductOptionLabel(item),
                                  value: item.id,
                                }))}
                              />
                            </Form.Item>
                            {selectedDeliveryCodeProduct ? (
                              <Alert
                                showIcon
                                type={selectedDeliveryCodeAlertType}
                                className="mb-4"
                                message={`当前可发货 ${selectedDeliveryCodeAvailableCount} 个`}
                                description={
                                  <Space size={4} wrap>
                                    <Tag color="green">
                                      可发货{" "}
                                      {selectedDeliveryCodeProduct.deliveryCodeAvailableCount ??
                                        0}
                                    </Tag>
                                    <Tag color="orange">
                                      锁定{" "}
                                      {selectedDeliveryCodeProduct.deliveryCodeLockedCount ??
                                        0}
                                    </Tag>
                                    <Tag color="blue">
                                      已发送{" "}
                                      {selectedDeliveryCodeProduct.deliveryCodeSentCount ??
                                        0}
                                    </Tag>
                                    <Tag color="red">
                                      已作废{" "}
                                      {selectedDeliveryCodeProduct.deliveryCodeDisabledCount ??
                                        0}
                                    </Tag>
                                  </Space>
                                }
                              />
                            ) : null}
                            <Form.Item
                              name="content"
                              label="CDK内容"
                              rules={[
                                { required: true, message: "请粘贴CDK内容" },
                              ]}
                              extra={
                                deliveryCodeRawImportCount > 0
                                  ? `已识别 ${deliveryCodeRawImportCount} 条，去重后 ${deliveryCodeImportCount} 个CDK${
                                      deliveryCodeDuplicateCount > 0
                                        ? `，重复 ${deliveryCodeDuplicateCount} 条会由后端跳过`
                                        : ""
                                    }`
                                  : undefined
                              }
                            >
                              <Input.TextArea
                                rows={10}
                                maxLength={20000}
                                showCount
                                placeholder="批量粘贴CDK，换行、空格、逗号、分号或表格分隔均可"
                              />
                            </Form.Item>
                            {deliveryCodeRawImportCount > 0 ? (
                              <Alert
                                showIcon
                                type={
                                  deliveryCodeDuplicateCount > 0
                                    ? "warning"
                                    : "info"
                                }
                                className="mb-4"
                                message={`准备导入 ${deliveryCodeImportCount} 个唯一CDK`}
                                description={
                                  deliveryCodeDuplicateCount > 0
                                    ? `检测到 ${deliveryCodeDuplicateCount} 条重复内容，本次提交仍会保留原文，后端会按库存规则跳过重复项。`
                                    : "未发现重复内容。"
                                }
                              />
                            ) : null}
                            <Form.Item name="note" label="备注">
                              <Input
                                maxLength={300}
                                showCount
                                placeholder="例如：7月批次"
                              />
                            </Form.Item>
                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={submitting}
                              disabled={
                                virtualProductOptions.length === 0 ||
                                deliveryCodeImportCount === 0
                              }
                            >
                              导入CDK
                            </Button>
                          </Form>
                        </Card>
                      </Col>
                      <Col xs={24} xl={17}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <Space wrap>
                              <Input.Search
                                allowClear
                                placeholder="搜索CDK、批次、订单或备注"
                                value={deliveryCodeKeyword}
                                onChange={(event) =>
                                  setDeliveryCodeKeyword(event.target.value)
                                }
                                onSearch={(value) =>
                                  void loadDeliveryCodes(
                                    1,
                                    deliveryCodePageSizeRef.current,
                                    value,
                                    deliveryCodeProductFilter,
                                    deliveryCodeStatusFilter,
                                  )
                                }
                                style={{ width: 260 }}
                              />
                              <Select
                                showSearch
                                optionFilterProp="label"
                                value={deliveryCodeProductFilter}
                                onChange={setDeliveryCodeProductFilter}
                                style={{ width: 180 }}
                                options={[
                                  { label: "全部商品", value: "ALL" },
                                  ...couponProductOptions.map((item) => ({
                                    label: item.title,
                                    value: item.id,
                                  })),
                                ]}
                              />
                              <Select
                                value={deliveryCodeStatusFilter}
                                onChange={setDeliveryCodeStatusFilter}
                                style={{ width: 132 }}
                                options={[
                                  { label: "全部状态", value: "ALL" },
                                  { label: "可发货", value: "AVAILABLE" },
                                  { label: "已锁定", value: "LOCKED" },
                                  { label: "已发送", value: "SENT" },
                                  { label: "已作废", value: "DISABLED" },
                                ]}
                              />
                            </Space>
                            <Space>
                              {selectedDeliveryCodeIds.length > 0 ? (
                                <Tag color="blue" className="m-0">
                                  已选 {selectedDeliveryCodeIds.length}{" "}
                                  个，可作废{" "}
                                  {selectedAvailableDeliveryCodeCount} 个
                                </Tag>
                              ) : null}
                              <Popconfirm
                                title={`确认作废选中的 ${selectedAvailableDeliveryCodeCount} 个可发货CDK吗？`}
                                onConfirm={() =>
                                  void handleDisableSelectedDeliveryCodes()
                                }
                                disabled={
                                  selectedAvailableDeliveryCodeCount === 0
                                }
                              >
                                <Button
                                  danger
                                  icon={<DeleteOutlined />}
                                  loading={submitting}
                                  disabled={
                                    selectedAvailableDeliveryCodeCount === 0
                                  }
                                >
                                  作废所选
                                </Button>
                              </Popconfirm>
                              <Button
                                icon={<ClearOutlined />}
                                disabled={!hasDeliveryCodeFilters}
                                onClick={() => void resetDeliveryCodeFilters()}
                              >
                                清空
                              </Button>
                              <Button
                                icon={<DownloadOutlined />}
                                loading={deliveryCodeLoading}
                                onClick={() => void handleExportDeliveryCodes()}
                              >
                                导出CDK
                              </Button>
                              <Button
                                icon={<KeyOutlined />}
                                loading={deliveryCodeLoading}
                                onClick={() => void refreshDeliveryCodes()}
                              >
                                刷新CDK
                              </Button>
                            </Space>
                          </div>
                          <Table<ProductDeliveryCode>
                            rowKey="id"
                            loading={loading || deliveryCodeLoading}
                            columns={deliveryCodeColumns}
                            dataSource={deliveryCodes}
                            rowSelection={{
                              selectedRowKeys: selectedDeliveryCodeIds,
                              onChange: (keys) => {
                                setSelectedDeliveryCodeIds(
                                  keys
                                    .map((key) => Number(key))
                                    .filter((key) => Number.isFinite(key)),
                                );
                              },
                            }}
                            pagination={{
                              current: deliveryCodePage,
                              pageSize: deliveryCodePageSize,
                              total: deliveryCodeTotal,
                              showSizeChanger: true,
                              showTotal: (total) => `共 ${total} 个`,
                            }}
                            onChange={(pagination) => {
                              void loadDeliveryCodes(
                                pagination.current ?? 1,
                                pagination.pageSize ?? deliveryCodePageSize,
                                deliveryCodeKeyword,
                                deliveryCodeProductFilter,
                                deliveryCodeStatusFilter,
                              );
                            }}
                            scroll={{ x: 1120 }}
                            locale={{
                              emptyText: hasDeliveryCodeFilters
                                ? "当前筛选没有匹配CDK，可清空筛选后重试"
                                : "暂无CDK库存",
                            }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </section>
                  <section
                    id="payments"
                    className={sectionPanelClassName("payments")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          支付订单
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          总计 {paymentSummary.total} 条，匹配 {paymentTotal}{" "}
                          条，当前页 {paymentOrders.length} 条
                        </div>
                      </div>
                      <Space wrap>
                        {paymentSummary.created > 0 ? (
                          <Tag color="blue">
                            已创建 {paymentSummary.created}
                          </Tag>
                        ) : null}
                        <Tag color="orange">
                          待支付 {paymentSummary.waiting}
                        </Tag>
                        <Tag color="green">已支付 {paymentSummary.paid}</Tag>
                        <Tag>已关闭 {paymentSummary.closed}</Tag>
                        {paymentSummary.failed > 0 ? (
                          <Tag color="red">失败 {paymentSummary.failed}</Tag>
                        ) : null}
                        {paymentSummary.errors > 0 ? (
                          <Tag color="red">异常 {paymentSummary.errors}</Tag>
                        ) : null}
                        {paymentSummary.openSupport > 0 ? (
                          <Tag color="orange">
                            待回复售后 {paymentSummary.openSupport}
                          </Tag>
                        ) : null}
                      </Space>
                    </div>
                    <Card className="rounded-[28px] border-slate-100 shadow-sm">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <Space wrap>
                          <Input.Search
                            allowClear
                            enterButton="搜索"
                            placeholder="搜索订单号、标题、优惠码、付款人或收货邮箱"
                            value={paymentKeyword}
                            onChange={(event) =>
                              setPaymentKeyword(event.target.value)
                            }
                            onSearch={(value) =>
                              void loadPaymentOrders(
                                1,
                                paymentPageSizeRef.current,
                                value,
                                paymentStatusFilter,
                                paymentResourceFilter,
                                paymentErrorFilter,
                                paymentCouponFilter,
                                paymentSupportFilter,
                              )
                            }
                            style={{ width: 260 }}
                          />
                          <Select
                            value={paymentStatusFilter}
                            onChange={handlePaymentStatusFilter}
                            style={{ width: 150 }}
                            options={[
                              { label: "全部状态", value: "ALL" },
                              { label: "已创建", value: "CREATED" },
                              { label: "待支付", value: "WAIT_BUYER_PAY" },
                              { label: "支付成功", value: "TRADE_SUCCESS" },
                              { label: "交易完成", value: "TRADE_FINISHED" },
                              { label: "已关闭", value: "TRADE_CLOSED" },
                              { label: "失败", value: "FAILED" },
                            ]}
                          />
                          <Select
                            value={paymentResourceFilter}
                            onChange={handlePaymentResourceFilter}
                            style={{ width: 132 }}
                            options={[
                              { label: "全部资源", value: "ALL" },
                              { label: "商品订单", value: "PRODUCT" },
                            ]}
                          />
                          <Select
                            value={paymentErrorFilter}
                            onChange={handlePaymentErrorFilter}
                            style={{ width: 150 }}
                            options={[
                              { label: "全部异常", value: "ALL" },
                              { label: "仅有异常", value: "HAS_ERROR" },
                              { label: "无异常", value: "NO_ERROR" },
                            ]}
                          />
                          <Select
                            value={paymentCouponFilter}
                            onChange={handlePaymentCouponFilter}
                            style={{ width: 150 }}
                            options={[
                              { label: "全部优惠码", value: "ALL" },
                              { label: "使用优惠码", value: "HAS_COUPON" },
                              { label: "未使用优惠码", value: "NO_COUPON" },
                            ]}
                          />
                          <Select
                            value={paymentSupportFilter}
                            onChange={handlePaymentSupportFilter}
                            style={{ width: 150 }}
                            options={[
                              { label: "全部售后", value: "ALL" },
                              { label: "待回复售后", value: "OPEN" },
                              { label: "已回复售后", value: "RESOLVED" },
                            ]}
                          />
                        </Space>
                        <Space>
                          <Button
                            icon={<DownloadOutlined />}
                            loading={paymentExporting}
                            onClick={() => void handleExportPaymentOrders()}
                          >
                            导出当前筛选
                          </Button>
                          <Button
                            icon={<ClearOutlined />}
                            disabled={!hasPaymentFilters}
                            onClick={() => void resetPaymentFilters()}
                          >
                            清空
                          </Button>
                          <Button
                            icon={<CreditCardOutlined />}
                            loading={paymentLoading}
                            onClick={() => void refreshPaymentOrders()}
                          >
                            刷新订单
                          </Button>
                        </Space>
                      </div>
                      <Table<AdminPaymentOrder>
                        rowKey="id"
                        loading={loading || paymentLoading}
                        columns={paymentColumns}
                        dataSource={paymentOrders}
                        pagination={{
                          current: paymentPage,
                          pageSize: paymentPageSize,
                          total: paymentTotal,
                          showSizeChanger: true,
                          showTotal: (total) => `共 ${total} 条`,
                        }}
                        onChange={(pagination) => {
                          void loadPaymentOrders(
                            pagination.current ?? 1,
                            pagination.pageSize ?? paymentPageSize,
                            paymentKeyword,
                            paymentStatusFilter,
                            paymentResourceFilter,
                            paymentErrorFilter,
                            paymentCouponFilter,
                            paymentSupportFilter,
                          );
                        }}
                        scroll={{ x: 1180 }}
                        locale={{
                          emptyText: hasPaymentFilters
                            ? "当前筛选没有匹配支付订单，可清空筛选后重试"
                            : "暂无支付订单",
                        }}
                      />
                    </Card>
                  </section>

                  <section
                    id="vmq-payment"
                    className={sectionPanelClassName("vmq-payment")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          V免签配置
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          {vmqSettings?.updateTime
                            ? `最后更新 ${vmqSettings.updateTime}`
                            : "尚未保存配置"}
                        </div>
                      </div>
                      <Space wrap>
                        <Tag color={vmqSettings?.enabled ? "green" : "default"}>
                          {vmqSettings?.enabled ? "已启用" : "未启用"}
                        </Tag>
                        <Tag
                          color={vmqMonitorStatusColor(
                            vmqSettings?.monitorState,
                          )}
                        >
                          {vmqMonitorStatusLabel(vmqSettings?.monitorState)}
                        </Tag>
                      </Space>
                    </div>
                    <Card className="rounded-[28px] border-slate-100 shadow-sm">
                      <Form
                        form={vmqForm}
                        layout="vertical"
                        onFinish={(values) =>
                          void handleSaveVmqSettings(values)
                        }
                      >
                        <Row gutter={[16, 16]}>
                          <Col xs={24} md={8}>
                            <Form.Item
                              name="enabled"
                              label="启用内置 V免签"
                              valuePropName="checked"
                            >
                              <Switch />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item
                              name="preferred"
                              label="优先使用 V免签"
                              valuePropName="checked"
                            >
                              <Switch />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={8}>
                            <Form.Item name="payType" label="默认收款方式">
                              <Select
                                options={[
                                  { label: "支付宝", value: 2 },
                                  { label: "微信", value: 1 },
                                ]}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="amountStrategy"
                              label="金额区分策略"
                            >
                              <Select
                                options={[
                                  { label: "冲突时加 0.01", value: "INCREASE" },
                                  { label: "冲突时减 0.01", value: "DECREASE" },
                                ]}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="orderTimeoutMinutes"
                              label="订单有效分钟"
                            >
                              <InputNumber
                                min={1}
                                max={1440}
                                className="w-full"
                              />
                            </Form.Item>
                          </Col>
                        </Row>

                        <Form.Item
                          name="communicationKey"
                          label="通讯密钥"
                          rules={[
                            { required: true, message: "请填写通讯密钥" },
                            {
                              pattern: /^[A-Za-z0-9_-]{16,64}$/,
                              message:
                                "通讯密钥需为 16-64 位字母、数字、下划线或短横线",
                            },
                          ]}
                        >
                          <Input.Password placeholder="系统会自动生成通讯密钥" />
                        </Form.Item>
                        <Space wrap className="mb-4">
                          <Button
                            icon={<KeyOutlined />}
                            disabled={
                              !(
                                vmqForm.getFieldValue("communicationKey") ||
                                vmqSettings?.communicationKey
                              )
                            }
                            onClick={() =>
                              void copyText(
                                vmqForm.getFieldValue("communicationKey") ||
                                  vmqSettings?.communicationKey ||
                                  "",
                                "通讯密钥已复制",
                              )
                            }
                          >
                            复制密钥
                          </Button>
                          <Popconfirm
                            title="重新生成后旧监听端会失效，确认继续吗？"
                            onConfirm={() => void handleRegenerateVmqKey()}
                          >
                            <Button danger loading={vmqLoading}>
                              重新生成
                            </Button>
                          </Popconfirm>
                        </Space>

                        <div className="mb-5 grid gap-3 lg:grid-cols-3">
                          {[
                            {
                              label: "状态接口",
                              value: vmqSettings?.getStateUrl,
                              copied: "状态接口已复制",
                            },
                            {
                              label: "心跳接口",
                              value: vmqSettings?.appHeartUrl,
                              copied: "心跳接口已复制",
                            },
                            {
                              label: "收款推送接口",
                              value: vmqSettings?.appPushUrl,
                              copied: "收款推送接口已复制",
                            },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="rounded-2xl border border-slate-100 bg-slate-50 p-3"
                            >
                              <div className="mb-2 text-xs font-bold text-slate-500">
                                {item.label}
                              </div>
                              <Space.Compact className="w-full">
                                <Input
                                  readOnly
                                  value={item.value || ""}
                                  placeholder="-"
                                />
                                <Button
                                  disabled={!item.value}
                                  onClick={() =>
                                    void copyText(item.value || "", item.copied)
                                  }
                                >
                                  复制
                                </Button>
                              </Space.Compact>
                            </div>
                          ))}
                        </div>

                        <Row gutter={[16, 16]}>
                          <Col xs={24} lg={12}>
                            <Form.Item
                              name="alipayPayUrl"
                              label="支付宝收款码内容"
                              rules={[
                                ({ getFieldValue }) => ({
                                  validator(_, value) {
                                    if (
                                      !getFieldValue("enabled") ||
                                      getFieldValue("payType") !== 2 ||
                                      String(value || "").trim()
                                    ) {
                                      return Promise.resolve();
                                    }
                                    return Promise.reject(
                                      new Error("启用支付宝时需要填写收款码内容"),
                                    );
                                  },
                                }),
                              ]}
                            >
                              <Input.TextArea
                                rows={3}
                                maxLength={512}
                                showCount
                                placeholder="例如 HTTPS://QR.ALIPAY.COM/..."
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} lg={12}>
                            <Form.Item
                              name="wxPayUrl"
                              label="微信收款码内容"
                              rules={[
                                ({ getFieldValue }) => ({
                                  validator(_, value) {
                                    if (
                                      !getFieldValue("enabled") ||
                                      getFieldValue("payType") !== 1 ||
                                      String(value || "").trim()
                                    ) {
                                      return Promise.resolve();
                                    }
                                    return Promise.reject(
                                      new Error("启用微信时需要填写收款码内容"),
                                    );
                                  },
                                }),
                              ]}
                            >
                              <Input.TextArea
                                rows={3}
                                maxLength={512}
                                showCount
                                placeholder="例如 wxp://..."
                              />
                            </Form.Item>
                          </Col>
                        </Row>

                        <div className="mb-5 grid gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-slate-100 px-4 py-3">
                            <div className="text-xs font-bold text-slate-500">
                              最近心跳
                            </div>
                            <div className="mt-1 text-sm text-slate-900">
                              {vmqSettings?.lastHeartTime || "-"}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-slate-100 px-4 py-3">
                            <div className="text-xs font-bold text-slate-500">
                              最近收款
                            </div>
                            <div className="mt-1 text-sm text-slate-900">
                              {vmqSettings?.lastPayTime || "-"}
                            </div>
                          </div>
                        </div>

                        <Space wrap>
                          <Button
                            type="primary"
                            htmlType="submit"
                            loading={vmqLoading}
                          >
                            保存配置
                          </Button>
                          <Button
                            icon={<QrcodeOutlined />}
                            loading={vmqLoading}
                            onClick={() => void loadVmqPaymentSettings()}
                          >
                            刷新状态
                          </Button>
                        </Space>
                      </Form>
                    </Card>
                  </section>

                  <section
                    id="downloads"
                    className={sectionPanelClassName("downloads")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          下载管理
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          总计 {downloadSummary.total} 项，匹配 {downloadTotal}{" "}
                          项，当前页 {downloads.length} 项
                        </div>
                      </div>
                      <Space wrap>
                        <Tag color="orange">
                          验证后下载 {downloadSummary.locked}
                        </Tag>
                        <Tag color="green">直接下载 {downloadSummary.open}</Tag>
                      </Space>
                    </div>
                    <Row gutter={[24, 24]}>
                      <Col xs={24} xl={9}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <div className="mb-4">
                            <div className="text-base font-semibold text-slate-900">
                              {editingDownload
                                ? "编辑下载内容"
                                : "新增下载内容"}
                            </div>
                            {editingDownload ? (
                              <div className="mt-1 text-sm text-slate-500">
                                正在编辑：{editingDownload.title}
                              </div>
                            ) : null}
                          </div>
                          <Form
                            form={downloadForm}
                            layout="vertical"
                            onFinish={(values) =>
                              void handleSaveDownload(values)
                            }
                          >
                            <Form.Item
                              name="title"
                              label="资源名称"
                              rules={[
                                { required: true, message: "请输入资源名称" },
                              ]}
                            >
                              <Input />
                            </Form.Item>
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name="category" label="分类">
                                  <Input />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name="version" label="版本">
                                  <Input />
                                </Form.Item>
                              </Col>
                            </Row>
                            <Form.Item label="上传文件（自动填充链接与大小）">
                              <Upload
                                beforeUpload={handleDownloadFileBeforeUpload}
                                showUploadList={false}
                                maxCount={1}
                              >
                                <Button
                                  icon={<UploadOutlined />}
                                  loading={uploadingDownloadFile}
                                  disabled={submitting || uploadingDownloadFile}
                                >
                                  选择文件并上传到服务器
                                </Button>
                              </Upload>
                            </Form.Item>
                            <Form.Item
                              name="url"
                              label="下载链接"
                              rules={[
                                { required: true, message: "请输入下载链接" },
                                { validator: validateDownloadUrl },
                              ]}
                            >
                              <Input />
                            </Form.Item>
                            <Row gutter={12}>
                              <Col span={12}>
                                <Form.Item name="fileSize" label="文件大小">
                                  <Input />
                                </Form.Item>
                              </Col>
                              <Col span={12}>
                                <Form.Item name="sortOrder" label="排序值">
                                  <InputNumber min={0} className="w-full" />
                                </Form.Item>
                              </Col>
                            </Row>
                            <Form.Item
                              name="checksumSha256"
                              label="SHA256 校验值"
                            >
                              <Input />
                            </Form.Item>
                            <Form.Item name="changelog" label="更新说明">
                              <Input.TextArea rows={4} />
                            </Form.Item>
                            <Form.Item
                              name="locked"
                              label="需要验证码下载"
                              valuePropName="checked"
                            >
                              <Switch />
                            </Form.Item>
                            <Form.Item
                              name="passwordProtected"
                              label="启用独立下载密码"
                              valuePropName="checked"
                            >
                              <Switch />
                            </Form.Item>
                            <Form.Item shouldUpdate noStyle>
                              {({ getFieldValue }) =>
                                getFieldValue("passwordProtected") ? (
                                  <Form.Item
                                    name="downloadPassword"
                                    label={
                                      editingDownload?.passwordProtected
                                        ? "更换下载密码"
                                        : "下载密码"
                                    }
                                    extra={
                                      editingDownload?.passwordProtected
                                        ? "留空会保留当前密码；输入新密码后将立即替换"
                                        : "每个下载资源可以设置不同密码，长度 4 到 64 个字符"
                                    }
                                    rules={[
                                      {
                                        validator: (_, value) => {
                                          const password = String(
                                            value ?? "",
                                          ).trim();
                                          if (
                                            !password &&
                                            editingDownload?.passwordProtected
                                          ) {
                                            return Promise.resolve();
                                          }
                                          if (
                                            password.length < 4 ||
                                            password.length > 64
                                          ) {
                                            return Promise.reject(
                                              new Error(
                                                "下载密码长度需为 4 到 64 个字符",
                                              ),
                                            );
                                          }
                                          return Promise.resolve();
                                        },
                                      },
                                    ]}
                                  >
                                    <Input.Password
                                      maxLength={64}
                                      autoComplete="new-password"
                                      placeholder="请输入该资源的独立下载密码"
                                    />
                                  </Form.Item>
                                ) : null
                              }
                            </Form.Item>
                            <Space>
                              <Button
                                type="primary"
                                htmlType="submit"
                                loading={submitting}
                              >
                                {editingDownload
                                  ? "保存下载内容"
                                  : "新增下载内容"}
                              </Button>
                              {editingDownload ? (
                                <Button onClick={resetDownloadEditor}>
                                  取消编辑
                                </Button>
                              ) : null}
                            </Space>
                          </Form>
                        </Card>
                      </Col>
                      <Col xs={24} xl={15}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <Input.Search
                              allowClear
                              placeholder="搜索资源名称、分类或版本"
                              value={downloadKeyword}
                              onChange={(event) =>
                                setDownloadKeyword(event.target.value)
                              }
                              style={{ width: 260 }}
                            />
                            <Select
                              value={downloadModeFilter}
                              onChange={setDownloadModeFilter}
                              style={{ width: 150 }}
                              options={[
                                { label: "全部方式", value: "ALL" },
                                { label: "验证后下载", value: "LOCKED" },
                                { label: "直接下载", value: "OPEN" },
                              ]}
                            />
                            <Button
                              icon={<ClearOutlined />}
                              disabled={!hasDownloadFilters}
                              onClick={() => void resetDownloadFilters()}
                            >
                              清空
                            </Button>
                          </div>
                          <Table<DownloadResource>
                            rowKey="id"
                            loading={loading || downloadLoading}
                            columns={downloadColumns}
                            dataSource={downloads}
                            pagination={{
                              current: downloadPage,
                              pageSize: downloadPageSize,
                              total: downloadTotal,
                              showSizeChanger: true,
                              pageSizeOptions: ["5", "10", "20", "50"],
                              showTotal: (total) => `共 ${total} 项`,
                            }}
                            scroll={{ x: 760 }}
                            onChange={(pagination) => {
                              void loadDownloads(
                                pagination.current ?? 1,
                                pagination.pageSize ?? downloadPageSize,
                                downloadKeyword,
                                downloadModeFilter,
                              );
                            }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </section>

                  <section
                    id="system-health"
                    className={sectionPanelClassName("system-health")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          系统状态
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          检查邮件、支付、发货、下载这些最容易影响成交的配置。
                        </div>
                      </div>
                      <Space wrap>
                        <Tag color={systemHealthStatusColor(systemHealth?.status)}>
                          {systemHealthStatusLabel(systemHealth?.status)}
                        </Tag>
                        <Button
                          icon={<HeartOutlined />}
                          loading={systemHealthLoading}
                          onClick={() => void loadSystemHealth()}
                        >
                          重新检查
                        </Button>
                      </Space>
                    </div>

                    <Row gutter={[20, 20]}>
                      <Col xs={24} lg={8}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <div className="text-sm font-bold text-slate-500">
                            健康评分
                          </div>
                          <div className="mt-3 text-5xl font-extrabold text-slate-950">
                            {systemHealthPercent}%
                          </div>
                          <Progress
                            className="mt-3"
                            percent={systemHealthPercent}
                            showInfo={false}
                            strokeColor={
                              systemHealth?.status === "ERROR"
                                ? "#dc2626"
                                : systemHealth?.status === "WARNING"
                                  ? "#d97706"
                                  : "#16a34a"
                            }
                          />
                          <div className="mt-4 text-sm leading-6 text-slate-500">
                            {systemHealth?.checkedAt
                              ? `${systemHealth.checkedAt} 检查`
                              : "等待检查结果"}
                          </div>
                        </Card>
                      </Col>
                      <Col xs={24} lg={16}>
                        <div className="grid gap-4 md:grid-cols-2">
                          {(systemHealth?.items ?? []).map((item) => (
                            <Card
                              key={item.key}
                              className="rounded-[24px] border-slate-100 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-base font-semibold text-slate-950">
                                    {item.title}
                                  </div>
                                  <div className="mt-1 text-sm font-medium text-slate-700">
                                    {item.summary}
                                  </div>
                                </div>
                                <Tag color={systemHealthStatusColor(item.status)}>
                                  {systemHealthStatusLabel(item.status)}
                                </Tag>
                              </div>
                              <div className="mt-3 min-h-10 text-sm leading-6 text-slate-500">
                                {item.detail || "暂无详情"}
                              </div>
                              {item.targetSection ? (
                                <Button
                                  className="mt-4"
                                  size="small"
                                  onClick={() => {
                                    if (
                                      sectionItems.some(
                                        (section) =>
                                          section.id === item.targetSection,
                                      )
                                    ) {
                                      switchSection(
                                        item.targetSection as AdminSectionId,
                                      );
                                    }
                                  }}
                                >
                                  {item.actionLabel || "去处理"}
                                </Button>
                              ) : null}
                            </Card>
                          ))}
                          {!systemHealth?.items?.length ? (
                            <Card className="rounded-[24px] border-slate-100 shadow-sm">
                              <div className="text-sm text-slate-500">
                                暂无检查结果，请点击重新检查。
                              </div>
                            </Card>
                          ) : null}
                        </div>
                      </Col>
                    </Row>
                  </section>

                  <section
                    id="notices"
                    className={sectionPanelClassName("notices")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          公告管理
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          总计 {noticeSummary.total} 条，匹配 {noticeTotal}{" "}
                          条，当前页 {siteNotices.length} 条
                        </div>
                      </div>
                      <Space wrap>
                        <Tag color="green">
                          已发布 {noticeSummary.published}
                        </Tag>
                        <Tag>未发布 {noticeSummary.draft}</Tag>
                      </Space>
                    </div>
                    <Row gutter={[24, 24]}>
                      <Col xs={24} xl={9}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <Form
                            form={noticeForm}
                            layout="vertical"
                            onFinish={(values) => void handleSaveNotice(values)}
                          >
                            <Form.Item
                              name="title"
                              label="公告标题"
                              rules={[
                                { required: true, message: "请输入公告标题" },
                              ]}
                            >
                              <Input />
                            </Form.Item>
                            <Form.Item
                              name="content"
                              label="公告内容"
                              rules={[
                                { required: true, message: "请输入公告内容" },
                              ]}
                            >
                              <Input.TextArea rows={5} />
                            </Form.Item>
                            <Form.Item name="sortOrder" label="排序值">
                              <InputNumber min={0} className="w-full" />
                            </Form.Item>
                            <Form.Item
                              name="published"
                              label="立即发布"
                              valuePropName="checked"
                            >
                              <Switch />
                            </Form.Item>
                            <Space>
                              <Button
                                type="primary"
                                htmlType="submit"
                                loading={submitting}
                              >
                                {editingNotice ? "保存公告" : "新增公告"}
                              </Button>
                              {editingNotice ? (
                                <Button
                                  onClick={() => {
                                    setEditingNotice(null);
                                    noticeForm.resetFields();
                                    noticeForm.setFieldsValue({
                                      published: true,
                                      sortOrder: 0,
                                    });
                                  }}
                                >
                                  取消编辑
                                </Button>
                              ) : null}
                            </Space>
                          </Form>
                        </Card>
                      </Col>
                      <Col xs={24} xl={15}>
                        <Card className="rounded-[28px] border-slate-100 shadow-sm">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <Space wrap>
                              <Input.Search
                                allowClear
                                placeholder="搜索公告标题或内容"
                                value={noticeKeyword}
                                onChange={(event) => {
                                  setNoticeKeyword(event.target.value);
                                  setSelectedNoticeIds([]);
                                }}
                                style={{ width: 240 }}
                              />
                              <Select
                                value={noticeStatusFilter}
                                onChange={(value) => {
                                  setNoticeStatusFilter(value);
                                  setSelectedNoticeIds([]);
                                }}
                                style={{ width: 132 }}
                                options={[
                                  { label: "全部公告", value: "ALL" },
                                  { label: "已发布", value: "PUBLISHED" },
                                  { label: "未发布", value: "DRAFT" },
                                ]}
                              />
                              <Button
                                icon={<ClearOutlined />}
                                disabled={!hasNoticeFilters}
                                onClick={() => void resetNoticeFilters()}
                              >
                                清空
                              </Button>
                            </Space>
                            <Space wrap>
                              {selectedNoticeIds.length > 0 ? (
                                <Tag color="blue" className="m-0">
                                  已选 {selectedNoticeIds.length} 条
                                </Tag>
                              ) : null}
                              <Button
                                loading={submitting}
                                disabled={selectedDraftNoticeCount === 0}
                                onClick={() =>
                                  void handleUpdateSelectedNotices(true)
                                }
                              >
                                发布所选
                              </Button>
                              <Button
                                loading={submitting}
                                disabled={selectedPublishedNoticeCount === 0}
                                onClick={() =>
                                  void handleUpdateSelectedNotices(false)
                                }
                              >
                                下线所选
                              </Button>
                              <Popconfirm
                                title={`确认删除选中的 ${selectedNotices.length} 条公告吗？`}
                                okText="删除"
                                okButtonProps={{ danger: true }}
                                onConfirm={() =>
                                  void handleDeleteSelectedNotices()
                                }
                                disabled={selectedNotices.length === 0}
                              >
                                <Button
                                  danger
                                  icon={<DeleteOutlined />}
                                  loading={submitting}
                                  disabled={selectedNotices.length === 0}
                                >
                                  删除所选
                                </Button>
                              </Popconfirm>
                            </Space>
                          </div>
                          <Table<SiteNotice>
                            rowKey="id"
                            loading={loading || noticeLoading}
                            columns={noticeColumns}
                            dataSource={siteNotices}
                            rowSelection={{
                              selectedRowKeys: selectedNoticeIds,
                              onChange: (keys) => {
                                setSelectedNoticeIds(
                                  keys
                                    .map((key) => Number(key))
                                    .filter((key) => Number.isFinite(key)),
                                );
                              },
                            }}
                            pagination={{
                              current: noticePage,
                              pageSize: noticePageSize,
                              total: noticeTotal,
                              showSizeChanger: true,
                              pageSizeOptions: ["5", "10", "20", "50"],
                              showTotal: (total) => `共 ${total} 条`,
                            }}
                            scroll={{ x: 760 }}
                            locale={{
                              emptyText: hasNoticeFilters
                                ? "当前筛选没有匹配公告，可清空筛选后重试"
                                : "暂无公告",
                            }}
                            onChange={(pagination) => {
                              void loadSiteNotices(
                                pagination.current ?? 1,
                                pagination.pageSize ?? noticePageSize,
                                noticeKeyword,
                                noticeStatusFilter,
                              );
                            }}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </section>

                  <section
                    id="reports"
                    className={sectionPanelClassName("reports")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          举报处理
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          总计 {reportSummary.total} 条，匹配 {reportTotal}{" "}
                          条，当前页 {postReports.length} 条
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-sm text-slate-500">
                          <span>待处理 {reportSummary.pending}</span>
                          <span>已处理 {reportSummary.resolved}</span>
                          <span>已驳回 {reportSummary.rejected}</span>
                        </div>
                      </div>
                      <Space wrap>
                        {selectedReportIds.length > 0 ? (
                          <Tag color="blue" className="m-0">
                            已选 {selectedReportIds.length} 条
                          </Tag>
                        ) : null}
                        <Popconfirm
                          title={`确认把选中的 ${selectedUnresolvedReportCount} 条举报标记为已处理吗？`}
                          onConfirm={() =>
                            void handleReviewSelectedReports("RESOLVED")
                          }
                          disabled={selectedUnresolvedReportCount === 0}
                        >
                          <Button
                            loading={submitting}
                            disabled={selectedUnresolvedReportCount === 0}
                          >
                            处理所选
                          </Button>
                        </Popconfirm>
                        <Popconfirm
                          title={`确认驳回选中的 ${selectedUnrejectedReportCount} 条举报吗？`}
                          onConfirm={() =>
                            void handleReviewSelectedReports("REJECTED")
                          }
                          disabled={selectedUnrejectedReportCount === 0}
                        >
                          <Button
                            danger
                            loading={submitting}
                            disabled={selectedUnrejectedReportCount === 0}
                          >
                            驳回所选
                          </Button>
                        </Popconfirm>
                        <Select
                          value={reportStatus}
                          onChange={(value) => void handleReportFilter(value)}
                          style={{ width: 150 }}
                          options={[
                            { label: "全部状态", value: "ALL" },
                            { label: "待处理", value: "PENDING" },
                            { label: "已处理", value: "RESOLVED" },
                            { label: "已驳回", value: "REJECTED" },
                          ]}
                        />
                        <Button
                          icon={<ClearOutlined />}
                          disabled={!hasReportFilters}
                          onClick={() => void resetReportFilters()}
                        >
                          清空
                        </Button>
                        <Button
                          icon={<BellOutlined />}
                          loading={reportLoading}
                          onClick={() => {
                            void Promise.all([
                              loadPostReports(
                                reportPage,
                                reportPageSizeRef.current,
                                reportStatus,
                              ),
                              loadPostReportStats(),
                            ]);
                          }}
                        >
                          刷新
                        </Button>
                      </Space>
                    </div>
                    <Card className="rounded-[28px] border-slate-100 shadow-sm">
                      <Table<AdminPostReport>
                        rowKey="id"
                        loading={loading || reportLoading}
                        columns={reportColumns}
                        dataSource={postReports}
                        rowSelection={{
                          selectedRowKeys: selectedReportIds,
                          onChange: (keys) => {
                            setSelectedReportIds(
                              keys
                                .map((key) => Number(key))
                                .filter((key) => Number.isFinite(key)),
                            );
                          },
                        }}
                        pagination={{
                          current: reportPage,
                          pageSize: reportPageSize,
                          total: reportTotal,
                          showSizeChanger: true,
                          pageSizeOptions: ["6", "10", "20", "50"],
                          showTotal: (total) => `共 ${total} 条`,
                        }}
                        onChange={(pagination) => {
                          void loadPostReports(
                            pagination.current ?? 1,
                            pagination.pageSize ?? reportPageSize,
                            reportStatus,
                          );
                        }}
                        scroll={{ x: 900 }}
                        locale={{
                          emptyText: hasReportFilters
                            ? "当前筛选没有匹配举报记录，可清空筛选后重试"
                            : "暂无举报记录",
                        }}
                      />
                    </Card>
                  </section>

                  <section
                    id="mail-logs"
                    className={sectionPanelClassName("mail-logs")}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          邮件记录
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          匹配 {mailLogTotal} 条，当前页 {mailSendLogs.length} 条
                        </div>
                      </div>
                      <Space wrap>
                        <Select
                          value={mailLogStatusFilter}
                          onChange={setMailLogStatusFilter}
                          style={{ width: 130 }}
                          options={[
                            { label: "全部状态", value: "ALL" },
                            { label: "发送成功", value: "SUCCESS" },
                            { label: "发送失败", value: "FAILED" },
                          ]}
                        />
                        <Input.Search
                          allowClear
                          enterButton="搜索"
                          placeholder="搜索订单号、邮箱或商品"
                          value={mailLogKeyword}
                          onChange={(event) =>
                            setMailLogKeyword(event.target.value)
                          }
                          onSearch={(value) =>
                            void loadMailSendLogs(
                              1,
                              mailLogPageSizeRef.current,
                              value,
                              mailLogStatusFilter,
                            )
                          }
                          style={{ width: 260 }}
                        />
                        <Button
                          icon={<ClearOutlined />}
                          disabled={!hasMailLogFilters}
                          onClick={() => void resetMailLogFilters()}
                        >
                          清空
                        </Button>
                        <Button
                          icon={<MailOutlined />}
                          loading={mailLogsLoading}
                          onClick={() => void refreshMailLogs()}
                        >
                          刷新邮件
                        </Button>
                      </Space>
                    </div>
                    <Card className="rounded-[28px] border-slate-100 shadow-sm">
                      <Table<MailSendLog>
                        rowKey="id"
                        loading={loading || mailLogsLoading}
                        columns={mailLogColumns}
                        dataSource={mailSendLogs}
                        pagination={{
                          current: mailLogPage,
                          pageSize: mailLogPageSize,
                          total: mailLogTotal,
                          showSizeChanger: true,
                          showTotal: (total) => `共 ${total} 条`,
                        }}
                        onChange={(pagination) => {
                          void loadMailSendLogs(
                            pagination.current ?? 1,
                            pagination.pageSize ?? mailLogPageSize,
                            mailLogKeyword,
                            mailLogStatusFilter,
                          );
                        }}
                        scroll={{ x: 960 }}
                        locale={{
                          emptyText: hasMailLogFilters
                            ? "当前筛选没有匹配邮件记录，可清空筛选后重试"
                            : "暂无邮件发送记录",
                        }}
                      />
                    </Card>
                  </section>

                  <section id="logs" className={sectionPanelClassName("logs")}>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xl font-semibold text-slate-900">
                          操作日志
                        </div>
                        <div className="mt-1 text-sm text-slate-500">
                          匹配 {logTotal} 条，当前页 {operationLogs.length} 条
                        </div>
                      </div>
                      <Space wrap>
                        <Input.Search
                          allowClear
                          enterButton="搜索"
                          placeholder="搜索操作人、动作或说明"
                          value={logKeyword}
                          onChange={(event) =>
                            setLogKeyword(event.target.value)
                          }
                          onSearch={(value) =>
                            void loadOperationLogs(
                              1,
                              logPageSizeRef.current,
                              value,
                            )
                          }
                          style={{ width: 240 }}
                        />
                        <Button
                          icon={<ClearOutlined />}
                          disabled={!hasLogFilters}
                          onClick={() => void resetLogFilters()}
                        >
                          清空
                        </Button>
                        <Button
                          icon={<AuditOutlined />}
                          loading={logsLoading}
                          onClick={() => void refreshLogs()}
                        >
                          刷新日志
                        </Button>
                      </Space>
                    </div>
                    <Card className="rounded-[28px] border-slate-100 shadow-sm">
                      <Table<AdminOperationLog>
                        rowKey="id"
                        loading={loading || logsLoading}
                        columns={logColumns}
                        dataSource={operationLogs}
                        pagination={{
                          current: logPage,
                          pageSize: logPageSize,
                          total: logTotal,
                          showSizeChanger: true,
                          showTotal: (total) => `共 ${total} 条`,
                        }}
                        onChange={(pagination) => {
                          void loadOperationLogs(
                            pagination.current ?? 1,
                            pagination.pageSize ?? logPageSize,
                            logKeyword,
                          );
                        }}
                        scroll={{ x: 960 }}
                        locale={{
                          emptyText: hasLogFilters
                            ? "当前搜索没有匹配操作日志，可清空搜索后重试"
                            : "暂无操作日志",
                        }}
                      />
                    </Card>
                  </section>
                </div>
              </div>
            </section>
          </div>
        </div>

        <Modal
          title={editingUser ? `编辑用户：${editingUser.nickname}` : "编辑用户"}
          open={Boolean(editingUser)}
          onCancel={() => setEditingUser(null)}
          footer={null}
          destroyOnClose
        >
          <Form
            form={userForm}
            layout="vertical"
            onFinish={(values) => void handleSaveUser(values)}
          >
            <Form.Item
              name="nickname"
              label="昵称"
              rules={[{ required: true, message: "请输入昵称" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="avatarUrl"
              label="头像链接"
              rules={[{ validator: validateOptionalImageUrl }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="bio" label="简介">
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select
                options={[
                  { label: "正常", value: "ACTIVE" },
                  { label: "禁用", value: "DISABLED" },
                ]}
              />
            </Form.Item>
            {isOwner ? (
              <Form.Item name="role" label="角色">
                <Select
                  options={[
                    { label: "普通用户", value: "USER" },
                    { label: "管理员", value: "ADMIN" },
                  ]}
                />
              </Form.Item>
            ) : null}
            <Form.Item name="password" label="重置密码">
              <Input.Password placeholder="留空则保持原密码" />
            </Form.Item>
            <Space>
              <Button onClick={() => setEditingUser(null)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                保存
              </Button>
            </Space>
          </Form>
        </Modal>

        <Modal
          title={
            reviewingReport
              ? `处理举报：${reviewingReport.postTitle}`
              : "处理举报"
          }
          open={Boolean(reviewingReport)}
          onCancel={() => setReviewingReport(null)}
          footer={null}
          destroyOnClose
        >
          {reviewingReport ? (
            <Alert
              className="mb-4"
              type="info"
              showIcon
              message={reviewingReport.reason}
              description={reviewingReport.detail || "举报人未填写补充说明"}
            />
          ) : null}
          <Form
            form={reviewForm}
            layout="vertical"
            onFinish={(values) => void handleReview(values)}
          >
            <Form.Item
              name="status"
              label="处理结果"
              rules={[{ required: true, message: "请选择处理结果" }]}
            >
              <Select
                options={[
                  { label: "已处理", value: "RESOLVED" },
                  { label: "已驳回", value: "REJECTED" },
                  { label: "恢复待处理", value: "PENDING" },
                ]}
              />
            </Form.Item>
            <Form.Item name="reviewNote" label="处理备注">
              <Input.TextArea rows={4} />
            </Form.Item>
            {reviewingReport &&
            (reviewingReport.targetType === "CHAT_MESSAGE" ||
              reviewingReport.targetType === "TALK_POST") &&
            reportReviewStatus === "RESOLVED" ? (
              <Form.Item
                name="deleteTarget"
                label="内容处置"
                valuePropName="checked"
                preserve={false}
              >
                <Switch checkedChildren="同时删除" unCheckedChildren="保留内容" />
              </Form.Item>
            ) : null}
            <Space>
              <Button onClick={() => setReviewingReport(null)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                保存处理结果
              </Button>
            </Space>
          </Form>
        </Modal>

        <Modal
          title={
            resolvingPaymentOrder
              ? `处理支付异常：${resolvingPaymentOrder.outTradeNo}`
              : "处理支付异常"
          }
          open={Boolean(resolvingPaymentOrder)}
          onCancel={() => {
            setResolvingPaymentOrder(null);
            paymentResolveForm.resetFields();
          }}
          footer={null}
          destroyOnClose
        >
          <Form
            form={paymentResolveForm}
            layout="vertical"
            onFinish={(values) => void handleResolvePaymentOrder(values)}
          >
            <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {resolvingPaymentOrder?.lastError || "暂无异常信息"}
            </div>
            <Form.Item name="note" label="处理备注">
              <Input.TextArea
                rows={4}
                maxLength={300}
                showCount
                placeholder="填写线下补发、退款、人工确认等处理结果"
              />
            </Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setResolvingPaymentOrder(null);
                  paymentResolveForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={
                  paymentActionLoading === resolvingPaymentOrder?.outTradeNo
                }
              >
                标记已处理
              </Button>
            </Space>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  );
}

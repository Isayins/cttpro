export interface User {
  id: number;
  username: string;
  email?: string | null;
  nickname: string;
  role: "OWNER" | "ADMIN" | "USER";
  avatarUrl?: string | null;
  bio?: string | null;
  status?: "ACTIVE" | "DISABLED";
  chatVisibility?: "ONLINE" | "INVISIBLE";
  experience?: number;
  level?: number;
  consecutiveSignInDays?: number;
  lastSignInAt?: string | null;
  title?: string | null;
  createTime?: string | null;
}

export interface AdminUserStats {
  total: number;
  owner: number;
  admin: number;
  regular: number;
  disabled: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface EmailCodeResponse {
  message: string;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  category?: string | null;
  tags?: string[];
  pinned: boolean;
  userId: number;
  author: string;
  authorAvatarUrl?: string | null;
  authorExperience?: number;
  authorLevel?: number;
  authorTitle?: string | null;
  createTime: string;
  updateTime: string;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  replyCount: number;
  likedByCurrentUser: boolean;
  favoritedByCurrentUser: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
}

export interface Reply {
  id: number;
  postId: number;
  content: string;
  userId: number;
  author: string;
  authorAvatarUrl?: string | null;
  authorExperience?: number;
  authorLevel?: number;
  authorTitle?: string | null;
  createTime: string;
}

export interface ForumSignInStatus {
  boardId?: number | null;
  boardName?: string | null;
  signedToday: boolean;
  consecutiveSignInDays: number;
  gainedExperience: number;
  experience: number;
  level: number;
  title?: string | null;
  lastSignInAt?: string | null;
}

export interface ForumLeaderboardUser {
  userId: number;
  nickname: string;
  avatarUrl?: string | null;
  level: number;
  experience: number;
  title?: string | null;
  consecutiveSignInDays: number;
  postCountToday: number;
  replyCountToday: number;
  activityScore: number;
}

export interface ForumLeaderboard {
  signInRank: ForumLeaderboardUser[];
  activityRank: ForumLeaderboardUser[];
}

export interface ForumBoard {
  id?: number | null;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  ownerUserId?: number | null;
  ownerNickname?: string | null;
  ownerAvatarUrl?: string | null;
  levelTitleConfig?: string | null;
  sortOrder?: number | null;
  active: boolean;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface SaveForumBoardPayload {
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  sortOrder?: number | null;
  active?: boolean;
}

export interface ForumBoardLevelTitle {
  level: number;
  title: string;
}

export type ForumBoardOwnerApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ForumBoardOwnerApplication {
  id: number;
  boardId: number;
  boardName?: string | null;
  boardAvatarUrl?: string | null;
  applicantId: number;
  applicantNickname?: string | null;
  applicantAvatarUrl?: string | null;
  reason: string;
  status: ForumBoardOwnerApplicationStatus;
  reviewedBy?: number | null;
  reviewNote?: string | null;
  reviewedAt?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface ForumPostFilters {
  keyword?: string;
  category?: string;
  mine?: boolean;
  favorites?: boolean;
}

export interface CreatePostPayload {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

export interface CreatePostReportPayload {
  reason: string;
  detail?: string;
}

export interface InviteCode {
  id: number;
  code: string;
  status: string;
  createdBy: number;
  usedBy?: number | null;
  usedByNickname?: string | null;
  expiresAt?: string | null;
  usedAt?: string | null;
  createTime?: string | null;
}

export interface AdminInviteStats {
  total: number;
  active: number;
  used: number;
  expired: number;
}

export interface DownloadResource {
  id: number;
  title: string;
  version?: string | null;
  changelog?: string | null;
  url: string;
  icon?: string | null;
  locked: boolean;
  passwordProtected: boolean;
  category?: string | null;
  fileSize?: string | null;
  checksumSha256?: string | null;
  downloadCount?: number | null;
  sortOrder?: number | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface AdminDownloadStats {
  total: number;
  locked: number;
  open: number;
}

export interface UploadedDownloadFile {
  fileUrl: string;
  originalFileName: string;
  storedFileName: string;
  fileSizeBytes: number;
  fileSizeText: string;
}

export interface Product {
  id: number;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  price: string;
  stock?: number | null;
  salesCount?: number | null;
  deliveryType?: "NONE" | "CDK_EMAIL" | string;
  deliveryInstructions?: string | null;
  deliveryCodeAvailableCount?: number | null;
  deliveryCodeLockedCount?: number | null;
  deliveryCodeSentCount?: number | null;
  deliveryCodeDisabledCount?: number | null;
  status: "PUBLISHED" | "DRAFT" | "OFFLINE" | string;
  sortOrder?: number | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface AdminProductStats {
  total: number;
  published: number;
  draft: number;
  offline: number;
}

export interface ProductDeliveryCode {
  id: number;
  productId: number;
  productTitle?: string | null;
  code: string;
  status: "AVAILABLE" | "LOCKED" | "SENT" | "DISABLED" | string;
  createdBy?: number | null;
  assignedTo?: number | null;
  assignedToName?: string | null;
  orderNo?: string | null;
  assignedAt?: string | null;
  sentAt?: string | null;
  batchNo?: string | null;
  note?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface AdminProductDeliveryCodeStats {
  total: number;
  available: number;
  locked: number;
  sent: number;
  disabled: number;
}

export interface ImportProductDeliveryCodesPayload {
  productId: number;
  content: string;
  note?: string;
}

export interface ImportProductDeliveryCodesResponse {
  batchNo?: string | null;
  importedCount: number;
  skippedCount: number;
  records: ProductDeliveryCode[];
}

export interface ProductCouponCode {
  id: number;
  code: string;
  productId: number;
  productTitle?: string | null;
  discountType: "AMOUNT" | "PERCENT" | string;
  discountValue: string;
  status: "ACTIVE" | "LOCKED" | "USED" | "DISABLED" | "EXPIRED" | string;
  createdBy?: number | null;
  usedBy?: number | null;
  usedByName?: string | null;
  usedOrderNo?: string | null;
  usedAt?: string | null;
  lockedBy?: number | null;
  lockOrderNo?: string | null;
  lockedAt?: string | null;
  expiresAt?: string | null;
  batchNo?: string | null;
  note?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface AdminProductCouponStats {
  total: number;
  active: number;
  locked: number;
  used: number;
  disabled: number;
  expired: number;
}

export interface CreateProductCouponCodesPayload {
  productId: number;
  count: number;
  discountType: "AMOUNT" | "PERCENT";
  discountValue: string | number;
  expiresInDays?: number | null;
  prefix?: string;
  note?: string;
}

export interface ProductCouponPreview {
  code: string;
  productId: number;
  productTitle?: string | null;
  discountType: "AMOUNT" | "PERCENT" | string;
  discountValue: string;
  originalAmount: string;
  discountAmount: string;
  payableAmount: string;
  expiresAt?: string | null;
}

export interface SaveProductPayload {
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  price: string | number;
  stock: number;
  deliveryType?: "NONE" | "CDK_EMAIL";
  deliveryInstructions?: string;
  status?: "PUBLISHED" | "DRAFT" | "OFFLINE";
  sortOrder?: number;
}

export interface UploadedProductImage {
  url: string;
  originalFileName?: string;
}

export interface AdminPaymentOrder {
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
  payerUserId?: number | null;
  deliveryEmail?: string | null;
  payerName?: string | null;
  payerUsername?: string | null;
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

export interface AdminPaymentOrderStats {
  total: number;
  created: number;
  waiting: number;
  paid: number;
  closed: number;
  failed: number;
  errors: number;
  openSupport: number;
}

export interface AdminSystemHealthItem {
  key: string;
  title: string;
  status: "OK" | "WARNING" | "ERROR" | string;
  summary: string;
  detail?: string | null;
  actionLabel?: string | null;
  targetSection?: string | null;
}

export interface AdminSystemHealth {
  status: "OK" | "WARNING" | "ERROR" | string;
  score: number;
  checkedAt?: string | null;
  items: AdminSystemHealthItem[];
}

export interface VmqPaymentSettings {
  id: number;
  enabled: boolean;
  preferred: boolean;
  payType: 1 | 2 | number;
  payTypeLabel?: string | null;
  communicationKey: string;
  wxPayUrl?: string | null;
  alipayPayUrl?: string | null;
  amountStrategy: "INCREASE" | "DECREASE" | string;
  orderTimeoutMinutes: number;
  monitorState: "UNBOUND" | "ONLINE" | "OFFLINE" | string;
  lastHeartTime?: string | null;
  lastPayTime?: string | null;
  monitorBaseUrl?: string | null;
  getStateUrl?: string | null;
  appHeartUrl?: string | null;
  appPushUrl?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface SaveVmqPaymentSettingsPayload {
  enabled: boolean;
  preferred: boolean;
  payType: 1 | 2 | number;
  communicationKey?: string;
  wxPayUrl?: string;
  alipayPayUrl?: string;
  amountStrategy: "INCREASE" | "DECREASE" | string;
  orderTimeoutMinutes: number;
}

export interface SiteNotice {
  id: number;
  title: string;
  content: string;
  published: boolean;
  sortOrder?: number | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface AdminSiteNoticeStats {
  total: number;
  published: number;
  draft: number;
}

export interface TrackVisitPayload {
  path: string;
  pageTitle?: string;
  visitorId: string;
  sessionId: string;
  referrer?: string;
  source?: string;
  userAgent?: string;
  deviceType?: string;
}

export interface AnalyticsPageVisitStat {
  path: string;
  title: string;
  visitCount: number;
}

export interface AnalyticsDailyVisitStat {
  date: string;
  visitCount: number;
  uniqueVisitors: number;
}

export interface AnalyticsRecentVisit {
  path: string;
  title: string;
  visitorId?: string | null;
  nickname?: string | null;
  deviceType?: string | null;
  source?: string | null;
  createTime?: string | null;
}

export interface SiteAnalyticsOverview {
  totalVisits: number;
  uniqueVisitors: number;
  todayVisits: number;
  authenticatedVisits: number;
  topPages: AnalyticsPageVisitStat[];
  dailyVisits: AnalyticsDailyVisitStat[];
  recentVisits: AnalyticsRecentVisit[];
}

export interface LoginRecord {
  id: number;
  loginIdentity?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceType?: string | null;
  loginStatus?: "SUCCESS" | "FAILED" | string;
  createTime?: string | null;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  nickname: string;
  inviteCode: string;
  emailCode: string;
}

export interface ResetPasswordPayload {
  email: string;
  emailCode: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfilePayload {
  nickname: string;
  avatarUrl: string;
  bio: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangeEmailPayload {
  currentPassword: string;
  newEmail: string;
  emailCode: string;
}

export interface AdminUpdateUserPayload {
  nickname?: string;
  avatarUrl?: string;
  bio?: string;
  role?: "OWNER" | "ADMIN" | "USER";
  status?: "ACTIVE" | "DISABLED";
  password?: string;
}

export interface CreateDownloadResourcePayload {
  title: string;
  version?: string;
  changelog?: string;
  url: string;
  icon?: string;
  locked?: boolean;
  passwordProtected?: boolean;
  downloadPassword?: string;
  category?: string;
  fileSize?: string;
  checksumSha256?: string;
  sortOrder?: number;
}

export interface SaveSiteNoticePayload {
  title: string;
  content: string;
  published?: boolean;
  sortOrder?: number;
}

export interface AdminPostReport {
  id: number;
  postId?: number | null;
  targetType?: "FORUM_POST" | "CHAT_MESSAGE" | "TALK_POST" | string;
  targetId?: number | null;
  postTitle: string;
  reporterId: number;
  reporterName: string;
  reason: string;
  detail?: string | null;
  status: "PENDING" | "RESOLVED" | "REJECTED" | string;
  reviewNote?: string | null;
  reviewedBy?: number | null;
  reviewedByName?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
  reviewedAt?: string | null;
}

export interface AdminPostReportStats {
  total: number;
  pending: number;
  resolved: number;
  rejected: number;
}

export interface ReviewPostReportPayload {
  status: "PENDING" | "RESOLVED" | "REJECTED";
  reviewNote?: string;
}

export interface AdminOperationLog {
  id: number;
  operatorId: number;
  operatorName: string;
  operatorRole: "OWNER" | "ADMIN" | string;
  actionType: string;
  targetType: string;
  targetId?: number | null;
  targetName?: string | null;
  detail?: string | null;
  createTime?: string | null;
}

export interface MailSendLog {
  id: number;
  mailType: string;
  triggerType: string;
  orderNo?: string | null;
  productId?: number | null;
  productTitle?: string | null;
  deliveryCodeId?: number | null;
  recipientEmail: string;
  subject?: string | null;
  status: "SUCCESS" | "FAILED" | string;
  errorMessage?: string | null;
  createTime?: string | null;
}

export interface PageResult<T> {
  records: T[];
  total: number;
  page: number;
  size: number;
}

export interface QrCodeItem {
  id: number;
  title: string;
  description?: string | null;
  shortCode: string;
  targetUrl: string;
  status: "ACTIVE" | "DISABLED" | string;
  loginRequired: boolean;
  accessCodeRequired: boolean;
  accessCodeConfigured: boolean;
  accessCodeHint?: string | null;
  expiresAt?: string | null;
  createdBy?: number | null;
  scanCount?: number | null;
  todayScanCount?: number | null;
  lastScanTime?: string | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface SaveQrCodePayload {
  title: string;
  description?: string;
  shortCode?: string;
  targetUrl: string;
  status?: "ACTIVE" | "DISABLED";
  loginRequired?: boolean;
  accessCodeRequired?: boolean;
  accessCode?: string;
  expiresAt?: string;
}

export interface QrScanLog {
  id: number;
  qrCodeId: number;
  userId?: number | null;
  nickname?: string | null;
  visitorId?: string | null;
  source?: string | null;
  deviceType?: string | null;
  ipAddress?: string | null;
  createTime?: string | null;
}

export interface QrCodePublicInfo {
  id: number;
  title: string;
  description?: string | null;
  shortCode: string;
  loginRequired: boolean;
  accessCodeRequired: boolean;
  available: boolean;
  unavailableReason?: string | null;
  expiresAt?: string | null;
}

export interface QrCodeAccessPayload {
  accessCode?: string;
  visitorId?: string;
  sessionId?: string;
  source?: string;
  userAgent?: string;
  deviceType?: string;
}

export interface QrCodeAccessResponse {
  targetUrl: string;
  message: string;
}

export interface UserNotification {
  id: number;
  type: string;
  title: string;
  content: string;
  relatedPath?: string | null;
  read: boolean;
  createTime?: string | null;
}

export interface JavaDecompilePayload {
  fileName?: string;
  base64Content: string;
}

export interface JavaDecompileResult {
  fileName: string;
  output: string;
  engine: string;
}

export interface ToolDiagnosticsResult {
  requestId: string;
  userId: number;
  serverTimeMillis: number;
  serverTimeIso: string;
  serverZone: string;
  javaVersion?: string | null;
  remoteAddr?: string | null;
  forwardedFor?: string | null;
  method?: string | null;
  path?: string | null;
  userAgent?: string | null;
}

export interface PrivateChatUser {
  id: number;
  nickname: string;
  avatarUrl?: string | null;
  bio?: string | null;
  online: boolean;
  blocked: boolean;
}

export interface PrivateChatMessage {
  id: number;
  senderId: number;
  senderNickname: string;
  senderAvatarUrl?: string | null;
  recipientId: number;
  content: string;
  createdAt: number;
}

export type ChatPresenceMode = "ONLINE" | "INVISIBLE";

export interface HotmailAccount {
  id: number;
  email: string;
  groupName?: string | null;
  subEmails?: string | null;
  gptRegistered: boolean;
  gptRegisteredSubEmails?: string | null;
  grokRegistered: boolean;
  grokRegisteredSubEmails?: string | null;
  passwordSaved: boolean;
  lastCode?: string | null;
  lastCodeTime?: string | null;
  lastSubject?: string | null;
  lastSender?: string | null;
  lastSource?: string | null;
  lastFolder?: string | null;
  lastError?: string | null;
  lastFetchTime?: string | null;
  tokenCheckStatus?: "UNKNOWN" | "OK" | "MISSING_IMAP" | "TOKEN_INVALID" | "PARTIAL_FAIL" | string;
  graphTokenOk?: boolean | null;
  outlookTokenOk?: boolean | null;
  imapTokenOk?: boolean | null;
  tokenCheckSummary?: string | null;
  tokenCheckedAt?: string | null;
  publicCodeToken?: string | null;
  publicCodeUid?: string | null;
  publicCodeTargetEmail?: string | null;
  publicCodeEnabled: boolean;
  publicCodeCreatedAt?: string | null;
  publicCodeLastAccessTime?: string | null;
  createTime?: string | null;
}

export interface HotmailCodeResult {
  accountId: number;
  email: string;
  code?: string | null;
  subject?: string | null;
  sender?: string | null;
  receivedTime?: string | null;
  fetchTime?: string | null;
  source?: string | null;
  folder?: string | null;
  error?: string | null;
  found: boolean;
}

export interface HotmailPasswordResult {
  accountId: number;
  email: string;
  password: string;
}

export interface UpdateHotmailAccountMetadataPayload {
  groupName?: string | null;
  subEmails?: string | null;
  gptRegistered?: boolean;
  gptRegisteredSubEmails?: string | null;
  grokRegistered?: boolean;
  grokRegisteredSubEmails?: string | null;
}

export interface HotmailImportFailure {
  line: number;
  email?: string | null;
  reason: string;
}

export interface ImportHotmailResponse {
  message: string;
  imported: number;
  skipped: number;
  duplicateCount: number;
  batchDuplicateCount: number;
  existingDuplicateCount: number;
  failures: HotmailImportFailure[];
}

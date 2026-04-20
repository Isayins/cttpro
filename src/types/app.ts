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
  createTime?: string | null;
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
  createTime: string;
  updateTime: string;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  likedByCurrentUser: boolean;
  favoritedByCurrentUser: boolean;
  canEdit: boolean;
}

export interface Reply {
  id: number;
  postId: number;
  content: string;
  userId: number;
  author: string;
  authorAvatarUrl?: string | null;
  createTime: string;
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

export interface DownloadResource {
  id: number;
  title: string;
  version?: string | null;
  changelog?: string | null;
  url: string;
  icon?: string | null;
  locked: boolean;
  category?: string | null;
  fileSize?: string | null;
  checksumSha256?: string | null;
  downloadCount?: number | null;
  sortOrder?: number | null;
  createTime?: string | null;
  updateTime?: string | null;
}

export interface UploadedDownloadFile {
  fileUrl: string;
  originalFileName: string;
  storedFileName: string;
  fileSizeBytes: number;
  fileSizeText: string;
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
  postId: number;
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

export interface PrivateChatUser {
  id: number;
  nickname: string;
  avatarUrl?: string | null;
  bio?: string | null;
  online: boolean;
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

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Alert, Button, Card, Input, Spin, Tag, message } from "antd";
import { HomeOutlined, LoginOutlined, ReloadOutlined } from "@ant-design/icons";

import { useAuth } from "../context/useAuth";
import MainLayout from "../layouts/MainLayout";
import { getFriendlyMessage } from "../lib/errorMessage";
import { qrCodeApi } from "../services/api/qrCode";
import logo from "../assets/idncar-mark.svg";
import type { QrCodePublicInfo } from "../types/app";

const VISITOR_ID_KEY = "idncar_visitor_id";
const SESSION_ID_KEY = "idncar_session_id";

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateStorageId(key: string, prefix: string, storage: Storage | null) {
  if (!storage) {
    return createId(prefix);
  }

  let existing: string | null = null;
  try {
    existing = storage.getItem(key);
  } catch {
    existing = null;
  }
  if (existing) {
    return existing;
  }

  const created = createId(prefix);
  try {
    storage.setItem(key, created);
  } catch {
    // Browser storage can be unavailable in private or restricted contexts.
  }
  return created;
}

function getBrowserStorage(type: "local" | "session") {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return type === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function resolveDeviceType(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet")) return "TABLET";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "MOBILE";
  return "DESKTOP";
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function QrAccess() {
  const { shortCode } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const [info, setInfo] = useState<QrCodePublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [accessCode, setAccessCode] = useState("");

  const visitorId = useMemo(() => getOrCreateStorageId(VISITOR_ID_KEY, "visitor", getBrowserStorage("local")), []);
  const sessionId = useMemo(() => getOrCreateStorageId(SESSION_ID_KEY, "session", getBrowserStorage("session")), []);
  const returnPath = `${location.pathname}${location.search}${location.hash}`;
  const accessCodeValue = accessCode.trim();
  const canSubmitAccessCode = Boolean(shortCode && info?.available && accessCodeValue && !redirecting);

  const loadInfo = useCallback(async (code: string) => {
    setLoading(true);
    setLoadError(null);
    setInfo(null);
    setAccessCode("");
    try {
      setInfo(await qrCodeApi.getPublicInfo(code));
    } catch (error) {
      const errorMessage = getFriendlyMessage(error, "二维码信息加载失败");
      setLoadError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAccess = useCallback(async (code: string) => {
    if (!info?.available) {
      message.warning(info?.unavailableReason || "该二维码当前不可用");
      return;
    }
    if (info?.loginRequired && !isAuthenticated) {
      message.info("请先登录后再访问这个二维码");
      return;
    }
    if (info?.accessCodeRequired && !accessCodeValue) {
      message.warning("请输入访问验证码");
      return;
    }

    setRedirecting(true);
    try {
      const userAgent = navigator.userAgent;
      const result = await qrCodeApi.access(code, {
        accessCode: accessCodeValue || undefined,
        visitorId,
        sessionId,
        source: document.referrer || "direct",
        userAgent,
        deviceType: resolveDeviceType(userAgent),
      });
      window.location.assign(result.targetUrl);
    } catch (error) {
      message.error(getFriendlyMessage(error, "二维码访问失败"));
      setRedirecting(false);
    }
  }, [accessCodeValue, info?.accessCodeRequired, info?.available, info?.loginRequired, info?.unavailableReason, isAuthenticated, sessionId, visitorId]);

  useEffect(() => {
    if (!shortCode) {
      setLoading(false);
      setLoadError("短码缺失，请确认二维码链接是否完整。");
      return;
    }
    void loadInfo(shortCode);
  }, [loadInfo, shortCode]);

  useEffect(() => {
    if (!info || !shortCode || !info.available) return;
    if (info.accessCodeRequired) return;
    if (info.loginRequired && !isAuthenticated) return;
    void handleAccess(shortCode);
  }, [handleAccess, info, isAuthenticated, shortCode]);

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl py-8 md:py-10">
        <Card className="overflow-hidden rounded-lg border-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="rounded-lg bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-5 md:p-8">
            {loading ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <Spin size="large" />
                <div className="mt-5 text-lg font-semibold text-slate-900">正在打开二维码</div>
                <div className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  正在确认短链状态{shortCode ? `：${shortCode}` : ""}，请稍候。
                </div>
              </div>
            ) : loadError ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <img src={logo} alt="IDNCAR" className="h-14 w-14 rounded-lg border border-white/80 bg-white/80 p-2 shadow-sm" />
                  <div>
                    <div className="text-sm uppercase tracking-[0.18em] text-slate-400">IDNCAR 二维码</div>
                    <h1 className="mt-1 text-2xl font-semibold text-slate-900">二维码暂时无法打开</h1>
                    <p className="mt-2 text-sm leading-7 text-slate-500">请检查链接是否完整，或稍后重新尝试。</p>
                  </div>
                </div>

                <Alert type="warning" showIcon message={loadError} description={shortCode ? `短码：${shortCode}` : "当前链接没有携带短码。"} />

                <div className="flex flex-wrap gap-3">
                  {shortCode ? (
                    <Button type="primary" icon={<ReloadOutlined />} onClick={() => void loadInfo(shortCode)}>
                      重新加载
                    </Button>
                  ) : null}
                  <Link to="/">
                    <Button icon={<HomeOutlined />}>返回首页</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <img src={logo} alt="IDNCAR" className="h-16 w-16 rounded-lg border border-white/80 bg-white/80 p-2 shadow-sm" />
                  <div>
                    <div className="text-sm uppercase tracking-[0.18em] text-slate-400">IDNCAR 二维码</div>
                    <h1 className="mt-1 text-3xl font-semibold text-slate-900">{info?.title || "动态二维码"}</h1>
                    <p className="mt-2 text-sm leading-7 text-slate-500">{info?.description || "通过 IDNCAR 动态短链访问目标内容。"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Tag color="blue">短码：{info?.shortCode || shortCode}</Tag>
                  {info?.loginRequired ? <Tag color="gold">需要登录</Tag> : <Tag color="green">无需登录</Tag>}
                  {info?.accessCodeRequired ? <Tag color="orange">需要访问验证码</Tag> : <Tag color="green">无需验证码</Tag>}
                  {info?.expiresAt ? <Tag>到期：{formatDateTime(info.expiresAt)}</Tag> : <Tag>长期有效</Tag>}
                </div>

                {!info?.available ? (
                  <Alert type="warning" showIcon message={info?.unavailableReason || "该二维码当前不可用"} />
                ) : null}

                {info?.available && info.loginRequired && !isAuthenticated ? (
                  <Alert type="info" showIcon message="该二维码需要登录后访问" description="登录后再次打开此链接即可完成跳转。" />
                ) : null}

                {info?.available && info.accessCodeRequired && (!info.loginRequired || isAuthenticated) ? (
                  <div className="space-y-4 rounded-lg border border-slate-100 bg-white/80 p-5">
                    <div className="text-sm font-medium text-slate-900">请输入访问验证码</div>
                    <Input
                      value={accessCode}
                      onChange={(event) => setAccessCode(event.target.value)}
                      maxLength={20}
                      allowClear
                      placeholder="请输入管理员设置的访问验证码"
                      onPressEnter={() => shortCode && void handleAccess(shortCode)}
                    />
                    <Button type="primary" loading={redirecting} disabled={!canSubmitAccessCode} onClick={() => shortCode && void handleAccess(shortCode)}>
                      验证并跳转
                    </Button>
                  </div>
                ) : null}

                {info?.available && info.loginRequired && !isAuthenticated ? (
                  <Link to="/login" state={{ from: returnPath }}>
                    <Button type="primary" icon={<LoginOutlined />}>
                      前往登录
                    </Button>
                  </Link>
                ) : null}

                {redirecting && !info?.accessCodeRequired ? <Alert type="success" showIcon message="正在跳转，请稍候..." /> : null}
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}

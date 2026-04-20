import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, Card, Input, Spin, Tag, message } from "antd";

import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../context/useAuth";
import { qrCodeApi } from "../services/api";
import logo from "../store/images/idncar.png";
import type { QrCodePublicInfo } from "../types/app";

const VISITOR_ID_KEY = "idncar_visitor_id";
const SESSION_ID_KEY = "idncar_session_id";

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreateStorageId(key: string, prefix: string, storage: Storage) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const created = createId(prefix);
  storage.setItem(key, created);
  return created;
}

function resolveDeviceType(userAgent: string) {
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || ua.includes("tablet")) return "TABLET";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) return "MOBILE";
  return "DESKTOP";
}

function getFriendlyMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;
  return /[\u4e00-\u9fa5]/.test(error.message) ? error.message : fallback;
}

export default function QrAccess() {
  const { shortCode } = useParams();
  const { isAuthenticated } = useAuth();
  const [info, setInfo] = useState<QrCodePublicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [accessCode, setAccessCode] = useState("");

  const visitorId = useMemo(() => getOrCreateStorageId(VISITOR_ID_KEY, "visitor", localStorage), []);
  const sessionId = useMemo(() => getOrCreateStorageId(SESSION_ID_KEY, "session", sessionStorage), []);

  const loadInfo = useCallback(async (code: string) => {
    setLoading(true);
    try {
      setInfo(await qrCodeApi.getPublicInfo(code));
    } catch (error) {
      message.error(getFriendlyMessage(error, "二维码信息加载失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAccess = useCallback(async (code: string) => {
    setRedirecting(true);
    try {
      const userAgent = navigator.userAgent;
      const result = await qrCodeApi.access(code, {
        accessCode: accessCode.trim() || undefined,
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
  }, [accessCode, sessionId, visitorId]);

  useEffect(() => {
    if (!shortCode) return;
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
      <div className="mx-auto max-w-3xl py-10">
        <Card className="overflow-hidden rounded-[32px] border-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="rounded-[28px] bg-[radial-gradient(circle_at_18%_20%,rgba(255,221,174,0.28),transparent_22%),radial-gradient(circle_at_82%_18%,rgba(191,220,255,0.28),transparent_20%),linear-gradient(180deg,#fffef9_0%,#f6f8fc_100%)] p-8">
            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <Spin size="large" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <img src={logo} alt="IDNCAR" className="h-16 w-16 rounded-3xl border border-white/80 bg-white/80 p-2 shadow-sm" />
                  <div>
                    <div className="text-sm uppercase tracking-[0.24em] text-slate-400">IDNCAR QR</div>
                    <h1 className="mt-1 text-3xl font-semibold text-slate-900">{info?.title || "动态二维码"}</h1>
                    <p className="mt-2 text-sm leading-7 text-slate-500">{info?.description || "通过 IDNCAR 动态短链访问目标内容。"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Tag color="blue">短码：{info?.shortCode || shortCode}</Tag>
                  {info?.loginRequired ? <Tag color="gold">需要登录</Tag> : <Tag color="green">无需登录</Tag>}
                  {info?.accessCodeRequired ? <Tag color="orange">需要访问验证码</Tag> : <Tag color="green">无需验证码</Tag>}
                  {info?.expiresAt ? <Tag>到期：{info.expiresAt}</Tag> : <Tag>长期有效</Tag>}
                </div>

                {!info?.available ? (
                  <Alert type="warning" showIcon message={info?.unavailableReason || "该二维码当前不可用"} />
                ) : null}

                {info?.available && info.loginRequired && !isAuthenticated ? (
                  <Alert type="info" showIcon message="该二维码需要登录后访问" description="登录后再次打开此链接即可完成跳转。" />
                ) : null}

                {info?.available && info.accessCodeRequired ? (
                  <div className="space-y-4 rounded-[24px] border border-slate-100 bg-white/80 p-5">
                    <div className="text-sm font-medium text-slate-900">请输入访问验证码</div>
                    <Input
                      value={accessCode}
                      onChange={(event) => setAccessCode(event.target.value)}
                      placeholder="请输入管理员设置的访问验证码"
                      onPressEnter={() => shortCode && void handleAccess(shortCode)}
                    />
                    <Button type="primary" loading={redirecting} onClick={() => shortCode && void handleAccess(shortCode)}>
                      验证并跳转
                    </Button>
                  </div>
                ) : null}

                {info?.available && info.loginRequired && !isAuthenticated ? (
                  <Link to="/login">
                    <Button type="primary">前往登录</Button>
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

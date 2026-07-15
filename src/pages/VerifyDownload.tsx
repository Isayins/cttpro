import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Card, Image, Input, Space, Spin, Tag, message } from "antd";
import { DownloadOutlined, FileTextOutlined, ReloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";

import { getFriendlyMessage } from "../lib/errorMessage";
import MainLayout from "../layouts/MainLayout";
import { buildProtectedDownloadUrl, getCaptcha, verifyCaptcha } from "../services/downloadService";

const CAPTCHA_INPUT_MAX_LENGTH = 4;

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getDisplayFileName(resource: string, fileName: string) {
  const normalizedFileName = fileName.trim();
  if (normalizedFileName) {
    return normalizedFileName;
  }

  try {
    const origin = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const url = new URL(resource, origin);
    const pathName = url.pathname.split("/").filter(Boolean).at(-1);
    if (pathName) {
      return safeDecodeURIComponent(pathName);
    }
  } catch {
    const pathName = resource.split("?")[0]?.split("/").filter(Boolean).at(-1);
    if (pathName) {
      return safeDecodeURIComponent(pathName);
    }
  }

  return "待下载资源";
}

function normalizeCaptchaInput(value: string) {
  return value.replace(/\D/g, "").slice(0, CAPTCHA_INPUT_MAX_LENGTH);
}

export default function VerifyDownload() {
  const [params] = useSearchParams();
  const resource = params.get("resource") || "";
  const fileName = params.get("fileName") || "";
  const captchaRequired = params.get("captcha") !== "0";
  const passwordRequired = params.get("password") === "1";
  const [captchaImg, setCaptchaImg] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [input, setInput] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(captchaRequired);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const displayFileName = getDisplayFileName(resource, fileName);
  const normalizedInput = input.trim();
  const canSubmit =
    !loading &&
    !submitting &&
    (!captchaRequired || (Boolean(captchaId) && normalizedInput.length === CAPTCHA_INPUT_MAX_LENGTH)) &&
    (!passwordRequired || Boolean(password.trim()));

  const refreshCaptcha = async (options?: { preserveError?: boolean }) => {
    setLoading(true);
    if (!options?.preserveError) {
      setError(null);
    }
    setInput("");
    try {
      const response = await getCaptcha();
      setCaptchaId(response.captchaId);
      setCaptchaImg(response.image);
    } catch {
      setCaptchaId("");
      setCaptchaImg("");
      setError("验证码加载失败，请稍后重试");
      message.error("加载验证码失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (captchaRequired) {
      void refreshCaptcha();
    } else {
      setLoading(false);
    }
  }, [captchaRequired]);

  const handleSubmit = async () => {
    if (captchaRequired && !captchaId) {
      message.warning("验证码尚未加载完成，请先刷新");
      void refreshCaptcha();
      return;
    }

    if (captchaRequired && normalizedInput.length < CAPTCHA_INPUT_MAX_LENGTH) {
      message.warning(`请输入 ${CAPTCHA_INPUT_MAX_LENGTH} 位验证码`);
      return;
    }

    setSubmitting(true);
    try {
      if (passwordRequired && !password.trim()) {
        message.warning("请输入下载密码");
        return;
      }
      const response = await verifyCaptcha(
        captchaId,
        normalizedInput,
        resource,
        fileName,
        password,
      );
      if (!response.downloadToken) {
        throw new Error(response.message || "验证码校验失败");
      }
      message.success("验证通过，开始下载");
      window.location.href = buildProtectedDownloadUrl(response.downloadToken);
    } catch (submitError) {
      const errorMessage = getFriendlyMessage(submitError, "验证码错误，请重试");
      message.error(errorMessage);
      setError(errorMessage);
      setInput("");
      if (captchaRequired) {
        await refreshCaptcha({ preserveError: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!resource) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-xl py-10">
          <Alert showIcon type="warning" message="缺少资源参数" description="请从下载中心重新打开下载链接。" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-xl py-8 md:py-10">
        <Card className="rounded-lg border-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-blue-50 text-xl text-blue-600">
              <SafetyCertificateOutlined />
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">
              {captchaRequired && passwordRequired
                ? "下载前请输入验证码和密码"
                : passwordRequired
                  ? "下载前请输入密码"
                  : "下载前请输入验证码"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              验证通过后会自动开始下载
              {captchaRequired ? "，验证码 5 分钟内有效" : ""}。
            </p>
          </div>

          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <FileTextOutlined />
              下载文件
            </div>
            <div className="mt-2 break-all text-base font-semibold text-slate-900">{displayFileName}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {captchaRequired ? <Tag color="blue">4 位数字验证码</Tag> : null}
              {captchaRequired ? (
                <Tag color={captchaId ? "green" : "default"}>{captchaId ? "验证码已加载" : "等待验证码"}</Tag>
              ) : null}
              {passwordRequired ? <Tag color="purple">独立下载密码</Tag> : null}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {error ? <Alert showIcon type="warning" message={error} /> : null}
            {captchaRequired ? <button
              type="button"
              className="flex h-28 w-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 transition hover:border-blue-200 disabled:cursor-not-allowed disabled:opacity-70"
              title="刷新验证码"
              disabled={submitting || loading}
              onClick={() => void refreshCaptcha()}
            >
              {loading ? (
                <Spin />
              ) : captchaImg ? (
                <Image
                  src={captchaImg}
                  alt="验证码"
                  preview={false}
                  style={{ width: "100%", height: 88, objectFit: "contain", borderRadius: 12 }}
                />
              ) : (
                <span className="text-sm text-slate-400">暂无验证码</span>
              )}
            </button> : null}

            {captchaRequired ? <Input
              size="large"
              placeholder="输入验证码"
              value={input}
              maxLength={CAPTCHA_INPUT_MAX_LENGTH}
              showCount
              allowClear
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              onChange={(event) => setInput(normalizeCaptchaInput(event.target.value))}
              onPressEnter={() => void handleSubmit()}
            /> : null}
            {passwordRequired ? (
              <Input.Password
                size="large"
                placeholder="输入该资源的下载密码"
                value={password}
                maxLength={64}
                autoComplete="off"
                autoFocus={!captchaRequired}
                onChange={(event) => setPassword(event.target.value)}
                onPressEnter={() => void handleSubmit()}
              />
            ) : null}
            <Space direction="vertical" className="w-full">
              <Button
                block
                type="primary"
                icon={<DownloadOutlined />}
                loading={submitting}
                disabled={!canSubmit}
                onClick={() => void handleSubmit()}
              >
                确认下载
              </Button>
              {captchaRequired ? (
                <Button block icon={<ReloadOutlined />} disabled={submitting || loading} onClick={() => void refreshCaptcha()}>
                  刷新验证码
                </Button>
              ) : null}
            </Space>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}

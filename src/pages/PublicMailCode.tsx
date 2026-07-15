import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Input, Space, Spin, Switch, Tag, message } from "antd";
import { CheckCircleOutlined, CopyOutlined, HomeOutlined, MailOutlined, ReloadOutlined } from "@ant-design/icons";
import { Link, useSearchParams } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";
import { getErrorMessage } from "../lib/errorMessage";
import { apiRequest } from "../services/api/client";
import {
  MAIL_CODE_PUBLIC_TOKEN_PATTERN,
  MAIL_CODE_PUBLIC_UID_PATTERN,
} from "../services/api/tools";

interface PublicMailCodeData {
  email?: string | null;
  code?: string | null;
  receivedTime?: string | null;
  fetchTime?: string | null;
}

interface PublicMailCodeFetchResponse {
  code: number;
  message: string;
  data?: PublicMailCodeData | null;
}

const WAITING_CODE = 601;
const PUBLIC_MAIL_CODE_FETCH_TIMEOUT_MS = 90_000;
const AUTO_FETCH_INTERVAL_SECONDS = 20;
const AUTO_FETCH_MAX_ATTEMPTS = 6;

function getFriendlyApiMessage(value?: string | null) {
  if (!value) {
    return "取码失败";
  }

  const messageMap: Record<string, string> = {
    "Verification code fetched": "验证码已获取",
    "Waiting for verification code": "暂未发现验证码",
    "Mail code link not found": "取码链接不存在或已关闭",
    "Missing token or uid": "取码链接参数缺失",
    "Internal server error": "服务暂时异常，请稍后重试",
  };

  return messageMap[value] || value;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
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
    second: "2-digit",
  });
}

function getFriendlyStatusText(response: PublicMailCodeFetchResponse | null) {
  if (!response) {
    return "点击按钮后开始获取邮箱验证码";
  }
  if (response.code === 200 && response.data?.code) {
    return "验证码已获取";
  }
  if (response.code === WAITING_CODE) {
    return "暂未发现验证码";
  }
  return getFriendlyApiMessage(response.message);
}

export default function PublicMailCode() {
  const [params] = useSearchParams();
  const token = (params.get("token") ?? "").trim();
  const uid = (params.get("uid") ?? "").trim();
  const [fetching, setFetching] = useState(false);
  const [response, setResponse] = useState<PublicMailCodeFetchResponse | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoAttemptCount, setAutoAttemptCount] = useState(0);
  const [nextRetryIn, setNextRetryIn] = useState(0);
  const initialFetchKeyRef = useRef("");

  const linkValid = MAIL_CODE_PUBLIC_TOKEN_PATTERN.test(token) && MAIL_CODE_PUBLIC_UID_PATTERN.test(uid);
  const code = response?.data?.code?.trim() ?? "";
  const statusText = getFriendlyStatusText(response);
  const displayStatusText = !response && fetching ? "正在自动获取验证码" : statusText;
  const canFetch = linkValid && !fetching;
  const initialFetchKey = linkValid ? `${token}:${uid}` : "";
  const retryLimitReached = response?.code === WAITING_CODE && autoRefreshEnabled && autoAttemptCount >= AUTO_FETCH_MAX_ATTEMPTS;
  const alertType = useMemo(() => {
    if (!response) return "info";
    if (response.code === 200 && code) return "success";
    if (response.code === WAITING_CODE) return "warning";
    return "error";
  }, [code, response]);

  const fetchCode = useCallback(async (quiet = false) => {
    if (!linkValid) {
      message.error("取码链接参数不完整或格式不正确");
      return;
    }

    if (!quiet) {
      setAutoAttemptCount(0);
      setNextRetryIn(0);
    }
    setFetching(true);
    try {
      const result = await apiRequest<PublicMailCodeFetchResponse>(
        `/api/code/fetch?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}`,
        {
          cache: "no-store",
          timeoutMs: PUBLIC_MAIL_CODE_FETCH_TIMEOUT_MS,
        },
      );
      setResponse(result);
      if (result.code === 200 && result.data?.code) {
        message.success("验证码已获取");
      } else if (result.code === WAITING_CODE) {
        if (!quiet) {
          message.warning(autoRefreshEnabled ? "暂未发现验证码，页面会自动重试" : "暂未发现验证码，可以稍后刷新");
        }
      } else {
        message.error(getFriendlyApiMessage(result.message));
      }
    } catch (error) {
      const errorMessage = getFriendlyApiMessage(getErrorMessage(error, "取码失败"));
      setResponse({ code: 500, message: errorMessage, data: null });
      message.error(errorMessage);
    } finally {
      setFetching(false);
    }
  }, [autoRefreshEnabled, linkValid, token, uid]);

  useEffect(() => {
    if (!initialFetchKey || initialFetchKeyRef.current === initialFetchKey) {
      return;
    }

    initialFetchKeyRef.current = initialFetchKey;
    void fetchCode(true);
  }, [fetchCode, initialFetchKey]);

  useEffect(() => {
    if (!autoRefreshEnabled || !linkValid || fetching || code || response?.code !== WAITING_CODE) {
      setNextRetryIn(0);
      return;
    }
    if (autoAttemptCount >= AUTO_FETCH_MAX_ATTEMPTS) {
      setNextRetryIn(0);
      return;
    }

    setNextRetryIn(AUTO_FETCH_INTERVAL_SECONDS);
    const countdownId = window.setInterval(() => {
      setNextRetryIn((current) => Math.max(0, current - 1));
    }, 1000);
    const retryId = window.setTimeout(() => {
      setAutoAttemptCount((current) => current + 1);
      void fetchCode(true);
    }, AUTO_FETCH_INTERVAL_SECONDS * 1000);

    return () => {
      window.clearInterval(countdownId);
      window.clearTimeout(retryId);
    };
  }, [autoAttemptCount, autoRefreshEnabled, code, fetchCode, fetching, linkValid, response?.code]);

  async function copyCode() {
    if (!code) {
      message.warning("暂无可复制验证码");
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      message.success("验证码已复制");
    } catch {
      message.warning("复制失败，请手动复制");
    }
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl py-10">
        <Card className="overflow-hidden rounded-[32px] border-slate-100 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="rounded-[28px] bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm uppercase tracking-[0.22em] text-slate-400">Mail Code</div>
                <h1 className="mt-2 text-3xl font-semibold text-slate-900">邮箱验证码取码</h1>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  打开页面会自动读取邮箱最近验证码，成功后可以一键复制；同一链接可重复打开。
                </p>
              </div>
              <Tag color={linkValid ? "green" : "red"}>{linkValid ? "链接有效" : "链接参数异常"}</Tag>
            </div>

            <div className="mt-6 rounded-[24px] border border-slate-100 bg-white p-5">
              <Alert
                showIcon
                type={alertType}
                message={retryLimitReached ? "多次重试后仍未发现验证码" : displayStatusText}
                description={
                  response?.data?.email
                    ? `目标邮箱：${response.data.email}`
                    : retryLimitReached
                      ? "可以确认验证码邮件已经发送后，再手动点击重新获取。"
                    : linkValid
                      ? `如果验证码邮件刚发送，页面会按 ${AUTO_FETCH_INTERVAL_SECONDS} 秒间隔自动重试。`
                      : "请确认链接中包含 token 和 uid 参数。"
                }
              />

              <div className="mt-5">
                <div className="mb-2 text-sm font-medium text-slate-700">验证码</div>
                <Input
                  readOnly
                  size="large"
                  value={code}
                  placeholder={fetching ? "正在获取验证码..." : "验证码会显示在这里"}
                  prefix={fetching ? <Spin size="small" /> : <MailOutlined className="text-slate-400" />}
                  className="[&_.ant-input]:font-mono [&_.ant-input]:text-xl"
                />
              </div>

              {response?.data ? (
                <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-xs text-slate-500 sm:grid-cols-2">
                  <div>
                    <div>收到时间</div>
                    <div className="mt-1 text-slate-700">{formatDateTime(response.data.receivedTime)}</div>
                  </div>
                  <div>
                    <div>取码时间</div>
                    <div className="mt-1 text-slate-700">{formatDateTime(response.data.fetchTime)}</div>
                  </div>
                </div>
              ) : null}

              <Space wrap className="mt-5">
                <Button type="primary" icon={<ReloadOutlined />} loading={fetching} disabled={!canFetch} onClick={() => void fetchCode()}>
                  {response ? "重新获取" : "获取验证码"}
                </Button>
                <Button icon={code ? <CheckCircleOutlined /> : <CopyOutlined />} disabled={!code} onClick={() => void copyCode()}>
                  复制验证码
                </Button>
                <Space size={8}>
                  <Switch size="small" checked={autoRefreshEnabled} disabled={!linkValid || Boolean(code)} onChange={setAutoRefreshEnabled} />
                  <span className="text-sm text-slate-500">自动重试</span>
                </Space>
                {nextRetryIn > 0 ? <Tag color="blue">{nextRetryIn} 秒后重试</Tag> : null}
                {response?.code === WAITING_CODE && autoRefreshEnabled && autoAttemptCount >= AUTO_FETCH_MAX_ATTEMPTS ? (
                  <Tag color="orange">已重试 {AUTO_FETCH_MAX_ATTEMPTS} 次</Tag>
                ) : null}
                {!linkValid ? (
                  <Link to="/">
                    <Button icon={<HomeOutlined />}>返回首页</Button>
                  </Link>
                ) : null}
              </Space>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Input, Modal, Spin, Tag, message } from "antd";

import { getFriendlyMessage } from "../lib/errorMessage";
import { buildProtectedDownloadUrl, getCaptcha, verifyCaptcha, type DownloadItem } from "../services/downloadService";

const CAPTCHA_INPUT_MAX_LENGTH = 4;

type Props = {
  open: boolean;
  item: DownloadItem | null;
  onClose: () => void;
  onVerified?: (downloadUrl: string) => void;
};

function normalizeCaptchaInput(value: string) {
  return value.replace(/\D/g, "").slice(0, CAPTCHA_INPUT_MAX_LENGTH);
}

export default function CaptchaModal({ open, item, onClose, onVerified }: Props) {
  const [captchaImg, setCaptchaImg] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedValue = value.trim();
  const captchaRequired = Boolean(item?.locked);
  const passwordRequired = Boolean(item?.passwordProtected);
  const canSubmit = Boolean(
    item &&
      !loading &&
      !verifyLoading &&
      (!captchaRequired || (captchaId && normalizedValue.length === CAPTCHA_INPUT_MAX_LENGTH)) &&
      (!passwordRequired || password.trim()),
  );

  const fetchOne = useCallback(async (options?: { preserveError?: boolean }) => {
    setLoading(true);
    if (!options?.preserveError) {
      setError(null);
    }
    setValue("");
    try {
      const response = await getCaptcha();
      setCaptchaId(response.captchaId);
      setCaptchaImg(response.image);
    } catch (fetchError) {
      const errorMessage = getFriendlyMessage(fetchError, "验证码加载失败，请稍后重试");
      setCaptchaId("");
      setCaptchaImg("");
      setError(errorMessage);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setCaptchaImg("");
      setCaptchaId("");
      setError(null);
      setPassword("");
      if (item?.locked) {
        void fetchOne();
      } else {
        setLoading(false);
      }
    }
  }, [fetchOne, item, open]);

  async function handleVerify() {
    if (!item) return;
    if (captchaRequired && !captchaId) {
      message.warning("验证码尚未加载完成，请先刷新验证码");
      await fetchOne();
      return;
    }
    if (captchaRequired && normalizedValue.length < CAPTCHA_INPUT_MAX_LENGTH) {
      message.warning(`请输入 ${CAPTCHA_INPUT_MAX_LENGTH} 位验证码`);
      return;
    }

    setVerifyLoading(true);
    try {
      if (passwordRequired && !password.trim()) {
        message.warning("请输入下载密码");
        return;
      }
      const res = await verifyCaptcha(
        captchaId,
        normalizedValue,
        item.url,
        item.title,
        password,
      );
      if (res?.downloadToken) {
        const downloadUrl = buildProtectedDownloadUrl(res.downloadToken);
        if (onVerified) {
          onVerified(downloadUrl);
        } else {
          window.location.assign(downloadUrl);
        }
        onClose();
        message.success("验证通过，开始下载");
      } else {
        const errorMessage = res?.message || "验证码错误";
        setError(errorMessage);
        message.error(errorMessage);
        setValue("");
        if (captchaRequired) {
          await fetchOne({ preserveError: true });
        }
      }
    } catch (verifyError) {
      const errorMessage = getFriendlyMessage(verifyError, "校验失败，请稍后重试");
      setError(errorMessage);
      message.error(errorMessage);
      setValue("");
      if (captchaRequired) {
        await fetchOne({ preserveError: true });
      }
    } finally {
      setVerifyLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      title={
        captchaRequired && passwordRequired
          ? "请输入验证码和下载密码"
          : passwordRequired
            ? "请输入下载密码"
            : "请输入验证码后开始下载"
      }
      onCancel={onClose}
      onOk={() => void handleVerify()}
      okText="提交"
      cancelText="取消"
      confirmLoading={verifyLoading}
      okButtonProps={{ disabled: !canSubmit }}
      cancelButtonProps={{ disabled: verifyLoading }}
      maskClosable={false}
    >
      <div className="flex flex-col gap-3">
        {item ? (
          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-sm font-medium text-slate-900">{item.title}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.version ? <Tag color="blue">{item.version}</Tag> : null}
              {item.fileSize ? <Tag>{item.fileSize}</Tag> : null}
              <Tag color={captchaId ? "green" : "default"}>{captchaId ? "验证码已加载" : "等待验证码"}</Tag>
            </div>
          </div>
        ) : null}

        {error ? <Alert showIcon type="warning" message={error} /> : null}

        {captchaRequired ? (
          <>
            <button
              type="button"
              className="flex h-24 w-full items-center justify-center rounded-lg border border-slate-100 bg-gray-100 transition hover:border-blue-200 disabled:cursor-not-allowed disabled:opacity-70"
              title="点击刷新验证码"
              disabled={loading || verifyLoading}
              onClick={() => void fetchOne()}
            >
              {loading ? (
                <Spin />
              ) : captchaImg ? (
                <img src={captchaImg} alt="验证码" className="h-20 w-full rounded-lg object-contain" />
              ) : (
                <span className="text-sm text-slate-500">暂无验证码</span>
              )}
            </button>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="在此输入验证码"
                value={value}
                maxLength={CAPTCHA_INPUT_MAX_LENGTH}
                showCount
                allowClear
                inputMode="numeric"
                autoComplete="one-time-code"
                onChange={(event) => setValue(normalizeCaptchaInput(event.target.value))}
                onPressEnter={() => void handleVerify()}
                autoFocus={!passwordRequired}
              />
              <Button disabled={loading || verifyLoading} onClick={() => void fetchOne()}>
                刷新
              </Button>
            </div>
          </>
        ) : null}

        {passwordRequired ? (
          <Input.Password
            placeholder="输入该资源的下载密码"
            value={password}
            maxLength={64}
            autoComplete="off"
            autoFocus={!captchaRequired}
            onChange={(event) => setPassword(event.target.value)}
            onPressEnter={() => void handleVerify()}
          />
        ) : null}
      </div>
    </Modal>
  );
}

import { useEffect, useState } from "react";
import { Button, Input, Modal, Spin, message } from "antd";

import { buildProtectedDownloadUrl, getCaptcha, verifyCaptcha, type DownloadItem } from "../services/downloadService";

type Props = {
  open: boolean;
  item: DownloadItem | null;
  onClose: () => void;
  onVerified?: (downloadUrl: string) => void;
};

export default function CaptchaModal({ open, item, onClose, onVerified }: Props) {
  const [captchaImg, setCaptchaImg] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setValue("");
      setCaptchaImg("");
      setCaptchaId("");
      void fetchOne();
    }
  }, [open, item]);

  async function fetchOne() {
    setLoading(true);
    try {
      const response = await getCaptcha();
      setCaptchaId(response.captchaId);
      setCaptchaImg(response.image);
    } catch (error) {
      console.error(error);
      message.error("加载验证码失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!item) return;
    if (!captchaId) {
      message.warning("验证码尚未加载完成，请先刷新验证码");
      await fetchOne();
      return;
    }
    if (!value.trim()) {
      message.warning("请输入验证码");
      return;
    }

    setVerifyLoading(true);
    try {
      const res = await verifyCaptcha(captchaId, value.trim(), item.url, item.title);
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
        message.error(res?.message || "验证码错误");
        setValue("");
        await fetchOne();
      }
    } catch (error) {
      console.error(error);
      message.error("校验失败，请稍后重试");
      await fetchOne();
    } finally {
      setVerifyLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      title="请输入验证码以后开始下载"
      onCancel={onClose}
      onOk={() => void handleVerify()}
      okText="提交"
      cancelText="取消"
      confirmLoading={verifyLoading}
      maskClosable={false}
    >
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="flex h-24 w-full items-center justify-center rounded bg-gray-100">
            <Spin />
          </div>
        ) : captchaImg ? (
          <img src={captchaImg} alt="captcha" className="h-24 w-full rounded object-contain" />
        ) : (
          <div className="flex h-24 w-full items-center justify-center rounded bg-gray-100">暂无验证码</div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="在此输入验证码"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onPressEnter={() => void handleVerify()}
            autoFocus
          />
          <Button type="link" onClick={() => void fetchOne()}>
            刷新
          </Button>
        </div>
      </div>
    </Modal>
  );
}

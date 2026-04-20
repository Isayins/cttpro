import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Image, Input, Space, Spin, message } from "antd";

import { buildProtectedDownloadUrl, getCaptcha, verifyCaptcha } from "../services/downloadService";

export default function VerifyDownload() {
  const [params] = useSearchParams();
  const resource = params.get("resource") || "";
  const fileName = params.get("fileName") || "";
  const [captchaImg, setCaptchaImg] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshCaptcha = async () => {
    setLoading(true);
    try {
      const response = await getCaptcha();
      setCaptchaId(response.captchaId);
      setCaptchaImg(response.image);
    } catch {
      setCaptchaId("");
      setCaptchaImg("");
      message.error("加载验证码失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshCaptcha();
  }, []);

  const handleSubmit = async () => {
    if (!captchaId) {
      message.warning("验证码尚未加载完成，请先刷新");
      void refreshCaptcha();
      return;
    }

    if (!input.trim()) {
      message.warning("请输入验证码");
      return;
    }

    try {
      const response = await verifyCaptcha(captchaId, input.trim(), resource, fileName);
      if (!response.downloadToken) {
        throw new Error(response.message || "验证码校验失败");
      }
      window.location.href = buildProtectedDownloadUrl(response.downloadToken);
    } catch {
      message.error("验证码错误，请重试");
      setInput("");
      void refreshCaptcha();
    }
  };

  if (!resource) {
    return <div style={{ padding: 20 }}>缺少资源参数</div>;
  }

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", textAlign: "center" }}>
      <h3>下载前请输入验证码</h3>
      {loading ? (
        <Spin />
      ) : (
        <>
          {captchaImg && (
            <Image
              src={captchaImg}
              alt="验证码"
              preview={false}
              style={{ width: "100%", height: 80, objectFit: "contain", borderRadius: 8, marginTop: 10 }}
            />
          )}
          <Input
            placeholder="输入验证码"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={() => void handleSubmit()}
            style={{ width: "100%", marginTop: 10 }}
          />
          <Space direction="vertical" style={{ width: "100%", marginTop: 10 }}>
            <Button onClick={() => void handleSubmit()} type="primary" style={{ width: "100%" }}>
              确认下载
            </Button>
            <Button onClick={() => void refreshCaptcha()} style={{ width: "100%" }}>
              刷新验证码
            </Button>
          </Space>
        </>
      )}
    </div>
  );
}

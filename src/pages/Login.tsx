import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Modal, Progress, Tabs, Typography, message } from "antd";
import type { NamePath } from "antd/es/form/interface";
import { ArrowLeftOutlined, LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";

import { useAuth } from "../context/useAuth";
import { authApi } from "../services/api";

interface LoginFormValues {
  username: string;
  password: string;
}

interface RegisterFormValues {
  username: string;
  email: string;
  nickname: string;
  inviteCode: string;
  emailCode: string;
  password: string;
  confirmPassword: string;
}

type PasswordStrengthLevel = "弱" | "中" | "强";

function getPasswordStrength(password: string): { score: number; label: PasswordStrengthLevel; color: string } {
  if (!password) {
    return { score: 0, label: "弱", color: "#d9d9d9" };
  }

  let score = 0;
  if (password.length >= 6) score += 35;
  if (/[A-Za-z]/.test(password)) score += 25;
  if (/\d/.test(password)) score += 25;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 10) score += 15;

  if (score >= 85) {
    return { score, label: "强", color: "#16a34a" };
  }
  if (score >= 60) {
    return { score, label: "中", color: "#f59e0b" };
  }
  return { score, label: "弱", color: "#ef4444" };
}

function validatePasswordRule(password: string) {
  return password.length >= 6 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function getFriendlyMessage(err: unknown, fallback: string) {
  if (!(err instanceof Error) || !err.message) {
    return fallback;
  }

  const text = err.message.trim();
  return /[\u4e00-\u9fa5]/.test(text) ? text : fallback;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isAuthenticated } = useAuth();
  const [activeKey, setActiveKey] = useState("login");
  const [error, setError] = useState<string | null>(null);
  const [successTip, setSuccessTip] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [passwordValue, setPasswordValue] = useState("");
  const [registerForm] = Form.useForm<RegisterFormValues>();

  const targetPath = (location.state as { from?: string } | null)?.from ?? "/forum";
  const passwordStrength = useMemo(() => getPasswordStrength(passwordValue), [passwordValue]);

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  }

  useEffect(() => {
    if (isAuthenticated) {
      navigate(targetPath, { replace: true });
    }
  }, [isAuthenticated, navigate, targetPath]);

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  function clearFeedback() {
    setError(null);
    setSuccessTip(null);
  }

  function applyRegisterFieldError(fieldName: NamePath, fieldError: string) {
    registerForm.setFields([{ name: fieldName, errors: [fieldError] }]);
  }

  function clearRegisterFieldErrors() {
    registerForm.setFields([
      { name: "username", errors: [] },
      { name: "email", errors: [] },
      { name: "inviteCode", errors: [] },
      { name: "emailCode", errors: [] },
      { name: "password", errors: [] },
    ]);
  }

  function showRegisterResultModal(success: boolean, content: string) {
    if (success) {
      Modal.success({
        title: "注册成功",
        content,
      });
      return;
    }

    Modal.error({
      title: "注册失败",
      content,
    });
  }

  function handleRegisterErrorFeedback(rawMessage: string) {
    setError(rawMessage);
    setSuccessTip(null);
    showRegisterResultModal(false, rawMessage);

    if (rawMessage.includes("邮箱")) {
      applyRegisterFieldError("email", rawMessage);
      return;
    }
    if (rawMessage.includes("用户")) {
      applyRegisterFieldError("username", rawMessage);
      return;
    }
    if (rawMessage.includes("邀请码")) {
      applyRegisterFieldError("inviteCode", rawMessage);
      return;
    }
    if (rawMessage.includes("验证码")) {
      applyRegisterFieldError("emailCode", rawMessage);
      return;
    }
    if (rawMessage.includes("密码")) {
      applyRegisterFieldError("password", rawMessage);
    }
  }

  async function handleLogin(values: LoginFormValues) {
    setSubmitting(true);
    clearFeedback();
    try {
      await login(values);
      message.success("登录成功");
      navigate(targetPath, { replace: true });
    } catch (err) {
      const messageText = getFriendlyMessage(err, "登录失败，请检查账号和密码后重试");
      setError(messageText);
      message.error(messageText);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(values: RegisterFormValues) {
    setSubmitting(true);
    clearFeedback();
    clearRegisterFieldErrors();

    try {
      await register({
        username: values.username,
        email: values.email,
        nickname: values.nickname,
        inviteCode: values.inviteCode,
        emailCode: values.emailCode,
        password: values.password,
      });

      const successText = "注册成功，请使用用户名或邮箱登录。";
      setSuccessTip(successText);
      showRegisterResultModal(true, successText);
      registerForm.resetFields();
      setPasswordValue("");
      setCountdown(0);
      setActiveKey("login");
    } catch (err) {
      handleRegisterErrorFeedback(getFriendlyMessage(err, "注册失败，请稍后重试"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendEmailCode() {
    const email = registerForm.getFieldValue("email");
    if (!email) {
      message.warning("请先输入邮箱");
      return;
    }

    setSendingCode(true);
    clearFeedback();
    registerForm.setFields([{ name: "email", errors: [] }]);

    try {
      const response = await authApi.sendEmailCode({ email });
      const successMessage = response.message || "验证码已发送，请注意查收邮箱。";
      setSuccessTip(successMessage);
      message.success(successMessage);
      setCountdown(60);
    } catch (err) {
      const messageText = getFriendlyMessage(err, "验证码发送失败，请稍后重试");
      setError(messageText);
      message.error(messageText);

      if (messageText.includes("邮箱")) {
        applyRegisterFieldError("email", messageText);
      }
    } finally {
      setSendingCode(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <Card className="rounded-2xl border-slate-200 shadow-sm">
          <div className="mb-4">
            <Button type="link" icon={<ArrowLeftOutlined />} className="px-0" onClick={handleBack}>
              返回上一页
            </Button>
          </div>

          <div className="mb-6 text-center">
            <Typography.Title level={2} className="!mb-2">
              IDNCAR
            </Typography.Title>
            <Typography.Paragraph className="!mb-0 text-slate-500">
              登录或注册账号后，即可进入论坛、股票页面和个人中心。
            </Typography.Paragraph>
          </div>

          {successTip && <Alert type="success" showIcon message={successTip} className="mb-4" />}
          {error && <Alert type="error" showIcon message={error} className="mb-5" />}

          <Tabs
            activeKey={activeKey}
            onChange={(key) => {
              setActiveKey(key);
              clearFeedback();
            }}
            items={[
              {
                key: "login",
                label: "登录",
                children: (
                  <Form<LoginFormValues> layout="vertical" onFinish={(values) => void handleLogin(values)}>
                    <Form.Item
                      name="username"
                      label="用户名或邮箱"
                      rules={[{ required: true, message: "请输入用户名或邮箱" }]}
                    >
                      <Input size="large" prefix={<UserOutlined />} placeholder="请输入用户名或邮箱" />
                    </Form.Item>

                    <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
                      <Input.Password size="large" prefix={<LockOutlined />} placeholder="请输入密码" />
                    </Form.Item>

                    <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
                      登录
                    </Button>
                  </Form>
                ),
              },
              {
                key: "register",
                label: "注册",
                children: (
                  <Form<RegisterFormValues>
                    form={registerForm}
                    layout="vertical"
                    onFinish={(values) => void handleRegister(values)}
                  >
                    <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
                      <Input size="large" prefix={<UserOutlined />} placeholder="请输入用户名" />
                    </Form.Item>

                    <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: "请输入昵称" }]}>
                      <Input size="large" placeholder="请输入昵称" />
                    </Form.Item>

                    <Form.Item
                      name="email"
                      label="邮箱"
                      rules={[
                        { required: true, message: "请输入邮箱" },
                        { type: "email", message: "请输入正确的邮箱格式" },
                      ]}
                    >
                      <Input size="large" prefix={<MailOutlined />} placeholder="请输入邮箱" />
                    </Form.Item>

                    <Form.Item name="inviteCode" label="邀请码" rules={[{ required: true, message: "请输入邀请码" }]}>
                      <Input size="large" placeholder="请输入邀请码" />
                    </Form.Item>

                    <Form.Item
                      name="emailCode"
                      label="邮箱验证码"
                      rules={[{ required: true, message: "请输入邮箱验证码" }]}
                    >
                      <Input
                        size="large"
                        placeholder="请输入邮箱验证码"
                        addonAfter={
                          <Button
                            type="link"
                            size="small"
                            onClick={() => void handleSendEmailCode()}
                            disabled={sendingCode || countdown > 0}
                          >
                            {countdown > 0 ? `${countdown}s` : "发送"}
                          </Button>
                        }
                      />
                    </Form.Item>

                    <Form.Item
                      name="password"
                      label="密码"
                      extra="密码至少 6 位，且必须同时包含字母和数字。"
                      rules={[
                        { required: true, message: "请输入密码" },
                        {
                          validator(_, value) {
                            if (!value || validatePasswordRule(value)) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error("密码至少 6 位，且必须同时包含字母和数字"));
                          },
                        },
                      ]}
                    >
                      <Input.Password
                        size="large"
                        prefix={<LockOutlined />}
                        placeholder="请输入密码"
                        onChange={(event) => setPasswordValue(event.target.value)}
                      />
                    </Form.Item>

                    <div className="mb-4">
                      <div className="mb-2 text-sm text-slate-500">密码强度：{passwordValue ? passwordStrength.label : "未输入"}</div>
                      <Progress percent={passwordValue ? passwordStrength.score : 0} strokeColor={passwordStrength.color} showInfo={false} />
                    </div>

                    <Form.Item
                      name="confirmPassword"
                      label="确认密码"
                      dependencies={["password"]}
                      rules={[
                        { required: true, message: "请再次输入密码" },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue("password") === value) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error("两次输入的密码不一致"));
                          },
                        }),
                      ]}
                    >
                      <Input.Password size="large" prefix={<LockOutlined />} placeholder="请再次输入密码" />
                    </Form.Item>

                    <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
                      注册
                    </Button>
                  </Form>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

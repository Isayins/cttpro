import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Input, Modal, Progress, Tabs, Typography, message } from "antd";
import type { InputRef } from "antd";
import type { NamePath } from "antd/es/form/interface";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";

import { useAuth } from "../context/useAuth";
import { getFriendlyMessage } from "../lib/errorMessage";
import { defaultAuthenticatedPath, resolveRedirectPageTitle, resolveRedirectPath } from "../router/authRedirect";
import { routePaths } from "../router/routeAccess";
import { authApi } from "../services/api/auth";
import logo from "../store/images/idncar.png";

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

function normalizeTextInput(value: unknown) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeEmailInput(value: unknown) {
  const normalized = normalizeTextInput(value);
  return typeof normalized === "string" ? normalized.toLowerCase() : normalized;
}

function normalizeInviteCodeInput(value: unknown) {
  const normalized = normalizeTextInput(value);
  return typeof normalized === "string" ? normalized.toUpperCase() : normalized;
}

function normalizeEmailCodeInput(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "").slice(0, 6) : value;
}

function normalizeLoginValues(values: LoginFormValues): LoginFormValues {
  return {
    ...values,
    username: String(normalizeTextInput(values.username) ?? ""),
  };
}

function normalizeRegisterValues(values: RegisterFormValues): RegisterFormValues {
  return {
    ...values,
    username: String(normalizeTextInput(values.username) ?? ""),
    email: String(normalizeEmailInput(values.email) ?? ""),
    nickname: String(normalizeTextInput(values.nickname) ?? ""),
    inviteCode: String(normalizeInviteCodeInput(values.inviteCode) ?? ""),
    emailCode: String(normalizeEmailCodeInput(values.emailCode) ?? ""),
  };
}

const accountHighlights = [
  {
    title: "统一账号入口",
    description: "登录后可以进入论坛、下载中心、工具页和个人资料。",
    icon: <TeamOutlined />,
  },
  {
    title: "邀请码注册",
    description: "注册流程保留邀请码校验，方便控制站内访问范围。",
    icon: <SafetyCertificateOutlined />,
  },
  {
    title: "邮箱验证码",
    description: "注册前先验证邮箱，减少后续找回和通知问题。",
    icon: <MailOutlined />,
  },
];

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
  const [loginForm] = Form.useForm<LoginFormValues>();
  const [registerForm] = Form.useForm<RegisterFormValues>();
  const loginPasswordInputRef = useRef<InputRef>(null);

  const targetPath = useMemo(
    () => resolveRedirectPath((location.state as { from?: unknown } | null)?.from),
    [location.state],
  );
  const redirectPageTitle = useMemo(() => resolveRedirectPageTitle(targetPath), [targetPath]);
  const shouldShowRedirectTip = targetPath !== defaultAuthenticatedPath;
  const backButtonLabel = shouldShowRedirectTip ? "返回首页" : "返回上一页";
  const mobileBackButtonLabel = shouldShowRedirectTip ? "首页" : "返回";
  const passwordStrength = useMemo(() => getPasswordStrength(passwordValue), [passwordValue]);
  const isRegisterMode = activeKey === "register";

  function handleBack() {
    if (shouldShowRedirectTip) {
      navigate(routePaths.home, { replace: true });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(routePaths.home);
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

  function focusLoginPasswordInput(delay = 0) {
    window.setTimeout(() => {
      loginPasswordInputRef.current?.focus();
    }, delay);
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

  function showRegisterResultModal(success: boolean, content: string, afterClose?: () => void) {
    if (success) {
      Modal.success({
        title: "注册成功",
        content,
        onOk: afterClose,
        afterClose,
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
    const normalizedValues = normalizeLoginValues(values);
    setSubmitting(true);
    clearFeedback();
    try {
      await login(normalizedValues);
      message.success("登录成功");
      navigate(targetPath, { replace: true });
    } catch (err) {
      const messageText = getFriendlyMessage(err, "登录失败，请检查账号和密码后重试");
      setError(messageText);
      message.error(messageText);
      focusLoginPasswordInput();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(values: RegisterFormValues) {
    const normalizedValues = normalizeRegisterValues(values);
    setSubmitting(true);
    clearFeedback();
    clearRegisterFieldErrors();

    try {
      await register({
        username: normalizedValues.username,
        email: normalizedValues.email,
        nickname: normalizedValues.nickname,
        inviteCode: normalizedValues.inviteCode,
        emailCode: normalizedValues.emailCode,
        password: normalizedValues.password,
      });

      const successText = "注册成功，已为你填入用户名，请输入密码完成登录。";
      setSuccessTip(successText);
      showRegisterResultModal(true, successText, () => focusLoginPasswordInput(180));
      loginForm.setFieldsValue({ username: normalizedValues.username });
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
    try {
      await registerForm.validateFields(["email"]);
    } catch {
      message.warning("请先输入正确的邮箱");
      return;
    }

    const email = String(normalizeEmailInput(registerForm.getFieldValue("email")) ?? "");
    registerForm.setFieldsValue({ email });

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(220,234,255,0.75),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,239,214,0.62),transparent_24%),linear-gradient(180deg,#f8fbff_0%,#f3f6fb_100%)] px-4 py-4 text-slate-900 sm:py-6 md:px-6 lg:py-10">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-4 sm:gap-6 lg:min-h-[calc(100vh-80px)] lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center">
        <section className="hidden lg:block">
          <div className="inline-flex items-center gap-3 border border-white/80 bg-white/70 px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] backdrop-blur">
            <img src={logo} alt="IDNCAR" className="h-11 w-11 border border-slate-200 bg-white p-1.5" />
            <div>
              <div className="text-lg font-semibold tracking-[0.08em] text-slate-950">IDNCAR</div>
              <div className="text-xs text-slate-500">账号中心</div>
            </div>
          </div>

          <h1 className="mt-8 max-w-2xl text-5xl font-semibold leading-tight text-slate-950">
            登录后继续使用站内工具、资源和社区功能。
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
            这里是 IDNCAR 的统一账号入口。已有账号直接登录，新用户使用邀请码和邮箱验证码完成注册。
          </p>

          <div className="mt-8 grid max-w-2xl gap-3">
            {accountHighlights.map((item) => (
              <div key={item.title} className="flex gap-4 border border-white/75 bg-white/68 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] backdrop-blur">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-slate-200 bg-slate-50 text-lg text-slate-700">
                  {item.icon}
                </div>
                <div>
                  <div className="font-semibold text-slate-950">{item.title}</div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          <div className="mb-3 flex items-center justify-between sm:mb-4 lg:hidden">
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="IDNCAR" className="h-9 w-9 border border-slate-200 bg-white p-1.5 sm:h-10 sm:w-10" />
              <div>
                <div className="font-semibold tracking-[0.08em] text-slate-950">IDNCAR</div>
                <div className="text-xs text-slate-500">账号中心</div>
              </div>
            </div>
            <Button type="link" icon={<ArrowLeftOutlined />} className="px-0" onClick={handleBack}>
              {mobileBackButtonLabel}
            </Button>
          </div>

          <Card className="rounded-2xl border-white/80 bg-white/90 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur [&_.ant-card-body]:p-4 sm:[&_.ant-card-body]:p-6">
            <div className="mb-4 hidden lg:block">
              <Button type="link" icon={<ArrowLeftOutlined />} className="px-0" onClick={handleBack}>
                {backButtonLabel}
              </Button>
            </div>

            <div className="mb-4 text-center sm:mb-6">
              <Typography.Title level={2} className="!mb-1 !text-2xl sm:!mb-2 sm:!text-3xl">
                {isRegisterMode ? "创建账号" : "账号登录"}
              </Typography.Title>
              <Typography.Paragraph className="!mb-0 text-sm text-slate-500 sm:text-base">
                {isRegisterMode ? "注册完成并登录后才能使用本站功能" : "只有登录以后才能使用本站功能"}
              </Typography.Paragraph>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-1.5 text-center text-xs text-slate-500 sm:mb-5 sm:gap-2">
              <div className={`border px-1.5 py-2 sm:px-2 ${!isRegisterMode ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]" : "border-slate-100 bg-slate-50"}`}>
                <CheckCircleOutlined className="mb-1 block text-slate-700" />
                登录访问
              </div>
              <div className={`border px-1.5 py-2 sm:px-2 ${isRegisterMode ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]" : "border-slate-100 bg-slate-50"}`}>
                <SafetyCertificateOutlined className="mb-1 block text-slate-700" />
                邀请注册
              </div>
              <div className="border border-slate-100 bg-slate-50 px-1.5 py-2 sm:px-2">
                <MailOutlined className="mb-1 block text-slate-700" />
                邮箱验证
              </div>
            </div>

            {shouldShowRedirectTip ? (
              <div className="mb-4 border border-[#dbe7ff] bg-[#f7faff] px-3 py-2.5 text-left">
                <div className="text-xs font-medium text-[#4772b8]">登录后继续访问</div>
                <div className="mt-1 truncate text-sm font-semibold text-slate-800">{redirectPageTitle}</div>
              </div>
            ) : null}
            {successTip && <Alert type="success" showIcon message={successTip} className="mb-4" />}
            {error && <Alert type="error" showIcon message={error} className="mb-5" />}

            <Tabs
              activeKey={activeKey}
              destroyOnHidden
              onChange={(key) => {
                setActiveKey(key);
                clearFeedback();
              }}
              items={[
              {
                key: "login",
                label: "登录",
                children: (
                  <Form<LoginFormValues>
                    form={loginForm}
                    layout="vertical"
                    autoComplete="on"
                    onFinish={(values) => void handleLogin(values)}
                  >
                    <Form.Item
                      name="username"
                      label="用户名或邮箱"
                      normalize={normalizeTextInput}
                      rules={[{ required: true, message: "请输入用户名或邮箱" }]}
                    >
                      <Input
                        size="large"
                        prefix={<UserOutlined />}
                        placeholder="请输入用户名或邮箱"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                    </Form.Item>

                    <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
                      <Input.Password
                        ref={loginPasswordInputRef}
                        size="large"
                        prefix={<LockOutlined />}
                        placeholder="请输入密码"
                        autoComplete="current-password"
                      />
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
                    autoComplete="on"
                    onFinish={(values) => void handleRegister(values)}
                  >
                    <Form.Item
                      name="username"
                      label="用户名"
                      normalize={normalizeTextInput}
                      rules={[{ required: true, message: "请输入用户名" }]}
                    >
                      <Input
                        size="large"
                        prefix={<UserOutlined />}
                        placeholder="请输入用户名"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                    </Form.Item>

                    <Form.Item
                      name="nickname"
                      label="昵称"
                      normalize={normalizeTextInput}
                      rules={[{ required: true, message: "请输入昵称" }]}
                    >
                      <Input size="large" placeholder="请输入昵称" autoComplete="name" />
                    </Form.Item>

                    <Form.Item
                      name="email"
                      label="邮箱"
                      normalize={normalizeEmailInput}
                      rules={[
                        { required: true, message: "请输入邮箱" },
                        { type: "email", message: "请输入正确的邮箱格式" },
                      ]}
                    >
                      <Input
                        size="large"
                        prefix={<MailOutlined />}
                        type="email"
                        placeholder="请输入邮箱"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                    </Form.Item>

                    <Form.Item
                      name="inviteCode"
                      label="邀请码"
                      normalize={normalizeInviteCodeInput}
                      rules={[{ required: true, message: "请输入邀请码" }]}
                    >
                      <Input
                        size="large"
                        placeholder="请输入邀请码"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                      />
                    </Form.Item>

                    <Form.Item
                      name="emailCode"
                      label="邮箱验证码"
                      normalize={normalizeEmailCodeInput}
                      rules={[
                        { required: true, message: "请输入邮箱验证码" },
                        { len: 6, message: "请输入 6 位邮箱验证码" },
                      ]}
                    >
                      <Input
                        size="large"
                        placeholder="请输入邮箱验证码"
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        addonAfter={
                          <Button
                            type="link"
                            size="small"
                            loading={sendingCode}
                            onClick={() => void handleSendEmailCode()}
                            disabled={sendingCode || countdown > 0}
                            aria-label={countdown > 0 ? `${countdown} 秒后可重新发送邮箱验证码` : "发送邮箱验证码"}
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
                        autoComplete="new-password"
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
                      <Input.Password size="large" prefix={<LockOutlined />} placeholder="请再次输入密码" autoComplete="new-password" />
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
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  List,
  Popconfirm,
  Progress,
  Row,
  Space,
  Tag,
  Upload,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  MailOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";

import AvatarCropModal from "../components/AvatarCropModal";
import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../context/useAuth";
import { getFriendlyMessage } from "../lib/errorMessage";
import { resolveAssetUrl } from "../lib/media";
import { PROFILE_LIMITS, hasProfileChanges, loadProfileContentPages, normalizeProfilePayload } from "../lib/profile";
import { IMAGE_ACCEPT, isAllowedImageFile } from "../lib/richContent";
import { authApi } from "../services/api/auth";
import { forumApi } from "../services/api/forum";
import type { ChangeEmailPayload, ChangePasswordPayload, LoginRecord, Post, UpdateProfilePayload } from "../types/app";

const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const numberFormatter = new Intl.NumberFormat("zh-CN");
const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function getRoleLabel(role?: string) {
  if (role === "OWNER") return "网站拥有者";
  if (role === "ADMIN") return "管理员";
  return "普通用户";
}

function getRoleColor(role?: string) {
  if (role === "OWNER") return "purple";
  if (role === "ADMIN") return "gold";
  return "blue";
}

function getStatusLabel(status?: string) {
  return status === "DISABLED" ? "已禁用" : "正常";
}

function getDeviceLabel(deviceType?: string | null) {
  if (deviceType === "MOBILE") return "移动端";
  if (deviceType === "TABLET") return "平板";
  if (deviceType === "DESKTOP") return "桌面端";
  return "未知设备";
}

function formatCount(value?: number | null) {
  return numberFormatter.format(value ?? 0);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "未知";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateTimeFormatter.format(date);
}

function getProfileCompletionTone(rate: number) {
  if (rate >= 100) return "success";
  if (rate >= 50) return "normal";
  return "exception";
}

function validateNewPassword(_: unknown, value?: string) {
  if (!value) {
    return Promise.resolve();
  }
  if (value.length < 6) {
    return Promise.reject(new Error("新密码至少 6 位"));
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return Promise.reject(new Error("新密码需要同时包含字母和数字"));
  }
  return Promise.resolve();
}

export default function Profile() {
  const { user, updateProfile, changePassword, changeEmail, uploadAvatar } = useAuth();
  const [profileForm] = Form.useForm<UpdateProfilePayload>();
  const [passwordForm] = Form.useForm<ChangePasswordPayload>();
  const [emailForm] = Form.useForm<ChangeEmailPayload>();
  const watchedNickname = Form.useWatch("nickname", profileForm);
  const watchedBio = Form.useWatch("bio", profileForm);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [emailCodeCountdown, setEmailCodeCountdown] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarSourceFile, setAvatarSourceFile] = useState<File | null>(null);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [loginRecords, setLoginRecords] = useState<LoginRecord[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [favoritePosts, setFavoritePosts] = useState<Post[]>([]);
  const [myPostCount, setMyPostCount] = useState(0);
  const [favoritePostCount, setFavoritePostCount] = useState(0);
  const avatarUploadInFlightRef = useRef(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    profileForm.setFieldsValue({
      nickname: user.nickname ?? "",
      bio: user.bio ?? "",
    });
  }, [profileForm, user]);

  useEffect(() => {
    if (emailCodeCountdown <= 0) {
      return;
    }
    const timer = window.setTimeout(
      () => setEmailCodeCountdown((value) => value - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [emailCodeCountdown]);

  const loadLoginRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const records = await authApi.getLoginRecords(10);
      setLoginRecords(records);
    } catch (error) {
      message.error(getFriendlyMessage(error, "加载登录记录失败"));
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  const loadMyContent = useCallback(async () => {
    setLoadingContent(true);
    try {
      const { mine, favorites } = await loadProfileContentPages(
        () => forumApi.getPostsPage({ mine: true, size: 3 }),
        () => forumApi.getPostsPage({ favorites: true, size: 3 }),
      );
      const loadErrors: string[] = [];
      if (mine.status === "fulfilled") {
        setMyPosts(mine.value.records);
        setMyPostCount(mine.value.total);
      } else {
        loadErrors.push(getFriendlyMessage(mine.reason, "我的帖子加载失败"));
      }
      if (favorites.status === "fulfilled") {
        setFavoritePosts(favorites.value.records);
        setFavoritePostCount(favorites.value.total);
      } else {
        loadErrors.push(getFriendlyMessage(favorites.reason, "我的收藏加载失败"));
      }
      if (loadErrors.length > 0) {
        message.warning(loadErrors.join("；"));
      }
    } finally {
      setLoadingContent(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void loadLoginRecords();
    void loadMyContent();
  }, [loadLoginRecords, loadMyContent, user?.id]);

  const profileChecklist = useMemo(
    () => [
      { label: "昵称", done: Boolean(user?.nickname?.trim()) },
      { label: "头像", done: Boolean(user?.avatarUrl?.trim()) },
      { label: "简介", done: Boolean(user?.bio?.trim()) },
      { label: "邮箱", done: Boolean(user?.email?.trim()) },
    ],
    [user],
  );

  const completedProfileCount = profileChecklist.filter((item) => item.done).length;
  const profileCompletionRate = Math.round((completedProfileCount / profileChecklist.length) * 100);
  const profileDirty = watchedNickname !== undefined
    && hasProfileChanges(user, { nickname: watchedNickname, bio: watchedBio });
  const latestLoginRecord = loginRecords[0];
  const overviewCards = useMemo(
    () => [
      {
        label: "资料完整度",
        value: `${profileCompletionRate}%`,
        detail: `已完成 ${completedProfileCount} / ${profileChecklist.length} 项`,
      },
      {
        label: "我的帖子",
        value: formatCount(myPostCount),
        detail: loadingContent ? "同步中" : "论坛发布内容",
      },
      {
        label: "我的收藏",
        value: formatCount(favoritePostCount),
        detail: loadingContent ? "同步中" : "收藏的帖子",
      },
      {
        label: "最近登录",
        value: latestLoginRecord?.loginStatus === "SUCCESS" ? "正常" : latestLoginRecord ? "异常" : "暂无",
        detail: latestLoginRecord ? formatDateTime(latestLoginRecord.createTime) : "暂无登录记录",
      },
    ],
    [completedProfileCount, favoritePostCount, latestLoginRecord, loadingContent, myPostCount, profileChecklist.length, profileCompletionRate],
  );

  async function handleProfileSubmit(values: UpdateProfilePayload) {
    const payload = normalizeProfilePayload(values);
    profileForm.setFieldsValue(payload);
    setSavingProfile(true);
    try {
      await updateProfile(payload);
      message.success("个人资料已更新");
    } catch (error) {
      message.error(getFriendlyMessage(error, "更新个人资料失败"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(values: ChangePasswordPayload) {
    setSavingPassword(true);
    try {
      await changePassword(values);
      passwordForm.resetFields();
      message.success("密码修改成功，请重新登录");
    } catch (error) {
      message.error(getFriendlyMessage(error, "修改密码失败"));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSendEmailChangeCode() {
    try {
      await emailForm.validateFields(["newEmail"]);
    } catch {
      message.warning("请先输入正确的新邮箱");
      return;
    }
    const newEmail = String(emailForm.getFieldValue("newEmail") ?? "")
      .trim()
      .toLowerCase();
    emailForm.setFieldsValue({ newEmail });
    setSendingEmailCode(true);
    try {
      const response = await authApi.sendEmailChangeCode(newEmail);
      message.success(response.message || "验证码已发送，请查收新邮箱");
      setEmailCodeCountdown(60);
    } catch (error) {
      message.error(getFriendlyMessage(error, "验证码发送失败"));
    } finally {
      setSendingEmailCode(false);
    }
  }

  async function handleChangeEmail(values: ChangeEmailPayload) {
    setSavingEmail(true);
    try {
      await changeEmail({
        ...values,
        newEmail: values.newEmail.trim().toLowerCase(),
        emailCode: values.emailCode.trim(),
      });
      emailForm.resetFields();
      setEmailCodeCountdown(0);
      message.success("邮箱更换成功，请使用新邮箱重新登录");
    } catch (error) {
      message.error(getFriendlyMessage(error, "邮箱更换失败"));
    } finally {
      setSavingEmail(false);
    }
  }

  function handleAvatarFileSelect(file: File) {
    if (!isAllowedImageFile(file)) {
      message.error("仅支持 JPG、PNG、WEBP、GIF 图片");
      return;
    }

    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      message.error("头像图片不能超过 5MB");
      return;
    }

    setAvatarSourceFile(file);
  }

  async function handleAvatarUpload(file: File) {
    if (avatarUploadInFlightRef.current) {
      message.warning("头像正在上传中，请稍候");
      return false;
    }
    if (!isAllowedImageFile(file)) {
      message.error("仅支持 JPG、PNG、WEBP、GIF 图片");
      return false;
    }

    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      message.error("头像图片不能超过 5MB");
      return false;
    }

    avatarUploadInFlightRef.current = true;
    setUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      message.success("头像已上传并保存到服务器");
      return true;
    } catch (error) {
      message.error(getFriendlyMessage(error, "头像上传失败"));
      return false;
    } finally {
      avatarUploadInFlightRef.current = false;
      setUploadingAvatar(false);
    }
  }

  async function handleAvatarRemove() {
    setRemovingAvatar(true);
    try {
      await updateProfile({ avatarUrl: "" });
      message.success("头像已删除");
    } catch (error) {
      message.error(getFriendlyMessage(error, "删除头像失败"));
    } finally {
      setRemovingAvatar(false);
    }
  }

  return (
    <MainLayout>
      <div className="space-y-8 py-8 md:space-y-10 md:py-10">
        <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)] md:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)] xl:items-end">
            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">个人中心</div>
              <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">账号与资料</h1>
              <p className="max-w-3xl text-sm leading-8 text-slate-500 md:text-base">
                维护公开资料、账户安全、社区内容和最近登录记录。头像、昵称和简介会同步到站内公开展示位置。
              </p>
              <Space wrap>
                <Tag color={getRoleColor(user?.role)}>{getRoleLabel(user?.role)}</Tag>
                <Tag color={user?.status === "DISABLED" ? "red" : "green"}>{getStatusLabel(user?.status)}</Tag>
                {user?.title ? <Tag color="blue">{user.title}</Tag> : null}
              </Space>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {overviewCards.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white bg-slate-50/85 px-4 py-3">
                  <div className="text-xs text-slate-500">{item.label}</div>
                  <div className="mt-1 text-2xl font-semibold leading-none text-slate-950">{item.value}</div>
                  <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Row gutter={[24, 24]}>
          <Col xs={24} xl={8}>
            <div className="space-y-6">
              <Card className="rounded-[30px] border-slate-100 shadow-sm">
                <div className="flex flex-col items-center gap-4 text-center">
                  <Avatar size={104} src={resolveAssetUrl(user?.avatarUrl)} icon={<UserOutlined />}>
                    {user?.nickname?.[0]}
                  </Avatar>
                  <div>
                    <div className="text-2xl font-semibold text-slate-900">{user?.nickname || "未设置昵称"}</div>
                    <div className="mt-1 text-sm text-slate-500">@{user?.username || "-"}</div>
                  </div>
                  <Space wrap>
                    <Tag color={getRoleColor(user?.role)}>{getRoleLabel(user?.role)}</Tag>
                    <Tag color={user?.status === "DISABLED" ? "red" : "green"}>{getStatusLabel(user?.status)}</Tag>
                  </Space>

                  <div className="w-full space-y-3 rounded-3xl bg-slate-50 p-5 text-left text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <MailOutlined />
                      <span>{user?.email || "未绑定邮箱"}</span>
                    </div>
                    <div>注册时间: {formatDateTime(user?.createTime)}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl bg-white px-3 py-2">
                        <div className="text-xs text-slate-400">等级</div>
                        <div className="mt-1 font-semibold text-slate-900">Lv.{user?.level ?? 1}</div>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-2">
                        <div className="text-xs text-slate-400">经验</div>
                        <div className="mt-1 font-semibold text-slate-900">{formatCount(user?.experience)}</div>
                      </div>
                    </div>
                    <div>个人简介: {user?.bio || "这个用户还没有填写个人简介。"}</div>
                  </div>
                </div>
              </Card>

              <Card className="rounded-[30px] border-slate-100 shadow-sm">
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">资料完整度</div>
                      <p className="mt-2 text-sm leading-7 text-slate-500">
                        头像、昵称和简介越完整，论坛和个人入口展示会越统一。
                      </p>
                    </div>
                    <Tag color={profileCompletionRate >= 100 ? "green" : "blue"}>{profileCompletionRate}%</Tag>
                  </div>

                  <Progress percent={profileCompletionRate} status={getProfileCompletionTone(profileCompletionRate)} />

                  <div className="grid grid-cols-4 gap-2">
                    {profileChecklist.map((item) => (
                      <div
                        key={item.label}
                        className={`rounded-2xl px-3 py-3 text-center text-sm ${
                          item.done ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>

                  <div className="rounded-3xl bg-[linear-gradient(180deg,#f8fbff,#f2f6fd)] p-4 text-sm text-slate-600">
                    已完成 {completedProfileCount} / {profileChecklist.length} 项
                  </div>
                </div>
              </Card>
            </div>
          </Col>

          <Col xs={24} xl={16}>
            <div className="space-y-6">
              <Card className="rounded-[30px] border-slate-100 shadow-sm">
                <div className="mb-6">
                  <div className="text-lg font-semibold text-slate-900">公开资料</div>
                  <p className="mt-2 text-sm leading-7 text-slate-500">
                    这里修改的资料会同步到右上角头像、论坛发帖和回帖等公开位置。
                  </p>
                </div>

                <div className="mb-6 flex flex-col gap-4 rounded-[28px] border border-slate-100 bg-slate-50 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar size={72} src={resolveAssetUrl(user?.avatarUrl)} icon={<UserOutlined />}>
                      {user?.nickname?.[0]}
                    </Avatar>
                    <div>
                      <div className="text-base font-semibold text-slate-900">头像上传</div>
                      <p className="mt-1 text-sm leading-7 text-slate-500">
                        支持 JPG、PNG、WEBP、GIF，单张不超过 5MB，上传前可调整圆形显示区域。
                      </p>
                    </div>
                  </div>
                  <Space wrap>
                    <Upload
                      accept={IMAGE_ACCEPT}
                      showUploadList={false}
                      beforeUpload={(file) => {
                        handleAvatarFileSelect(file as File);
                        return false;
                      }}
                    >
                      <Button icon={<UploadOutlined />} loading={uploadingAvatar} disabled={uploadingAvatar || removingAvatar}>
                        上传头像
                      </Button>
                    </Upload>
                    <Popconfirm
                      title="删除当前头像？"
                      description="删除后将使用昵称首字作为默认头像。"
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => void handleAvatarRemove()}
                    >
                      <Button danger icon={<DeleteOutlined />} loading={removingAvatar} disabled={!user?.avatarUrl || uploadingAvatar}>
                        删除头像
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>

                <Form<UpdateProfilePayload>
                  form={profileForm}
                  layout="vertical"
                  onFinish={(values) => void handleProfileSubmit(values)}
                >
                  <Form.Item
                    name="nickname"
                    label="昵称"
                    rules={[
                      { required: true, whitespace: true, message: "请输入昵称" },
                      { max: PROFILE_LIMITS.nickname, message: `昵称不能超过 ${PROFILE_LIMITS.nickname} 个字符` },
                    ]}
                  >
                    <Input maxLength={PROFILE_LIMITS.nickname} showCount placeholder="请输入你的展示昵称" />
                  </Form.Item>

                  <Form.Item
                    name="bio"
                    label="个人简介"
                    rules={[{ max: PROFILE_LIMITS.bio, message: `个人简介不能超过 ${PROFILE_LIMITS.bio} 个字符` }]}
                  >
                    <Input.TextArea
                      rows={5}
                      maxLength={PROFILE_LIMITS.bio}
                      showCount
                      placeholder="写一点你的兴趣、擅长方向或想和大家说的话"
                    />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" loading={savingProfile} disabled={!profileDirty}>
                    保存资料
                  </Button>
                </Form>

              </Card>

              <Card className="rounded-[30px] border-slate-100 shadow-sm">
                <div className="mb-6 flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef5ff] text-lg text-[#2a6df4]">
                    <SafetyCertificateOutlined />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-900">账户安全</div>
                    <p className="mt-2 text-sm leading-7 text-slate-500">
                      建议定期更换密码。新密码至少 6 位，并同时包含字母和数字。
                    </p>
                  </div>
                </div>

                <Form<ChangePasswordPayload>
                  form={passwordForm}
                  layout="vertical"
                  onFinish={(values) => void handleChangePassword(values)}
                >
                  <Row gutter={[16, 0]}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="currentPassword"
                        label="当前密码"
                        rules={[{ required: true, message: "请输入当前密码" }]}
                      >
                        <Input.Password prefix={<LockOutlined />} autoComplete="current-password" placeholder="请输入当前密码" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="newPassword"
                        label="新密码"
                        rules={[{ required: true, message: "请输入新密码" }, { validator: validateNewPassword }]}
                      >
                        <Input.Password prefix={<LockOutlined />} autoComplete="new-password" placeholder="请输入新密码" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="confirmPassword"
                    label="确认新密码"
                    dependencies={["newPassword"]}
                    rules={[
                      { required: true, message: "请再次输入新密码" },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue("newPassword") === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error("两次输入的新密码不一致"));
                        },
                      }),
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined />} autoComplete="new-password" placeholder="请再次输入新密码" />
                  </Form.Item>

                  <Space>
                    <Button type="primary" htmlType="submit" loading={savingPassword}>
                      更新密码
                    </Button>
                    <Button onClick={() => passwordForm.resetFields()}>清空</Button>
                  </Space>
                </Form>

                <div className="my-7 border-t border-slate-100" />
                <div className="mb-5">
                  <div className="font-semibold text-slate-900">更换登录邮箱</div>
                  <div className="mt-1 text-sm text-slate-500">
                    当前邮箱：{user?.email || "未绑定邮箱"}。更换成功后需要重新登录。
                  </div>
                </div>
                <Form<ChangeEmailPayload>
                  form={emailForm}
                  layout="vertical"
                  onFinish={(values) => void handleChangeEmail(values)}
                >
                  <Row gutter={[16, 0]}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="currentPassword"
                        label="当前密码"
                        rules={[{ required: true, message: "请输入当前密码" }]}
                      >
                        <Input.Password
                          prefix={<LockOutlined />}
                          autoComplete="current-password"
                          placeholder="请输入当前密码"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="newEmail"
                        label="新邮箱"
                        normalize={(value) =>
                          typeof value === "string" ? value.trim().toLowerCase() : value
                        }
                        rules={[
                          { required: true, message: "请输入新邮箱" },
                          { type: "email", message: "请输入正确的邮箱格式" },
                        ]}
                      >
                        <Input
                          prefix={<MailOutlined />}
                          type="email"
                          autoComplete="email"
                          placeholder="请输入新邮箱"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item
                    name="emailCode"
                    label="新邮箱验证码"
                    normalize={(value) =>
                      typeof value === "string"
                        ? value.replace(/\D/g, "").slice(0, 6)
                        : value
                    }
                    rules={[
                      { required: true, message: "请输入邮箱验证码" },
                      { len: 6, message: "请输入 6 位邮箱验证码" },
                    ]}
                  >
                    <Input
                      prefix={<SafetyCertificateOutlined />}
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="one-time-code"
                      placeholder="请输入邮箱验证码"
                      addonAfter={
                        <Button
                          type="link"
                          size="small"
                          loading={sendingEmailCode}
                          disabled={sendingEmailCode || emailCodeCountdown > 0}
                          onClick={() => void handleSendEmailChangeCode()}
                        >
                          {emailCodeCountdown > 0 ? `${emailCodeCountdown}s` : "发送"}
                        </Button>
                      }
                    />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={savingEmail}>
                    验证并更换邮箱
                  </Button>
                </Form>
              </Card>
            </div>
          </Col>
        </Row>

        <Card className="rounded-[30px] border-slate-100 shadow-sm" loading={loadingContent}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">我的内容</div>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                这里会聚合你最近发过和收藏过的帖子，方便快速回到常用内容。
              </p>
            </div>
            <Button onClick={() => void loadMyContent()} loading={loadingContent}>
              刷新内容
            </Button>
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <div className="rounded-[26px] bg-[linear-gradient(180deg,#f7fbff,#eef5ff)] p-5">
                <div className="flex items-center gap-3 text-slate-800">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#2a6df4] shadow-sm">
                    <MessageOutlined />
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">我的帖子</div>
                    <div className="text-2xl font-semibold text-slate-900">{formatCount(myPostCount)}</div>
                  </div>
                </div>
                <Link to="/forum?view=mine" className="mt-4 inline-flex items-center text-sm text-[#2a6df4]">
                  查看全部
                </Link>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div className="rounded-[26px] bg-[linear-gradient(180deg,#fffaf2,#fff3df)] p-5">
                <div className="flex items-center gap-3 text-slate-800">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#d48806] shadow-sm">
                    <StarOutlined />
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">我的收藏</div>
                    <div className="text-2xl font-semibold text-slate-900">{formatCount(favoritePostCount)}</div>
                  </div>
                </div>
                <Link to="/forum?view=favorites" className="mt-4 inline-flex items-center text-sm text-[#d48806]">
                  查看全部
                </Link>
              </div>
            </Col>
            <Col xs={24} md={8}>
              <div className="rounded-[26px] bg-[linear-gradient(180deg,#f8f8ff,#f1f0ff)] p-5">
                <div className="flex items-center gap-3 text-slate-800">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#7c3aed] shadow-sm">
                    <EditOutlined />
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">资料完整度</div>
                    <div className="text-2xl font-semibold text-slate-900">{profileCompletionRate}%</div>
                  </div>
                </div>
                <div className="mt-4 text-sm text-slate-500">上传头像和补充简介后，站内展示会更完整。</div>
              </div>
            </Col>
          </Row>

          <Row gutter={[20, 20]} className="mt-6">
            <Col xs={24} xl={12}>
              <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-slate-900">最近发布</div>
                  <Link to="/forum?view=mine" className="text-sm text-[#2a6df4]">
                    更多
                  </Link>
                </div>

                {myPosts.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="你还没有发布帖子" />
                ) : (
                  <div className="space-y-3">
                    {myPosts.slice(0, 3).map((item) => (
                      <Link
                        key={item.id}
                        to={`/forum?view=mine&post=${item.id}`}
                        className="block rounded-2xl border border-white bg-white px-4 py-4 transition hover:border-[#d9e4f4]"
                      >
                        <div className="text-sm font-medium text-slate-900">{item.title}</div>
                        <div className="mt-2 text-xs text-slate-400">{formatDateTime(item.createTime)}</div>
                        <div className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">{item.content}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Col>

            <Col xs={24} xl={12}>
              <div className="rounded-[26px] border border-slate-100 bg-slate-50 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-slate-900">最近收藏</div>
                  <Link to="/forum?view=favorites" className="text-sm text-[#d48806]">
                    更多
                  </Link>
                </div>

                {favoritePosts.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="你还没有收藏帖子" />
                ) : (
                  <div className="space-y-3">
                    {favoritePosts.slice(0, 3).map((item) => (
                      <Link
                        key={item.id}
                        to={`/forum?view=favorites&post=${item.id}`}
                        className="block rounded-2xl border border-white bg-white px-4 py-4 transition hover:border-[#f0dfb5]"
                      >
                        <div className="text-sm font-medium text-slate-900">{item.title}</div>
                        <div className="mt-2 text-xs text-slate-400">
                          {item.author} · {formatDateTime(item.createTime)}
                        </div>
                        <div className="mt-2 line-clamp-2 text-sm leading-7 text-slate-600">{item.content}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Card>

        <Card className="rounded-[30px] border-slate-100 shadow-sm">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-slate-900">最近登录记录</div>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                这里会展示当前账号最近的登录行为，便于你快速发现异常登录。
              </p>
            </div>
            <Button onClick={() => void loadLoginRecords()} loading={loadingRecords}>
              刷新记录
            </Button>
          </div>

          {loginRecords.length === 0 && !loadingRecords ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无登录记录" />
          ) : (
            <List<LoginRecord>
              loading={loadingRecords}
              dataSource={loginRecords}
              renderItem={(item) => (
                <List.Item className="px-0">
                  <div className="w-full rounded-3xl border border-slate-100 bg-slate-50 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Space wrap>
                        <Tag color={item.loginStatus === "SUCCESS" ? "green" : "red"}>
                          {item.loginStatus === "SUCCESS" ? "登录成功" : "登录失败"}
                        </Tag>
                        <Tag>{getDeviceLabel(item.deviceType)}</Tag>
                        <span className="text-sm text-slate-500">{formatDateTime(item.createTime)}</span>
                      </Space>
                      <span className="text-sm text-slate-500">{item.ipAddress || "未知 IP"}</span>
                    </div>
                    <div className="mt-3 text-sm text-slate-700">登录标识: {item.loginIdentity || "-"}</div>
                    <div className="mt-2 text-xs leading-6 text-slate-500">
                      {item.userAgent || "未记录浏览器信息"}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </Card>

        <AvatarCropModal
          file={avatarSourceFile}
          uploading={uploadingAvatar}
          onCancel={() => setAvatarSourceFile(null)}
          onConfirm={handleAvatarUpload}
          onError={(error) => message.error(getFriendlyMessage(error, "头像裁剪失败"))}
        />
      </div>
    </MainLayout>
  );
}

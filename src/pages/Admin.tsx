import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Switch, Table, Tag, Upload, message } from "antd";
import type { UploadProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AreaChartOutlined,
  AuditOutlined,
  BellOutlined,
  DownloadOutlined,
  KeyOutlined,
  NotificationOutlined,
  QrcodeOutlined,
  SafetyOutlined,
  TeamOutlined,
  UploadOutlined,
} from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";
import { useAuth } from "../context/useAuth";
import { adminApi, downloadApi } from "../services/api";
import type {
  AdminOperationLog,
  AdminPostReport,
  AdminUpdateUserPayload,
  CreateDownloadResourcePayload,
  DownloadResource,
  InviteCode,
  ReviewPostReportPayload,
  SaveSiteNoticePayload,
  SiteAnalyticsOverview,
  SiteNotice,
  User,
} from "../types/app";

const roleLabel = (role?: string) => {
  if (role === "OWNER") return "网站拥有人";
  if (role === "ADMIN") return "管理员";
  return "普通用户";
};

const roleColor = (role?: string) => {
  if (role === "OWNER") return "purple";
  if (role === "ADMIN") return "gold";
  return "blue";
};

const reportColor = (status?: string) => {
  if (status === "RESOLVED") return "green";
  if (status === "REJECTED") return "red";
  return "orange";
};

const reportLabel = (status?: string) => {
  if (status === "RESOLVED") return "已处理";
  if (status === "REJECTED") return "已驳回";
  return "待处理";
};

const inviteLabel = (status?: string) => {
  if (status === "USED") return "已使用";
  if (status === "EXPIRED") return "已过期";
  return "可用";
};

const actionLabel = (value?: string) =>
  ({
    USER_UPDATED: "更新用户",
    USER_DELETED: "删除用户",
    INVITE_CREATED: "生成邀请码",
    INVITE_DELETED: "删除邀请码",
    DOWNLOAD_CREATED: "新增下载",
    DOWNLOAD_FILE_UPLOADED: "上传下载文件",
    DOWNLOAD_DELETED: "删除下载",
    NOTICE_CREATED: "新增公告",
    NOTICE_UPDATED: "更新公告",
    NOTICE_DELETED: "删除公告",
    POST_REPORT_REVIEWED: "处理举报",
    QR_CREATED: "新增二维码",
    QR_UPDATED: "更新二维码",
    QR_DELETED: "删除二维码",
  })[value || ""] || value || "未知操作";

const targetLabel = (value?: string) =>
  ({
    USER: "用户",
    INVITE_CODE: "邀请码",
    DOWNLOAD: "下载资源",
    SITE_NOTICE: "站点公告",
    POST_REPORT: "帖子举报",
    QR_CODE: "二维码",
  })[value || ""] || value || "未知对象";

const textError = (error: unknown, fallback: string) =>
  error instanceof Error && /[\u4e00-\u9fa5]/.test(error.message) ? error.message : fallback;

const sortByOrder = <T extends { id: number; sortOrder?: number | null }>(items: T[]) =>
  [...items].sort((a, b) => ((a.sortOrder ?? 0) - (b.sortOrder ?? 0)) || (b.id - a.id));

const sectionItems = [
  { id: "overview", label: "数据概览", icon: <AreaChartOutlined /> },
  { id: "invite", label: "邀请码", icon: <KeyOutlined /> },
  { id: "users", label: "用户管理", icon: <TeamOutlined /> },
  { id: "downloads", label: "下载管理", icon: <DownloadOutlined /> },
  { id: "notices", label: "公告管理", icon: <NotificationOutlined /> },
  { id: "reports", label: "举报处理", icon: <SafetyOutlined /> },
  { id: "logs", label: "操作日志", icon: <AuditOutlined /> },
] as const;

export default function Admin() {
  const { user, isOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDownloadFile, setUploadingDownloadFile] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [downloads, setDownloads] = useState<DownloadResource[]>([]);
  const [siteNotices, setSiteNotices] = useState<SiteNotice[]>([]);
  const [analytics, setAnalytics] = useState<SiteAnalyticsOverview | null>(null);
  const [postReports, setPostReports] = useState<AdminPostReport[]>([]);
  const [operationLogs, setOperationLogs] = useState<AdminOperationLog[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingNotice, setEditingNotice] = useState<SiteNotice | null>(null);
  const [reviewingReport, setReviewingReport] = useState<AdminPostReport | null>(null);
  const [reportStatus, setReportStatus] = useState("ALL");
  const [userForm] = Form.useForm<AdminUpdateUserPayload>();
  const [inviteForm] = Form.useForm<{ count: number; expiresInDays: number }>();
  const [downloadForm] = Form.useForm<CreateDownloadResourcePayload>();
  const [noticeForm] = Form.useForm<SaveSiteNoticePayload>();
  const [reviewForm] = Form.useForm<ReviewPostReportPayload>();

  const loadAll = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const [u, i, d, n, a, r, logs] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getInviteCodes(),
        downloadApi.getDownloads(),
        adminApi.getSiteNotices(),
        adminApi.getAnalyticsOverview(),
        adminApi.getPostReports(status === "ALL" ? undefined : status),
        adminApi.getOperationLogs(40),
      ]);
      setUsers(u);
      setInviteCodes(i);
      setDownloads(sortByOrder(d));
      setSiteNotices(sortByOrder(n));
      setAnalytics(a);
      setPostReports(r);
      setOperationLogs(logs);
    } catch (error) {
      message.error(textError(error, "加载后台数据失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    inviteForm.setFieldsValue({ count: 3, expiresInDays: 7 });
    downloadForm.setFieldsValue({ locked: false, sortOrder: 0 });
    noticeForm.setFieldsValue({ published: true, sortOrder: 0 });
    void loadAll("ALL");
  }, [downloadForm, inviteForm, loadAll, noticeForm]);

  async function refreshLogs() {
    try {
      setOperationLogs(await adminApi.getOperationLogs(40));
    } catch {
      // ignore
    }
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const canManageUser = (target: User) =>
    !!user && (user.role === "OWNER" ? target.role !== "OWNER" : target.role === "USER");

  const canDeleteUser = (target: User) =>
    !!user && user.id !== target.id && (user.role === "OWNER" ? target.role !== "OWNER" : target.role === "USER");

  async function handleReportFilter(status: string) {
    setReportStatus(status);
    setLoading(true);
    try {
      setPostReports(await adminApi.getPostReports(status === "ALL" ? undefined : status));
    } catch (error) {
      message.error(textError(error, "加载举报记录失败"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvite(values: { count: number; expiresInDays: number }) {
    setSubmitting(true);
    try {
      const created = await adminApi.createInviteCodes(values);
      setInviteCodes((current) => [...created, ...current]);
      message.success(`邀请码生成成功，本次新增 ${created.length} 个`);
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "邀请码生成失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteInvite(id: number) {
    setSubmitting(true);
    try {
      await adminApi.deleteInviteCode(id);
      setInviteCodes((current) => current.filter((item) => item.id !== id));
      message.success("邀请码已删除");
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "删除邀请码失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveUser(values: AdminUpdateUserPayload) {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const updated = await adminApi.updateUser(editingUser.id, values);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setEditingUser(null);
      userForm.resetFields();
      message.success("用户资料已更新");
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "更新用户失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteUser(id: number) {
    setSubmitting(true);
    try {
      await adminApi.deleteUser(id);
      setUsers((current) => current.filter((item) => item.id !== id));
      message.success("用户已删除");
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "删除用户失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateDownload(values: CreateDownloadResourcePayload) {
    setSubmitting(true);
    try {
      const created = await adminApi.createDownload(values);
      setDownloads((current) => sortByOrder([created, ...current]));
      downloadForm.resetFields();
      downloadForm.setFieldsValue({ locked: false, sortOrder: 0 });
      message.success("下载内容新增成功");
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "下载内容新增失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadDownloadFile(file: File) {
    setUploadingDownloadFile(true);
    try {
      const uploaded = await adminApi.uploadDownloadFile(file);
      const currentTitle = String(downloadForm.getFieldValue("title") ?? "").trim();
      const autoTitle = uploaded.originalFileName.replace(/\.[^/.]+$/, "");
      downloadForm.setFieldsValue({
        title: currentTitle || autoTitle || uploaded.originalFileName,
        url: uploaded.fileUrl,
        fileSize: uploaded.fileSizeText || undefined,
      });
      message.success("文件上传成功，已自动填充下载链接和文件大小");
    } catch (error) {
      message.error(textError(error, "上传下载文件失败"));
    } finally {
      setUploadingDownloadFile(false);
    }
  }

  const handleDownloadFileBeforeUpload: UploadProps["beforeUpload"] = (file) => {
    void uploadDownloadFile(file as File);
    return false;
  };

  async function handleDeleteDownload(id: number) {
    setSubmitting(true);
    try {
      await adminApi.deleteDownload(id);
      setDownloads((current) => current.filter((item) => item.id !== id));
      message.success("下载内容已删除");
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "删除下载内容失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveNotice(values: SaveSiteNoticePayload) {
    setSubmitting(true);
    try {
      if (editingNotice) {
        const updated = await adminApi.updateSiteNotice(editingNotice.id, values);
        setSiteNotices((current) => sortByOrder(current.map((item) => (item.id === updated.id ? updated : item))));
        message.success("站点公告更新成功");
      } else {
        const created = await adminApi.createSiteNotice(values);
        setSiteNotices((current) => sortByOrder([created, ...current]));
        message.success("站点公告新增成功");
      }
      setEditingNotice(null);
      noticeForm.resetFields();
      noticeForm.setFieldsValue({ published: true, sortOrder: 0 });
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "保存站点公告失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteNotice(id: number) {
    setSubmitting(true);
    try {
      await adminApi.deleteSiteNotice(id);
      setSiteNotices((current) => current.filter((item) => item.id !== id));
      message.success("站点公告已删除");
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "删除站点公告失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(values: ReviewPostReportPayload) {
    if (!reviewingReport) return;
    setSubmitting(true);
    try {
      const updated = await adminApi.reviewPostReport(reviewingReport.id, values);
      setPostReports((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setReviewingReport(null);
      reviewForm.resetFields();
      message.success("举报处理完成");
      await refreshLogs();
    } catch (error) {
      message.error(textError(error, "处理举报失败"));
    } finally {
      setSubmitting(false);
    }
  }

  const summary = useMemo(
    () => ({
      owner: users.filter((item) => item.role === "OWNER").length,
      admin: users.filter((item) => item.role === "ADMIN").length,
    }),
    [users],
  );

  const userColumns: ColumnsType<User> = [
    {
      title: "用户",
      key: "user",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.nickname}</div>
          <div className="text-xs text-slate-500">{record.username}</div>
        </div>
      ),
    },
    { title: "角色", dataIndex: "role", render: (value) => <Tag color={roleColor(value)}>{roleLabel(value)}</Tag> },
    { title: "状态", dataIndex: "status", render: (value) => <Tag>{value === "DISABLED" ? "已禁用" : "正常"}</Tag> },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size={4}>
          {canManageUser(record) ? (
            <Button
              type="link"
              onClick={() => {
                setEditingUser(record);
                userForm.setFieldsValue({
                  nickname: record.nickname,
                  avatarUrl: record.avatarUrl ?? "",
                  bio: record.bio ?? "",
                  role: record.role === "OWNER" ? undefined : record.role,
                  status: record.status ?? "ACTIVE",
                  password: "",
                });
              }}
            >
              编辑
            </Button>
          ) : (
            <Tag>不可编辑</Tag>
          )}
          {canDeleteUser(record) ? (
            <Popconfirm title="确认删除这个用户吗？" onConfirm={() => void handleDeleteUser(record.id)}>
              <Button type="link" danger>删除</Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  const inviteColumns: ColumnsType<InviteCode> = [
    { title: "邀请码", dataIndex: "code", render: (value) => <code>{value}</code> },
    { title: "状态", dataIndex: "status", render: (value) => <Tag>{inviteLabel(value)}</Tag> },
    { title: "使用者", dataIndex: "usedByNickname", render: (value) => value || "未使用" },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Popconfirm title="确认删除这个邀请码吗？" onConfirm={() => void handleDeleteInvite(record.id)}>
          <Button type="link" danger>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  const downloadColumns: ColumnsType<DownloadResource> = [
    {
      title: "资源",
      key: "title",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.title}</div>
          <div className="text-xs text-slate-500">{record.category || "未分类"} {record.version || ""}</div>
        </div>
      ),
    },
    { title: "文件大小", dataIndex: "fileSize", render: (value) => value || "-" },
    { title: "下载数", dataIndex: "downloadCount", render: (value) => value ?? 0 },
    { title: "方式", dataIndex: "locked", render: (value) => <Tag color={value ? "orange" : "green"}>{value ? "验证后下载" : "直接下载"}</Tag> },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Popconfirm title="确认删除这个下载内容吗？" onConfirm={() => void handleDeleteDownload(record.id)}>
          <Button type="link" danger>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  const noticeColumns: ColumnsType<SiteNotice> = [
    {
      title: "公告",
      dataIndex: "title",
      render: (value, record) => (
        <div>
          <div className="font-medium text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{record.content}</div>
        </div>
      ),
    },
    { title: "状态", dataIndex: "published", render: (value) => <Tag>{value ? "已发布" : "未发布"}</Tag> },
    { title: "排序", dataIndex: "sortOrder", render: (value) => value ?? 0 },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            onClick={() => {
              setEditingNotice(record);
              noticeForm.setFieldsValue({
                title: record.title,
                content: record.content,
                published: record.published,
                sortOrder: record.sortOrder ?? 0,
              });
            }}
          >
            编辑
          </Button>
          <Popconfirm title="确认删除这条公告吗？" onConfirm={() => void handleDeleteNotice(record.id)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const reportColumns: ColumnsType<AdminPostReport> = [
    {
      title: "帖子",
      key: "post",
      render: (_, record) => (
        <div>
          <div className="font-medium text-slate-900">{record.postTitle}</div>
          <div className="text-xs text-slate-500">{record.reporterName}</div>
        </div>
      ),
    },
    { title: "原因", dataIndex: "reason" },
    { title: "状态", dataIndex: "status", render: (value) => <Tag color={reportColor(value)}>{reportLabel(value)}</Tag> },
    { title: "处理备注", dataIndex: "reviewNote", render: (value) => value || "-" },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            setReviewingReport(record);
            reviewForm.setFieldsValue({
              status: record.status === "RESOLVED" || record.status === "REJECTED" ? record.status : "RESOLVED",
              reviewNote: record.reviewNote ?? "",
            });
          }}
        >
          处理
        </Button>
      ),
    },
  ];

  const logColumns: ColumnsType<AdminOperationLog> = [
    { title: "操作人", dataIndex: "operatorName" },
    { title: "动作", dataIndex: "actionType", render: (value) => <Tag>{actionLabel(value)}</Tag> },
    { title: "对象", key: "target", render: (_, record) => `${targetLabel(record.targetType)} / ${record.targetName || "-"}` },
    { title: "说明", dataIndex: "detail", render: (value) => value || "-" },
    { title: "时间", dataIndex: "createTime", render: (value) => value || "-" },
  ];

  return (
    <MainLayout>
      <div className="space-y-8 py-8 md:py-10">
        <Card className="rounded-[32px] border-slate-100 shadow-sm">
          <div className="space-y-4">
            <div>
              <div className="text-sm uppercase tracking-[0.24em] text-slate-400">Admin Console</div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">管理后台</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                网站拥有人可以授权管理员，管理员只能管理普通用户，不能删除或修改网站拥有人。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Tag color="purple">网站拥有人 {summary.owner} 人</Tag>
              <Tag color="gold">管理员 {summary.admin} 人</Tag>
              <Tag color="cyan">站点总访问 {analytics?.totalVisits ?? 0}</Tag>
              {isOwner ? <Tag color="blue">你当前拥有管理员授权权限</Tag> : null}
              <Button type="primary" icon={<QrcodeOutlined />} href="/admin/qrcodes">二维码管理</Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-8 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-24 xl:self-start">
            <Card className="rounded-[28px] border-slate-100 shadow-sm">
              <div className="mb-4 text-sm font-semibold text-slate-900">快捷跳转</div>
              <div className="space-y-3">
                {sectionItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-[#d5e3ff] hover:bg-[#f5f8ff]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf4ff] text-[#2a6df4]">
                      {item.icon}
                    </span>
                    <span className="text-sm font-medium text-slate-900">{item.label}</span>
                  </button>
                ))}
              </div>
            </Card>
          </aside>

          <div className="space-y-10">
            <section id="overview" className="scroll-mt-24">
              <div className="mb-4 text-xl font-semibold text-slate-900">数据概览</div>
              <Row gutter={[20, 20]}>
                <Col xs={24} md={12} xl={6}><Card className="rounded-[24px] border-slate-100 shadow-sm">总访问量<div className="mt-3 text-3xl font-semibold">{analytics?.totalVisits ?? 0}</div></Card></Col>
                <Col xs={24} md={12} xl={6}><Card className="rounded-[24px] border-slate-100 shadow-sm">独立访客<div className="mt-3 text-3xl font-semibold">{analytics?.uniqueVisitors ?? 0}</div></Card></Col>
                <Col xs={24} md={12} xl={6}><Card className="rounded-[24px] border-slate-100 shadow-sm">今日访问<div className="mt-3 text-3xl font-semibold">{analytics?.todayVisits ?? 0}</div></Card></Col>
                <Col xs={24} md={12} xl={6}><Card className="rounded-[24px] border-slate-100 shadow-sm">登录访问<div className="mt-3 text-3xl font-semibold">{analytics?.authenticatedVisits ?? 0}</div></Card></Col>
              </Row>
            </section>

            <section id="invite" className="scroll-mt-24">
              <div className="mb-4 text-xl font-semibold text-slate-900">邀请码管理</div>
              <Row gutter={[24, 24]}>
                <Col xs={24} xl={9}>
                  <Card className="rounded-[28px] border-slate-100 shadow-sm">
                    <Form form={inviteForm} layout="vertical" onFinish={(values) => void handleCreateInvite(values)}>
                      <Form.Item name="count" label="生成数量" rules={[{ required: true, message: "请输入生成数量" }]}>
                        <InputNumber min={1} max={20} className="w-full" />
                      </Form.Item>
                      <Form.Item name="expiresInDays" label="有效期（天）" rules={[{ required: true, message: "请输入有效期" }]}>
                        <InputNumber min={1} max={90} className="w-full" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={submitting}>生成邀请码</Button>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} xl={15}>
                  <Card className="rounded-[28px] border-slate-100 shadow-sm">
                    <Table<InviteCode> rowKey="id" loading={loading} columns={inviteColumns} dataSource={inviteCodes} pagination={{ pageSize: 5 }} scroll={{ x: 640 }} />
                  </Card>
                </Col>
              </Row>
            </section>

            <section id="users" className="scroll-mt-24">
              <div className="mb-4 text-xl font-semibold text-slate-900">用户管理</div>
              <Card className="rounded-[28px] border-slate-100 shadow-sm">
                <Table<User> rowKey="id" loading={loading} columns={userColumns} dataSource={users} pagination={{ pageSize: 6 }} scroll={{ x: 760 }} />
              </Card>
            </section>

            <section id="downloads" className="scroll-mt-24">
              <div className="mb-4 text-xl font-semibold text-slate-900">下载管理</div>
              <Row gutter={[24, 24]}>
                <Col xs={24} xl={9}>
                  <Card className="rounded-[28px] border-slate-100 shadow-sm">
                    <Form form={downloadForm} layout="vertical" onFinish={(values) => void handleCreateDownload(values)}>
                      <Form.Item name="title" label="资源名称" rules={[{ required: true, message: "请输入资源名称" }]}>
                        <Input />
                      </Form.Item>
                      <Row gutter={12}>
                        <Col span={12}><Form.Item name="category" label="分类"><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="version" label="版本"><Input /></Form.Item></Col>
                      </Row>
                      <Form.Item label="上传文件（自动填充链接与大小）">
                        <Upload beforeUpload={handleDownloadFileBeforeUpload} showUploadList={false} maxCount={1}>
                          <Button icon={<UploadOutlined />} loading={uploadingDownloadFile} disabled={submitting}>
                            选择文件并上传到服务器
                          </Button>
                        </Upload>
                      </Form.Item>
                      <Form.Item name="url" label="下载链接" rules={[{ required: true, message: "请输入下载链接" }]}>
                        <Input />
                      </Form.Item>
                      <Row gutter={12}>
                        <Col span={12}><Form.Item name="fileSize" label="文件大小"><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="sortOrder" label="排序值"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                      </Row>
                      <Form.Item name="checksumSha256" label="SHA256 校验值"><Input /></Form.Item>
                      <Form.Item name="changelog" label="更新说明"><Input.TextArea rows={4} /></Form.Item>
                      <Form.Item name="locked" label="需要验证码下载" valuePropName="checked"><Switch /></Form.Item>
                      <Button type="primary" htmlType="submit" loading={submitting}>新增下载内容</Button>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} xl={15}>
                  <Card className="rounded-[28px] border-slate-100 shadow-sm">
                    <Table<DownloadResource> rowKey="id" loading={loading} columns={downloadColumns} dataSource={downloads} pagination={{ pageSize: 5 }} scroll={{ x: 760 }} />
                  </Card>
                </Col>
              </Row>
            </section>

            <section id="notices" className="scroll-mt-24">
              <div className="mb-4 text-xl font-semibold text-slate-900">公告管理</div>
              <Row gutter={[24, 24]}>
                <Col xs={24} xl={9}>
                  <Card className="rounded-[28px] border-slate-100 shadow-sm">
                    <Form form={noticeForm} layout="vertical" onFinish={(values) => void handleSaveNotice(values)}>
                      <Form.Item name="title" label="公告标题" rules={[{ required: true, message: "请输入公告标题" }]}>
                        <Input />
                      </Form.Item>
                      <Form.Item name="content" label="公告内容" rules={[{ required: true, message: "请输入公告内容" }]}>
                        <Input.TextArea rows={5} />
                      </Form.Item>
                      <Form.Item name="sortOrder" label="排序值"><InputNumber min={0} className="w-full" /></Form.Item>
                      <Form.Item name="published" label="立即发布" valuePropName="checked"><Switch /></Form.Item>
                      <Space>
                        <Button type="primary" htmlType="submit" loading={submitting}>{editingNotice ? "保存公告" : "新增公告"}</Button>
                        {editingNotice ? (
                          <Button
                            onClick={() => {
                              setEditingNotice(null);
                              noticeForm.resetFields();
                              noticeForm.setFieldsValue({ published: true, sortOrder: 0 });
                            }}
                          >
                            取消编辑
                          </Button>
                        ) : null}
                      </Space>
                    </Form>
                  </Card>
                </Col>
                <Col xs={24} xl={15}>
                  <Card className="rounded-[28px] border-slate-100 shadow-sm">
                    <Table<SiteNotice> rowKey="id" loading={loading} columns={noticeColumns} dataSource={siteNotices} pagination={{ pageSize: 5 }} scroll={{ x: 760 }} />
                  </Card>
                </Col>
              </Row>
            </section>

            <section id="reports" className="scroll-mt-24">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xl font-semibold text-slate-900">举报处理</div>
                <Space>
                  <Select
                    value={reportStatus}
                    onChange={(value) => void handleReportFilter(value)}
                    style={{ width: 150 }}
                    options={[
                      { label: "全部状态", value: "ALL" },
                      { label: "待处理", value: "PENDING" },
                      { label: "已处理", value: "RESOLVED" },
                      { label: "已驳回", value: "REJECTED" },
                    ]}
                  />
                  <Button icon={<BellOutlined />} onClick={() => void loadAll(reportStatus)}>刷新</Button>
                </Space>
              </div>
              <Card className="rounded-[28px] border-slate-100 shadow-sm">
                <Table<AdminPostReport> rowKey="id" loading={loading} columns={reportColumns} dataSource={postReports} pagination={{ pageSize: 6 }} scroll={{ x: 900 }} locale={{ emptyText: "暂无举报记录" }} />
              </Card>
            </section>

            <section id="logs" className="scroll-mt-24">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xl font-semibold text-slate-900">操作日志</div>
                <Button icon={<AuditOutlined />} onClick={() => void refreshLogs()}>刷新日志</Button>
              </div>
              <Card className="rounded-[28px] border-slate-100 shadow-sm">
                <Table<AdminOperationLog> rowKey="id" loading={loading} columns={logColumns} dataSource={operationLogs} pagination={{ pageSize: 8 }} scroll={{ x: 960 }} locale={{ emptyText: "暂无操作日志" }} />
              </Card>
            </section>
          </div>
        </div>

        <Modal title={editingUser ? `编辑用户：${editingUser.nickname}` : "编辑用户"} open={Boolean(editingUser)} onCancel={() => setEditingUser(null)} footer={null} destroyOnClose>
          <Form form={userForm} layout="vertical" onFinish={(values) => void handleSaveUser(values)}>
            <Form.Item name="nickname" label="昵称" rules={[{ required: true, message: "请输入昵称" }]}><Input /></Form.Item>
            <Form.Item name="avatarUrl" label="头像链接"><Input /></Form.Item>
            <Form.Item name="bio" label="简介"><Input.TextArea rows={4} /></Form.Item>
            <Form.Item name="status" label="状态"><Select options={[{ label: "正常", value: "ACTIVE" }, { label: "禁用", value: "DISABLED" }]} /></Form.Item>
            {isOwner ? <Form.Item name="role" label="角色"><Select options={[{ label: "普通用户", value: "USER" }, { label: "管理员", value: "ADMIN" }]} /></Form.Item> : null}
            <Form.Item name="password" label="重置密码"><Input.Password placeholder="留空则保持原密码" /></Form.Item>
            <Space><Button onClick={() => setEditingUser(null)}>取消</Button><Button type="primary" htmlType="submit" loading={submitting}>保存</Button></Space>
          </Form>
        </Modal>

        <Modal title={reviewingReport ? `处理举报：${reviewingReport.postTitle}` : "处理举报"} open={Boolean(reviewingReport)} onCancel={() => setReviewingReport(null)} footer={null} destroyOnClose>
          <Form form={reviewForm} layout="vertical" onFinish={(values) => void handleReview(values)}>
            <Form.Item name="status" label="处理结果" rules={[{ required: true, message: "请选择处理结果" }]}>
              <Select options={[{ label: "已处理", value: "RESOLVED" }, { label: "已驳回", value: "REJECTED" }, { label: "恢复待处理", value: "PENDING" }]} />
            </Form.Item>
            <Form.Item name="reviewNote" label="处理备注"><Input.TextArea rows={4} /></Form.Item>
            <Space><Button onClick={() => setReviewingReport(null)}>取消</Button><Button type="primary" htmlType="submit" loading={submitting}>保存处理结果</Button></Space>
          </Form>
        </Modal>
      </div>
    </MainLayout>
  );
}

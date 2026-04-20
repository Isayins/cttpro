import { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";

import MainLayout from "../layouts/MainLayout";
import { adminApi } from "../services/api";
import logo from "../store/images/idncar.png";
import type { QrCodeItem, QrScanLog, SaveQrCodePayload } from "../types/app";

function getFriendlyMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) return fallback;
  return /[\u4e00-\u9fa5]/.test(error.message) ? error.message : fallback;
}

function buildShortLink(shortCode: string) {
  return `${window.location.origin}/q/${shortCode}`;
}

function getPreviewUrl(shortCode: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=16&color=32-76-214&data=${encodeURIComponent(buildShortLink(shortCode))}`;
}

export default function QrManage() {
  const [items, setItems] = useState<QrCodeItem[]>([]);
  const [logs, setLogs] = useState<QrScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<QrCodeItem | null>(null);
  const [previewItem, setPreviewItem] = useState<QrCodeItem | null>(null);
  const [logItem, setLogItem] = useState<QrCodeItem | null>(null);
  const [form] = Form.useForm<SaveQrCodePayload>();

  useEffect(() => {
    void loadQrCodes();
  }, []);

  async function loadQrCodes() {
    setLoading(true);
    try {
      setItems(await adminApi.getQrCodes());
    } catch (error) {
      message.error(getFriendlyMessage(error, "加载二维码列表失败"));
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingItem(null);
    setEditorOpen(true);
    form.resetFields();
    form.setFieldsValue({
      status: "ACTIVE",
      loginRequired: false,
      accessCodeRequired: false,
    });
  }

  function openEdit(item: QrCodeItem) {
    setEditingItem(item);
    setEditorOpen(true);
    form.setFieldsValue({
      title: item.title,
      description: item.description ?? "",
      shortCode: item.shortCode,
      targetUrl: item.targetUrl,
      status: item.status === "DISABLED" ? "DISABLED" : "ACTIVE",
      loginRequired: item.loginRequired,
      accessCodeRequired: item.accessCodeRequired,
      accessCode: "",
      expiresAt: item.expiresAt ?? "",
    });
  }

  async function handleSave(values: SaveQrCodePayload) {
    setSubmitting(true);
    try {
      const payload: SaveQrCodePayload = {
        ...values,
        title: values.title.trim(),
        description: values.description?.trim(),
        shortCode: values.shortCode?.trim(),
        targetUrl: values.targetUrl.trim(),
        accessCode: values.accessCode?.trim(),
        expiresAt: values.expiresAt?.trim(),
      };
      const saved = editingItem
        ? await adminApi.updateQrCode(editingItem.id, payload)
        : await adminApi.createQrCode(payload);
      setItems((current) => {
        const next = editingItem
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
        return next.sort((a, b) => b.id - a.id);
      });
      message.success(editingItem ? "二维码更新成功" : "二维码创建成功");
      setEditorOpen(false);
      setEditingItem(null);
      form.resetFields();
    } catch (error) {
      message.error(getFriendlyMessage(error, editingItem ? "二维码更新失败" : "二维码创建失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(item: QrCodeItem) {
    setSubmitting(true);
    try {
      await adminApi.deleteQrCode(item.id);
      setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
      message.success("二维码已删除");
    } catch (error) {
      message.error(getFriendlyMessage(error, "删除二维码失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function openLogs(item: QrCodeItem) {
    setLogItem(item);
    try {
      setLogs(await adminApi.getQrScanLogs(item.id, 20));
    } catch (error) {
      message.error(getFriendlyMessage(error, "加载扫码记录失败"));
    }
  }

  async function copyText(text: string, successText: string) {
    try {
      await navigator.clipboard.writeText(text);
      message.success(successText);
    } catch {
      message.warning("复制失败，请手动复制");
    }
  }

  const totalScanCount = useMemo(
    () => items.reduce((sum, item) => sum + (item.scanCount ?? 0), 0),
    [items],
  );

  const columns: ColumnsType<QrCodeItem> = [
    {
      title: "二维码",
      key: "qr",
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-slate-100 bg-white p-1">
            <img src={getPreviewUrl(record.shortCode)} alt={record.title} className="h-full w-full rounded-xl object-cover" />
            <img src={logo} alt="IDNCAR" className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-md border border-white bg-white p-[2px]" />
          </div>
          <div>
            <div className="font-medium text-slate-900">{record.title}</div>
            <div className="text-xs text-slate-500">/q/{record.shortCode}</div>
          </div>
        </div>
      ),
    },
    {
      title: "权限",
      key: "rules",
      render: (_, record) => (
        <Space wrap>
          <Tag color={record.status === "ACTIVE" ? "green" : "red"}>{record.status === "ACTIVE" ? "启用中" : "已停用"}</Tag>
          {record.loginRequired ? <Tag color="gold">需要登录</Tag> : <Tag>公开访问</Tag>}
          {record.accessCodeRequired ? <Tag color="orange">访问验证码</Tag> : null}
          {record.expiresAt ? <Tag>到期：{record.expiresAt}</Tag> : null}
        </Space>
      ),
    },
    {
      title: "统计",
      key: "stats",
      render: (_, record) => (
        <div className="text-sm text-slate-600">
          <div>总扫码：{record.scanCount ?? 0}</div>
          <div>今日扫码：{record.todayScanCount ?? 0}</div>
          <div>最近：{record.lastScanTime || "-"}</div>
        </div>
      ),
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space wrap size={4}>
          <Button type="link" onClick={() => setPreviewItem(record)}>预览</Button>
          <Button type="link" onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" onClick={() => void openLogs(record)}>记录</Button>
          <Button type="link" onClick={() => void copyText(buildShortLink(record.shortCode), "短链已复制")}>复制短链</Button>
          <Popconfirm title="确认删除这个二维码吗？" onConfirm={() => void handleDelete(record)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColumns: ColumnsType<QrScanLog> = [
    { title: "时间", dataIndex: "createTime", render: (value) => value || "-" },
    { title: "访客", key: "visitor", render: (_, record) => record.nickname || record.visitorId || "-" },
    { title: "来源", dataIndex: "source", render: (value) => value || "-" },
    { title: "设备", dataIndex: "deviceType", render: (value) => value || "-" },
    { title: "IP", dataIndex: "ipAddress", render: (value) => value || "-" },
  ];

  return (
    <MainLayout>
      <div className="space-y-8 py-8 md:py-10">
        <Card className="rounded-[30px] border-slate-100 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.24em] text-slate-400">QR Center</div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">品牌二维码管理</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                支持动态短链、扫码统计、过期控制、登录后访问和访问验证码。生成后二维码短链固定，目标地址以后也能继续改。
              </p>
            </div>
            <Space>
              <Button onClick={() => void loadQrCodes()}>刷新列表</Button>
              <Button type="primary" onClick={openCreate}>新建二维码</Button>
            </Space>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Tag color="blue">二维码数量 {items.length}</Tag>
            <Tag color="cyan">累计扫码 {totalScanCount}</Tag>
          </div>
        </Card>

        <Card className="rounded-[30px] border-slate-100 shadow-sm">
          <Table<QrCodeItem>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={items}
            pagination={{ pageSize: 6 }}
            scroll={{ x: 960 }}
            locale={{ emptyText: "还没有创建二维码" }}
          />
        </Card>
      </div>

      <Modal title={editingItem ? "编辑二维码" : "新建二维码"} open={editorOpen} onCancel={() => setEditorOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)}>
          <Form.Item name="title" label="二维码标题" rules={[{ required: true, message: "请输入二维码标题" }]}>
            <Input placeholder="例如：官网首页引流码" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} placeholder="可选，用于后台备注和预览说明" />
          </Form.Item>
          <Form.Item name="shortCode" label="短码">
            <Input placeholder="留空自动生成，例如 home2026" />
          </Form.Item>
          <Form.Item name="targetUrl" label="目标链接" rules={[{ required: true, message: "请输入目标链接" }]}>
            <Input placeholder="https://idncar.com/downloads 或 /downloads" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[{ label: "启用", value: "ACTIVE" }, { label: "停用", value: "DISABLED" }]} />
          </Form.Item>
          <Form.Item name="loginRequired" label="需要登录后访问" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="accessCodeRequired" label="需要访问验证码" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, next) => prev.accessCodeRequired !== next.accessCodeRequired}>
            {({ getFieldValue }) =>
              getFieldValue("accessCodeRequired") ? (
                <Form.Item name="accessCode" label="访问验证码">
                  <Input placeholder="编辑时留空则保持原验证码" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item name="expiresAt" label="过期时间">
            <Input placeholder="可选，格式：2026-12-31 23:59:59" />
          </Form.Item>
          <Space>
            <Button onClick={() => setEditorOpen(false)}>取消</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>保存</Button>
          </Space>
        </Form>
      </Modal>

      <Modal title={previewItem ? `二维码预览：${previewItem.title}` : "二维码预览"} open={Boolean(previewItem)} onCancel={() => setPreviewItem(null)} footer={null}>
        {previewItem ? (
          <div className="space-y-4 text-center">
            <div className="relative mx-auto h-72 w-72 rounded-[32px] border border-slate-100 bg-white p-4 shadow-sm">
              <img src={getPreviewUrl(previewItem.shortCode)} alt={previewItem.title} className="h-full w-full rounded-[24px] object-cover" />
              <img src={logo} alt="IDNCAR" className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-4 border-white bg-white p-2 shadow-sm" />
            </div>
            <div className="text-lg font-semibold text-slate-900">{previewItem.title}</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{buildShortLink(previewItem.shortCode)}</div>
            <Space>
              <Button onClick={() => void copyText(buildShortLink(previewItem.shortCode), "短链已复制")}>复制短链</Button>
              <Button type="primary" onClick={() => window.open(buildShortLink(previewItem.shortCode), "_blank")}>打开测试</Button>
            </Space>
          </div>
        ) : null}
      </Modal>

      <Modal title={logItem ? `扫码记录：${logItem.title}` : "扫码记录"} open={Boolean(logItem)} onCancel={() => setLogItem(null)} footer={null} width={860}>
        <Table<QrScanLog> rowKey="id" columns={logColumns} dataSource={logs} pagination={{ pageSize: 6 }} locale={{ emptyText: "暂无扫码记录" }} />
      </Modal>
    </MainLayout>
  );
}

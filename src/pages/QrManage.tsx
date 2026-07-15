import { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Modal, Popconfirm, QRCode, Select, Space, Switch, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ClearOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";
import { getFriendlyMessage } from "../lib/errorMessage";
import { isAllowedWebTargetUrl } from "../lib/urlValidation";
import { adminApi } from "../services/api/admin";
import logo from "../assets/idncar-mark.svg";
import type { QrCodeItem, QrScanLog, SaveQrCodePayload } from "../types/app";

function buildShortLink(shortCode: string) {
  return `${window.location.origin}/q/${shortCode}`;
}

function validateTargetUrl(_: unknown, value?: string) {
  return isAllowedWebTargetUrl(value)
    ? Promise.resolve()
    : Promise.reject(new Error("目标链接需为 http(s) 地址或以 / 开头的站内路径"));
}

function buildQrSavePayload(item: QrCodeItem, status: "ACTIVE" | "DISABLED"): SaveQrCodePayload {
  return {
    title: item.title,
    description: item.description ?? undefined,
    shortCode: item.shortCode,
    targetUrl: item.targetUrl,
    status,
    loginRequired: item.loginRequired,
    accessCodeRequired: item.accessCodeRequired,
    expiresAt: item.expiresAt ?? undefined,
  };
}

function csvCell(value: string | number | boolean | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
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
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [form] = Form.useForm<SaveQrCodePayload>();

  useEffect(() => {
    void loadQrCodes();
  }, []);

  async function loadQrCodes() {
    setLoading(true);
    try {
      const result = await adminApi.getQrCodes();
      const availableIds = new Set(result.map((item) => item.id));
      setItems(result);
      setSelectedItemIds((current) => current.filter((id) => availableIds.has(id)));
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
      setSelectedItemIds((current) => current.filter((id) => id !== item.id));
      message.success("二维码已删除");
    } catch (error) {
      message.error(getFriendlyMessage(error, "删除二维码失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateSelectedStatus(status: "ACTIVE" | "DISABLED") {
    if (selectedItemIds.length === 0) {
      message.warning("请先勾选要处理的二维码");
      return;
    }
    const selectedIdSet = new Set(selectedItemIds);
    const targets = items.filter((item) => selectedIdSet.has(item.id) && item.status !== status);
    if (targets.length === 0) {
      message.warning(status === "ACTIVE" ? "所选二维码已经是启用状态" : "所选二维码已经是停用状态");
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.allSettled(
        targets.map((item) => adminApi.updateQrCode(item.id, buildQrSavePayload(item, status))),
      );
      const successCount = results.filter((result) => result.status === "fulfilled").length;
      const failedCount = results.length - successCount;
      if (successCount > 0) {
        message.success(`已${status === "ACTIVE" ? "启用" : "停用"} ${successCount} 个二维码${failedCount > 0 ? `，${failedCount} 个失败` : ""}`);
      } else {
        message.error(status === "ACTIVE" ? "批量启用失败" : "批量停用失败");
      }
      setSelectedItemIds([]);
      await loadQrCodes();
    } catch (error) {
      message.error(getFriendlyMessage(error, status === "ACTIVE" ? "批量启用失败" : "批量停用失败"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedItemIds.length === 0) {
      message.warning("请先勾选要删除的二维码");
      return;
    }
    const selectedIdSet = new Set(selectedItemIds);
    const targets = items.filter((item) => selectedIdSet.has(item.id));
    if (targets.length === 0) {
      message.warning("所选二维码不存在或已被删除");
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.allSettled(targets.map((item) => adminApi.deleteQrCode(item.id).then(() => item.id)));
      const deletedIds = results
        .filter((result): result is PromiseFulfilledResult<number> => result.status === "fulfilled")
        .map((result) => result.value);
      const failedCount = results.length - deletedIds.length;
      if (deletedIds.length > 0) {
        const deletedIdSet = new Set(deletedIds);
        setItems((current) => current.filter((item) => !deletedIdSet.has(item.id)));
        setSelectedItemIds([]);
        message.success(`已删除 ${deletedIds.length} 个二维码${failedCount > 0 ? `，${failedCount} 个失败` : ""}`);
      } else {
        message.error("批量删除二维码失败");
      }
    } catch (error) {
      message.error(getFriendlyMessage(error, "批量删除二维码失败"));
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

  function clearFilters() {
    setKeyword("");
    setStatusFilter("ALL");
  }

  function selectFilteredItems() {
    if (filteredItems.length === 0) {
      message.warning("当前筛选结果为空");
      return;
    }
    setSelectedItemIds(filteredItems.map((item) => item.id));
    message.success(`已选择 ${filteredItems.length} 个二维码`);
  }

  function copySelectedLinks() {
    if (selectedItems.length === 0) {
      message.warning("请先勾选要复制的二维码");
      return;
    }
    void copyText(selectedItems.map((item) => buildShortLink(item.shortCode)).join("\n"), `已复制 ${selectedItems.length} 个短链`);
  }

  function exportQrCodes() {
    const targets = selectedItems.length > 0 ? selectedItems : filteredItems;
    if (targets.length === 0) {
      message.warning("当前没有可导出的二维码");
      return;
    }
    const rows = [
      ["标题", "短码", "短链", "目标链接", "状态", "需要登录", "访问验证码", "过期时间", "累计扫码", "今日扫码", "最近扫码"].map(csvCell).join(","),
      ...targets.map((item) =>
        [
          item.title,
          item.shortCode,
          buildShortLink(item.shortCode),
          item.targetUrl,
          item.status === "ACTIVE" ? "启用" : "停用",
          item.loginRequired ? "是" : "否",
          item.accessCodeRequired ? "是" : "否",
          item.expiresAt || "",
          item.scanCount ?? 0,
          item.todayScanCount ?? 0,
          item.lastScanTime || "",
        ].map(csvCell).join(","),
      ),
    ];
    const blob = new Blob([`\uFEFF${rows.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qr-codes-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    message.success(selectedItems.length > 0 ? "已导出所选二维码" : "已导出当前筛选二维码");
  }

  const totalScanCount = useMemo(
    () => items.reduce((sum, item) => sum + (item.scanCount ?? 0), 0),
    [items],
  );
  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      const searchable = [item.title, item.description, item.shortCode, item.targetUrl].filter(Boolean).join(" ").toLowerCase();
      const matchesKeyword = !normalizedKeyword || searchable.includes(normalizedKeyword);
      return matchesStatus && matchesKeyword;
    });
  }, [items, keyword, statusFilter]);
  const selectedItems = useMemo(() => {
    const selectedIdSet = new Set(selectedItemIds);
    return items.filter((item) => selectedIdSet.has(item.id));
  }, [items, selectedItemIds]);
  const activeCount = useMemo(() => items.filter((item) => item.status === "ACTIVE").length, [items]);
  const disabledCount = items.length - activeCount;
  const hasFilters = keyword.trim() !== "" || statusFilter !== "ALL";

  const columns: ColumnsType<QrCodeItem> = [
    {
      title: "二维码",
      key: "qr",
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white p-1">
            <QRCode value={buildShortLink(record.shortCode)} size={56} color="#204cd6" icon={logo} iconSize={18} bordered={false} />
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
    <MainLayout contentWidth="wide">
      <div className="space-y-8 py-8 md:py-10">
        <Card className="rounded-[30px] border-slate-100 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm uppercase tracking-[0.24em] text-slate-400">二维码中心</div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">品牌二维码管理</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-500">
                支持动态短链、扫码统计、过期控制、登录后访问和访问验证码。生成后二维码短链固定，目标地址以后也能继续改。
              </p>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => void loadQrCodes()}>刷新列表</Button>
              <Button type="primary" onClick={openCreate}>新建二维码</Button>
            </Space>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Tag color="blue">二维码数量 {items.length}</Tag>
            <Tag color="green">启用 {activeCount}</Tag>
            <Tag color="red">停用 {disabledCount}</Tag>
            <Tag color="cyan">累计扫码 {totalScanCount}</Tag>
            {hasFilters ? <Tag color="purple">筛选 {filteredItems.length}</Tag> : null}
            {selectedItemIds.length > 0 ? <Tag color="gold">已选 {selectedItemIds.length}</Tag> : null}
          </div>
        </Card>

        <Card className="rounded-[30px] border-slate-100 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Space wrap>
              <Input.Search
                allowClear
                enterButton="搜索"
                placeholder="搜索标题、短码或目标链接"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                style={{ width: 280 }}
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 130 }}
                options={[
                  { label: "全部状态", value: "ALL" },
                  { label: "启用", value: "ACTIVE" },
                  { label: "停用", value: "DISABLED" },
                ]}
              />
              <Button onClick={selectFilteredItems} disabled={filteredItems.length === 0}>选择筛选结果</Button>
              <Button icon={<ClearOutlined />} disabled={!hasFilters} onClick={clearFilters}>清空筛选</Button>
            </Space>
            <Space wrap>
              <Button icon={<CopyOutlined />} disabled={selectedItems.length === 0} onClick={copySelectedLinks}>复制所选短链</Button>
              <Button icon={<DownloadOutlined />} disabled={filteredItems.length === 0 && selectedItems.length === 0} onClick={exportQrCodes}>导出</Button>
              <Button
                icon={<PlayCircleOutlined />}
                loading={submitting}
                disabled={selectedItems.length === 0}
                onClick={() => void handleUpdateSelectedStatus("ACTIVE")}
              >
                启用所选
              </Button>
              <Button
                icon={<PauseCircleOutlined />}
                loading={submitting}
                disabled={selectedItems.length === 0}
                onClick={() => void handleUpdateSelectedStatus("DISABLED")}
              >
                停用所选
              </Button>
              <Popconfirm
                title={`确认删除选中的 ${selectedItems.length} 个二维码吗？`}
                description="删除后短链、二维码和扫码记录入口都会失效。"
                okText="删除"
                okButtonProps={{ danger: true }}
                onConfirm={() => void handleDeleteSelected()}
                disabled={selectedItems.length === 0}
              >
                <Button danger icon={<DeleteOutlined />} loading={submitting} disabled={selectedItems.length === 0}>删除所选</Button>
              </Popconfirm>
            </Space>
          </div>
          <Table<QrCodeItem>
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={filteredItems}
            rowSelection={{
              selectedRowKeys: selectedItemIds,
              onChange: (keys) => {
                setSelectedItemIds(keys.map((key) => Number(key)).filter((key) => Number.isFinite(key)));
              },
            }}
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
          <Form.Item
            name="targetUrl"
            label="目标链接"
            rules={[
              { required: true, message: "请输入目标链接" },
              { validator: validateTargetUrl },
            ]}
          >
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
                <Form.Item
                  name="accessCode"
                  label="访问验证码"
                  rules={editingItem ? [] : [{ required: true, message: "新建需要验证码的二维码时，请填写访问验证码" }]}
                  extra={editingItem ? "编辑时留空会继续使用原验证码；填写新值则替换验证码。" : undefined}
                >
                  <Input placeholder={editingItem ? "留空保持原验证码" : "请输入访问验证码"} />
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
            <div className="mx-auto flex h-72 w-72 items-center justify-center rounded-[32px] border border-slate-100 bg-white p-4 shadow-sm">
              <QRCode value={buildShortLink(previewItem.shortCode)} size={256} color="#204cd6" icon={logo} iconSize={56} bordered={false} />
            </div>
            <div className="text-lg font-semibold text-slate-900">{previewItem.title}</div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{buildShortLink(previewItem.shortCode)}</div>
            <Space>
              <Button onClick={() => void copyText(buildShortLink(previewItem.shortCode), "短链已复制")}>复制短链</Button>
              <Button type="primary" onClick={() => window.open(buildShortLink(previewItem.shortCode), "_blank", "noopener,noreferrer")}>打开测试</Button>
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

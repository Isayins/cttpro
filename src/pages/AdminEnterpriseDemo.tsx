import { Button, Progress, Tag } from "antd";
import {
  AuditOutlined,
  BellOutlined,
  CheckCircleOutlined,
  CloudDownloadOutlined,
  CreditCardOutlined,
  GiftOutlined,
  KeyOutlined,
  LayoutOutlined,
  NotificationOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import MainLayout from "../layouts/MainLayout";

interface MetricItem {
  label: string;
  value: string;
  meta: string;
  tone: "brand" | "green" | "amber" | "blue";
  icon: ReactNode;
}

interface QueueItem {
  title: string;
  meta: string;
  tag: string;
  color: string;
}

const metrics: MetricItem[] = [
  { label: "今日订单", value: "128", meta: "+18.4% 较昨日", tone: "brand", icon: <CreditCardOutlined /> },
  { label: "活跃用户", value: "2,418", meta: "+9.2% 本周", tone: "green", icon: <TeamOutlined /> },
  { label: "待发 CDK", value: "36", meta: "8 单异常", tone: "amber", icon: <KeyOutlined /> },
  { label: "下载验证", value: "684", meta: "+31.6% 今日", tone: "blue", icon: <CloudDownloadOutlined /> },
];

const modules = [
  { label: "数据概览", icon: <LayoutOutlined />, count: "总览" },
  { label: "用户管理", icon: <TeamOutlined />, count: "2,418" },
  { label: "商品管理", icon: <ShoppingCartOutlined />, count: "32" },
  { label: "优惠码", icon: <GiftOutlined />, count: "168" },
  { label: "支付订单", icon: <CreditCardOutlined />, count: "128" },
  { label: "CDK发货", icon: <KeyOutlined />, count: "36" },
  { label: "下载管理", icon: <CloudDownloadOutlined />, count: "684" },
  { label: "二维码", icon: <QrcodeOutlined />, count: "14" },
  { label: "操作日志", icon: <AuditOutlined />, count: "今日" },
];

const queues: QueueItem[] = [
  { title: "支付成功但 CDK 未发送", meta: "ORD-240704-0819 · 3 分钟前", tag: "高优先", color: "red" },
  { title: "用户举报帖子需要复核", meta: "论坛 / 量化策略区 · 12 分钟前", tag: "待审核", color: "orange" },
  { title: "商品图上传失败重试", meta: "高级策略包 · 21 分钟前", tag: "处理中", color: "blue" },
  { title: "邀请码批量生成确认", meta: "运营活动 · 38 分钟前", tag: "可执行", color: "green" },
];

const rows = [
  { id: "ORD-0819", module: "支付订单", object: "高级策略包", user: "Chen", amount: "¥199", status: "待发货", color: "blue", owner: "发货池", updatedAt: "09:48" },
  { id: "USR-4421", module: "用户管理", object: "管理员申请", user: "Mika", amount: "-", status: "待审核", color: "gold", owner: "用户组", updatedAt: "09:36" },
  { id: "CDK-1182", module: "发货池", object: "CDK 库存", user: "Liu", amount: "36", status: "低库存", color: "orange", owner: "商品组", updatedAt: "09:23" },
  { id: "POST-773", module: "论坛", object: "举报复核", user: "匿名", amount: "-", status: "待处理", color: "blue", owner: "社区组", updatedAt: "09:12" },
  { id: "PAY-509", module: "支付订单", object: "支付宝回调", user: "Qin", amount: "¥69", status: "异常", color: "red", owner: "支付组", updatedAt: "08:57" },
];

const activities = [
  "08:52 自动同步 18 笔支付订单",
  "09:10 运营发布站点公告",
  "09:23 CDK 发货池补充 120 个",
  "09:41 2 条举报被标记为已处理",
];

const toneMap = {
  brand: "border-red-100 bg-red-50 text-red-700",
  green: "border-emerald-100 bg-emerald-50 text-emerald-700",
  amber: "border-amber-100 bg-amber-50 text-amber-700",
  blue: "border-sky-100 bg-sky-50 text-sky-700",
};

export default function AdminEnterpriseDemo() {
  return (
    <MainLayout variant="clean" contentWidth="wide" mode="workspace">
      <div className="overflow-x-hidden pb-1">
        <div className="min-h-[calc(100vh-112px)] overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/90 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.14em] text-red-600">Admin Console Demo A</div>
              <h1 className="m-0 mt-1 text-2xl font-extrabold tracking-normal text-slate-950">
                一体化管理工作台
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-6 text-slate-500">
                <span>用一个连续面板承载模块、指标、流水和待办。</span>
                <span className="hidden text-slate-300 md:inline">|</span>
                <span>09:52 已同步</span>
                <Tag color="green" className="m-0">数据正常</Tag>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/demos">
                <Button icon={<LayoutOutlined />}>候选方案</Button>
              </Link>
              <Button icon={<ReloadOutlined />}>刷新</Button>
              <Button type="primary" danger icon={<ThunderboltOutlined />}>
                处理待办
              </Button>
            </div>
          </div>

          <div className="grid xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="border-b border-slate-100 bg-slate-50/80 px-3 py-4 xl:border-b-0 xl:border-r">
              <div className="px-3 pb-3">
                <div className="text-sm font-extrabold text-slate-950">管理模块</div>
                <div className="mt-1 text-xs text-slate-500">按对象进入，减少长页面滚动</div>
              </div>
              <div className="grid gap-1">
                {modules.map((item, index) => (
                  <button
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition ${
                      index === 0
                        ? "bg-red-50 text-red-700 shadow-sm ring-1 ring-red-100"
                        : "text-slate-700 hover:bg-white"
                    }`}
                    key={item.label}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="text-base">{item.icon}</span>
                      <span className="truncate text-sm font-bold">{item.label}</span>
                    </span>
                    <span className="ml-2 rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500">{item.count}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border border-slate-100 bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">系统健康</span>
                  <Tag color="green">稳定</Tag>
                </div>
                <div className="mt-3 text-2xl font-extrabold text-slate-950">98%</div>
                <Progress percent={98} showInfo={false} strokeColor="#c4362d" />
              </div>
            </aside>

            <section className="min-w-0">
              <div className="grid border-b border-slate-100 md:grid-cols-2 2xl:grid-cols-4">
                {metrics.map((item) => (
                  <MetricCell item={item} key={item.label} />
                ))}
              </div>

              <div className="grid 2xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="min-w-0">
                  <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-lg font-extrabold text-slate-950">核心业务流水</div>
                      <div className="mt-1 text-sm text-slate-500">订单、用户、发货、举报整合到同一张工作表</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button icon={<SearchOutlined />}>搜索</Button>
                      <Button icon={<SettingOutlined />}>列设置</Button>
                    </div>
                  </div>

                  <div className="px-5 py-4">
                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                      <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500">
                          <tr>
                            <th className="px-4 py-3">编号</th>
                            <th className="px-4 py-3">模块</th>
                            <th className="px-4 py-3">对象</th>
                            <th className="px-4 py-3">用户</th>
                            <th className="px-4 py-3">金额/数量</th>
                            <th className="px-4 py-3">状态</th>
                            <th className="px-4 py-3">负责人</th>
                            <th className="px-4 py-3">更新</th>
                            <th className="px-4 py-3">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr className="border-b border-slate-100 transition hover:bg-slate-50/80 last:border-b-0" key={row.id}>
                              <td className="px-4 py-4 font-bold text-slate-950">{row.id}</td>
                              <td className="px-4 py-4 text-slate-600">{row.module}</td>
                              <td className="px-4 py-4 font-semibold text-slate-800">{row.object}</td>
                              <td className="px-4 py-4 text-slate-600">{row.user}</td>
                              <td className="px-4 py-4 text-slate-600">{row.amount}</td>
                              <td className="px-4 py-4">
                                <Tag color={row.color}>{row.status}</Tag>
                              </td>
                              <td className="px-4 py-4 text-slate-600">{row.owner}</td>
                              <td className="px-4 py-4 text-slate-500">{row.updatedAt}</td>
                              <td className="px-4 py-4">
                                <Button type="link" size="small" className="!px-0">
                                  查看
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="grid border-t border-slate-100 lg:grid-cols-3">
                    <ActionStrip icon={<CreditCardOutlined />} title="支付异常" value="3" meta="回调与发货锁定" />
                    <ActionStrip icon={<NotificationOutlined />} title="内容待审" value="7" meta="举报与公告复核" />
                    <ActionStrip icon={<BellOutlined />} title="系统提醒" value="12" meta="库存、上传、同步" />
                  </div>
                </div>

                <aside className="border-t border-slate-100 bg-slate-50/60 2xl:border-l 2xl:border-t-0">
                  <PanelSection title="待办队列" extra={<Tag color="red">4 项</Tag>}>
                    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
                      {queues.map((item) => (
                        <div className="p-4" key={item.title}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-bold text-slate-950">{item.title}</div>
                              <div className="mt-1 text-xs text-slate-500">{item.meta}</div>
                            </div>
                            <Tag color={item.color}>{item.tag}</Tag>
                          </div>
                        </div>
                      ))}
                    </div>
                  </PanelSection>

                  <PanelSection title="最近动态">
                    <div className="space-y-3">
                      {activities.map((item) => (
                        <div className="flex gap-3 text-sm" key={item}>
                          <CheckCircleOutlined className="mt-1 text-red-500" />
                          <span className="text-slate-600">{item}</span>
                        </div>
                      ))}
                    </div>
                  </PanelSection>
                </aside>
              </div>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function MetricCell({ item }: { item: MetricItem }) {
  return (
    <div className="border-b border-r border-slate-100 p-5 2xl:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{item.label}</div>
          <div className="mt-2 text-3xl font-extrabold leading-none text-slate-950">{item.value}</div>
        </div>
        <span className={`rounded-2xl border p-3 text-lg ${toneMap[item.tone]}`}>{item.icon}</span>
      </div>
      <div className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${toneMap[item.tone]}`}>
        {item.meta}
      </div>
    </div>
  );
}

function ActionStrip({ icon, title, value, meta }: { icon: ReactNode; title: string; value: string; meta: string }) {
  return (
    <div className="border-b border-slate-100 px-5 py-4 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-slate-500">{title}</div>
          <div className="mt-1 text-sm font-semibold text-slate-600">{meta}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold text-slate-950">{value}</span>
          <span className="rounded-xl bg-red-50 p-2 text-red-700">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function PanelSection({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-b border-slate-100 px-5 py-4 last:border-b-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="font-extrabold text-slate-950">{title}</div>
        {extra}
      </div>
      {children}
    </div>
  );
}

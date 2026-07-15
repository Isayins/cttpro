import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Progress, Segmented, Tag, Tooltip } from "antd";
import {
  AlertOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudDownloadOutlined,
  CreditCardOutlined,
  DatabaseOutlined,
  FilterOutlined,
  GiftOutlined,
  InboxOutlined,
  KeyOutlined,
  LayoutOutlined,
  MenuFoldOutlined,
  NotificationOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

type DemoId = "enterprise" | "task" | "command" | "grid";

interface DemoOption {
  id: DemoId;
  title: string;
  source: string;
  fit: string;
  score: string;
}

interface MetricItem {
  label: string;
  value: string;
  change: string;
  tone: "red" | "green" | "amber" | "blue";
  icon: ReactNode;
}

interface WorkItem {
  title: string;
  meta: string;
  status: string;
  tone: string;
}

const demoOptions: DemoOption[] = [
  {
    id: "enterprise",
    title: "A 企业中台",
    source: "Ant Design Pro",
    fit: "模块多、权限多、需要统一工作台",
    score: "推荐",
  },
  {
    id: "task",
    title: "B 任务流后台",
    source: "shadcn-admin",
    fit: "审核、发货、支付异常要快速处理",
    score: "轻量",
  },
  {
    id: "command",
    title: "C 运营驾驶舱",
    source: "TailAdmin / Mosaic",
    fit: "更看重指标、告警、今日行动",
    score: "直观",
  },
  {
    id: "grid",
    title: "D 数据网格",
    source: "CoreUI / Tabler",
    fit: "大量订单、用户、CDK 批量管理",
    score: "高效",
  },
];

const metrics: MetricItem[] = [
  { label: "今日订单", value: "128", change: "+18.4%", tone: "red", icon: <CreditCardOutlined /> },
  { label: "活跃用户", value: "2,418", change: "+9.2%", tone: "green", icon: <TeamOutlined /> },
  { label: "待发 CDK", value: "36", change: "8 单异常", tone: "amber", icon: <KeyOutlined /> },
  { label: "下载验证", value: "684", change: "+31.6%", tone: "blue", icon: <CloudDownloadOutlined /> },
];

const navItems = [
  { label: "总览", icon: <AppstoreOutlined /> },
  { label: "用户", icon: <TeamOutlined /> },
  { label: "商品", icon: <ShoppingCartOutlined /> },
  { label: "优惠码", icon: <GiftOutlined /> },
  { label: "支付", icon: <CreditCardOutlined /> },
  { label: "日志", icon: <AuditOutlined /> },
];

const reviewItems: WorkItem[] = [
  { title: "支付成功但 CDK 未发送", meta: "ORD-240704-0819 · 3 分钟前", status: "高优先", tone: "red" },
  { title: "用户举报帖子需要复核", meta: "论坛 / 量化策略区 · 12 分钟前", status: "待审核", tone: "amber" },
  { title: "商品图上传失败重试", meta: "高级策略包 · 21 分钟前", status: "处理中", tone: "blue" },
  { title: "邀请码批量生成确认", meta: "运营活动 · 38 分钟前", status: "可执行", tone: "green" },
];

const tableRows = [
  { id: "ORD-0819", user: "Chen", item: "高级策略包", amount: "¥199", state: "待发货", owner: "支付订单" },
  { id: "USR-4421", user: "Mika", item: "管理员申请", amount: "-", state: "待审核", owner: "用户管理" },
  { id: "CDK-1182", user: "Liu", item: "CDK 库存", amount: "36", state: "低库存", owner: "发货池" },
  { id: "POST-773", user: "匿名", item: "举报复核", amount: "-", state: "待处理", owner: "论坛" },
  { id: "PAY-509", user: "Qin", item: "支付宝回调", amount: "¥69", state: "异常", owner: "支付订单" },
];

const timelineItems = [
  "08:52 自动同步 18 笔支付订单",
  "09:10 运营发布站点公告",
  "09:23 CDK 发货池补充 120 个",
  "09:41 2 条举报被标记为已处理",
];

const toneClasses = {
  red: "bg-red-50 text-red-700 border-red-100",
  green: "bg-emerald-50 text-emerald-700 border-emerald-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  blue: "bg-sky-50 text-sky-700 border-sky-100",
};

const demoLabels = demoOptions.map((option) => ({
  label: option.title,
  value: option.id,
}));

export default function AdminDesignDemos() {
  const [activeDemo, setActiveDemo] = useState<DemoId>("enterprise");
  const activeOption = useMemo(
    () => demoOptions.find((option) => option.id === activeDemo) ?? demoOptions[0],
    [activeDemo],
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 md:px-6 xl:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-red-600">Admin Demo Lab</div>
              <h1 className="m-0 mt-1 text-2xl font-bold tracking-normal text-slate-950 md:text-3xl">
                管理页面改版候选方案
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tooltip title="回到当前后台">
                <Link to="/admin">
                  <Button icon={<LayoutOutlined />}>当前后台</Button>
                </Link>
              </Tooltip>
              <Tooltip title="刷新原型数据">
                <Button icon={<ReloadOutlined />}>刷新</Button>
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid w-full grid-cols-2 gap-2 xl:hidden">
              {demoOptions.map((option) => (
                <button
                  className={`rounded-md border px-3 py-2 text-sm font-medium ${
                    activeDemo === option.id
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                  key={option.id}
                  onClick={() => setActiveDemo(option.id)}
                  type="button"
                >
                  {option.title}
                </button>
              ))}
            </div>
            <div className="hidden w-full xl:block xl:max-w-[640px]">
              <Segmented
                block
                options={demoLabels}
                value={activeDemo}
                onChange={(value) => setActiveDemo(value as DemoId)}
                className="w-full"
              />
            </div>
            <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-3 xl:w-[680px]">
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                来源: <span className="font-semibold text-slate-900">{activeOption.source}</span>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                适合: <span className="font-semibold text-slate-900">{activeOption.fit}</span>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                判断: <span className="font-semibold text-red-600">{activeOption.score}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-6 xl:px-8">
        {activeDemo === "enterprise" ? <EnterpriseDemo /> : null}
        {activeDemo === "task" ? <TaskFlowDemo /> : null}
        {activeDemo === "command" ? <CommandCenterDemo /> : null}
        {activeDemo === "grid" ? <DataGridDemo /> : null}
      </main>
    </div>
  );
}

function EnterpriseDemo() {
  return (
    <div className="grid min-h-0 grid-cols-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:min-h-[720px] lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-slate-950 p-4 text-white lg:border-b-0 lg:border-r lg:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold">CTT Admin</div>
            <div className="mt-1 text-xs text-slate-400">Enterprise Console</div>
          </div>
          <Button size="small" icon={<MenuFoldOutlined />} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
          {navItems.map((item, index) => (
            <button
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                index === 0 ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-900"
              }`}
              key={item.label}
              type="button"
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-8 rounded-md border border-slate-800 bg-slate-900 p-3">
          <div className="text-xs text-slate-400">系统健康</div>
          <div className="mt-3 flex items-end justify-between">
            <span className="text-2xl font-bold">98%</span>
            <Tag color="green">稳定</Tag>
          </div>
          <Progress percent={98} size="small" showInfo={false} strokeColor="#10b981" />
        </div>
      </aside>

      <section className="min-w-0 bg-[#f8fafc]">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xl font-bold text-slate-950">运营总览</div>
            <div className="mt-1 text-sm text-slate-500">商品、订单、用户、内容审核集中到一个控制台</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<SearchOutlined />}>搜索</Button>
            <Button icon={<BellOutlined />}>通知</Button>
            <Button type="primary" danger icon={<ThunderboltOutlined />}>
              处理待办
            </Button>
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            <MetricGrid />

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-base font-bold">核心业务流水</div>
                  <div className="mt-1 text-sm text-slate-500">把订单、用户、发货、举报放在同一张工作表里</div>
                </div>
                <div className="flex gap-2">
                  <Button icon={<FilterOutlined />}>筛选</Button>
                  <Button icon={<SettingOutlined />}>列设置</Button>
                </div>
              </div>
              <MockTable compact={false} />
            </div>
          </div>

          <aside className="grid gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-bold">待办队列</div>
                <Tag color="red">4 项</Tag>
              </div>
              <div className="grid gap-3">
                {reviewItems.map((item) => (
                  <WorkItemCard item={item} key={item.title} />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="font-bold">最近动态</div>
              <div className="mt-3 grid gap-3">
                {timelineItems.map((item) => (
                  <div className="flex gap-3 text-sm" key={item}>
                    <ClockCircleOutlined className="mt-1 text-slate-400" />
                    <span className="text-slate-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function TaskFlowDemo() {
  return (
    <div className="grid min-h-[720px] gap-4 xl:grid-cols-[72px_340px_minmax(0,1fr)]">
      <aside className="flex rounded-lg border border-slate-200 bg-slate-950 p-3 text-white xl:flex-col">
        {navItems.slice(0, 6).map((item, index) => (
          <Tooltip title={item.label} key={item.label}>
            <button
              className={`flex h-11 w-11 items-center justify-center rounded-md text-lg ${
                index === 1 ? "bg-white text-slate-950" : "text-slate-400 hover:bg-slate-900"
              }`}
              type="button"
            >
              {item.icon}
            </button>
          </Tooltip>
        ))}
      </aside>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <div className="text-lg font-bold">任务收件箱</div>
          <div className="mt-1 text-sm text-slate-500">先看待处理对象，再进入详情动作</div>
          <div className="mt-4 flex gap-2">
            <Button icon={<InboxOutlined />}>全部</Button>
            <Button icon={<AlertOutlined />}>异常</Button>
          </div>
        </div>
        <div className="grid gap-2 p-3">
          {reviewItems.map((item, index) => (
            <button
              className={`rounded-lg border p-3 text-left transition ${
                index === 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
              key={item.title}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-950">{item.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.meta}</div>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                  {item.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xl font-bold">支付成功但 CDK 未发送</div>
            <div className="mt-1 text-sm text-slate-500">ORD-240704-0819 · 用户 Chen · 高级策略包</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<SearchOutlined />}>查订单</Button>
            <Button icon={<NotificationOutlined />}>通知用户</Button>
            <Button type="primary" danger icon={<CheckCircleOutlined />}>
              补发完成
            </Button>
          </div>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <DetailBlock label="支付状态" value="TRADE_SUCCESS" tone="green" />
              <DetailBlock label="发货状态" value="LOCKED" tone="amber" />
              <DetailBlock label="异常次数" value="2" tone="red" />
            </div>
            <div className="rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 p-4 font-bold">处理步骤</div>
              <div className="grid gap-0">
                {["校验支付回调", "锁定可用 CDK", "发送邮件", "写入操作日志"].map((step, index) => (
                  <div className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-b-0" key={step}>
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        index < 2 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="font-medium text-slate-800">{step}</span>
                    {index < 2 ? <Tag color="green">完成</Tag> : <Tag>等待</Tag>}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="font-bold">相关记录</div>
              <MockTable compact />
            </div>
          </div>

          <aside className="grid content-start gap-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="font-bold">用户侧信息</div>
              <dl className="mt-3 grid gap-3 text-sm">
                <InfoLine label="邮箱" value="chen@example.com" />
                <InfoLine label="注册" value="2026-06-18" />
                <InfoLine label="历史订单" value="7 笔" />
                <InfoLine label="风险标记" value="无" />
              </dl>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="font-bold">处理备注</div>
              <div className="mt-3 min-h-28 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                支付回调已成功，发货服务在 09:17 出现锁定超时，可直接补发并关闭异常。
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function CommandCenterDemo() {
  const lanes = [
    { title: "收入", value: "¥18,920", percent: 74, tone: "#dc2626" },
    { title: "转化", value: "8.7%", percent: 62, tone: "#0284c7" },
    { title: "库存", value: "214", percent: 41, tone: "#d97706" },
    { title: "风控", value: "3", percent: 22, tone: "#059669" },
  ];

  return (
    <div className="grid min-h-[720px] gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="grid gap-4">
        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-red-300">运营驾驶舱</div>
              <div className="mt-2 text-3xl font-bold">今天优先看异常、库存和收入趋势</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={<FilterOutlined />}>筛选</Button>
              <Button type="primary" danger icon={<ThunderboltOutlined />}>
                执行巡检
              </Button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            {lanes.map((lane) => (
              <div className="rounded-lg border border-slate-800 bg-slate-900 p-4" key={lane.title}>
                <div className="text-sm text-slate-400">{lane.title}</div>
                <div className="mt-2 text-2xl font-bold">{lane.value}</div>
                <Progress percent={lane.percent} showInfo={false} strokeColor={lane.tone} />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold">七日业务热度</div>
                <div className="mt-1 text-sm text-slate-500">用简单趋势替代多张分散统计卡</div>
              </div>
              <Button icon={<DatabaseOutlined />}>数据源</Button>
            </div>
            <div className="mt-6 flex h-72 items-end gap-3">
              {[38, 54, 46, 68, 74, 59, 86, 72, 91, 64, 80, 95].map((height, index) => (
                <div className="flex flex-1 flex-col items-center gap-2" key={`${height}-${index}`}>
                  <div
                    className="w-full rounded-t-md bg-red-500"
                    style={{ height: `${height}%`, opacity: 0.38 + index * 0.035 }}
                  />
                  <span className="text-xs text-slate-400">{index + 1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="font-bold">今日行动</div>
            <div className="mt-4 grid gap-3">
              {reviewItems.map((item) => (
                <WorkItemCard item={item} key={item.title} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {metrics.map((item) => (
            <MetricCard item={item} key={item.label} />
          ))}
        </div>
      </section>

      <aside className="grid content-start gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-bold">告警雷达</div>
            <Tag color="red">3 个风险</Tag>
          </div>
          <div className="grid gap-3">
            <RadarLine label="支付回调延迟" value={82} color="#dc2626" />
            <RadarLine label="CDK 低库存" value={64} color="#d97706" />
            <RadarLine label="举报积压" value={48} color="#0284c7" />
            <RadarLine label="下载验证失败" value={22} color="#059669" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="font-bold">运营时间线</div>
          <div className="mt-4 grid gap-4">
            {timelineItems.map((item) => (
              <div className="flex gap-3" key={item}>
                <span className="mt-1 h-2 w-2 rounded-full bg-red-500" />
                <div className="text-sm text-slate-600">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function DataGridDemo() {
  const filters = ["全部", "支付异常", "待发货", "低库存", "举报", "管理员"];

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xl font-bold">统一数据网格</div>
            <div className="mt-1 text-sm text-slate-500">像表格一样管理跨模块数据，右侧保留对象详情</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<SearchOutlined />}>搜索</Button>
            <Button icon={<FilterOutlined />}>筛选</Button>
            <Button icon={<SettingOutlined />}>列设置</Button>
            <Button type="primary" danger icon={<CheckCircleOutlined />}>
              批量处理
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map((filter, index) => (
            <button
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                index === 1
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
              key={filter}
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-[620px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 overflow-x-auto border-b border-slate-200 xl:border-b-0 xl:border-r">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input aria-label="select all" type="checkbox" />
                </th>
                <th className="px-4 py-3">对象编号</th>
                <th className="px-4 py-3">用户</th>
                <th className="px-4 py-3">模块</th>
                <th className="px-4 py-3">对象</th>
                <th className="px-4 py-3">金额/数量</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">操作人</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, index) => (
                <tr className={index === 4 ? "bg-red-50" : "border-t border-slate-100"} key={row.id}>
                  <td className="px-4 py-4">
                    <input aria-label={`select ${row.id}`} type="checkbox" defaultChecked={index === 4} />
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-950">{row.id}</td>
                  <td className="px-4 py-4">{row.user}</td>
                  <td className="px-4 py-4">{row.owner}</td>
                  <td className="px-4 py-4">{row.item}</td>
                  <td className="px-4 py-4">{row.amount}</td>
                  <td className="px-4 py-4">
                    <Tag color={row.state === "异常" ? "red" : row.state === "低库存" ? "orange" : "blue"}>
                      {row.state}
                    </Tag>
                  </td>
                  <td className="px-4 py-4">Admin</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside className="bg-slate-50 p-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold">PAY-509</div>
                <div className="mt-1 text-sm text-slate-500">支付宝回调异常</div>
              </div>
              <Tag color="red">异常</Tag>
            </div>
            <dl className="mt-4 grid gap-3 text-sm">
              <InfoLine label="用户" value="Qin" />
              <InfoLine label="金额" value="¥69" />
              <InfoLine label="订单" value="ORD-240704-0509" />
              <InfoLine label="最后错误" value="delivery lock timeout" />
            </dl>
            <div className="mt-5 grid gap-2">
              <Button type="primary" danger icon={<CheckCircleOutlined />}>
                标记已处理
              </Button>
              <Button icon={<NotificationOutlined />}>发送通知</Button>
              <Button icon={<AuditOutlined />}>查看日志</Button>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="font-bold">批量动作</div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <div className="rounded-md bg-slate-50 p-3">选中 1 条异常订单</div>
              <div className="rounded-md bg-slate-50 p-3">可同步支付状态、补发 CDK、写入备注</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetricGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((item) => (
        <MetricCard item={item} key={item.label} />
      ))}
    </div>
  );
}

function MetricCard({ item }: { item: MetricItem }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">{item.label}</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{item.value}</div>
        </div>
        <span className={`rounded-md border p-2 ${toneClasses[item.tone]}`}>{item.icon}</span>
      </div>
      <div className={`mt-3 inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${toneClasses[item.tone]}`}>
        {item.change}
      </div>
    </div>
  );
}

function WorkItemCard({ item }: { item: WorkItem }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{item.title}</div>
          <div className="mt-1 text-xs text-slate-500">{item.meta}</div>
        </div>
        <Tag color={item.tone}>{item.status}</Tag>
      </div>
    </div>
  );
}

function MockTable({ compact }: { compact: boolean }) {
  const visibleRows = compact ? tableRows.slice(0, 3) : tableRows;

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-3">编号</th>
            <th className="px-3 py-3">用户</th>
            <th className="px-3 py-3">对象</th>
            <th className="px-3 py-3">金额/数量</th>
            <th className="px-3 py-3">状态</th>
            <th className="px-3 py-3">模块</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr className="border-t border-slate-100" key={row.id}>
              <td className="px-3 py-3 font-semibold text-slate-900">{row.id}</td>
              <td className="px-3 py-3">{row.user}</td>
              <td className="px-3 py-3">{row.item}</td>
              <td className="px-3 py-3">{row.amount}</td>
              <td className="px-3 py-3">
                <Tag color={row.state === "异常" ? "red" : row.state === "低库存" ? "orange" : "blue"}>
                  {row.state}
                </Tag>
              </td>
              <td className="px-3 py-3">{row.owner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailBlock({ label, value, tone }: { label: string; value: string; tone: MetricItem["tone"] }) {
  return (
    <div className={`rounded-lg border p-4 ${toneClasses[tone]}`}>
      <div className="text-sm opacity-80">{label}</div>
      <div className="mt-2 text-xl font-bold">{value}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="m-0 max-w-[190px] text-right font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function RadarLine({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{value}</span>
      </div>
      <Progress percent={value} showInfo={false} strokeColor={color} />
    </div>
  );
}

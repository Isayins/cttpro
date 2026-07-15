import {
  BarChartOutlined,
  CodeOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Card, Col, Row, Tag } from "antd";

import MainLayout from "../layouts/MainLayout";

const highlights = [
  {
    title: "社区交流",
    description: "提供帖子发布、回复互动和个人资料入口，把站内沟通集中到同一套账号体系里。",
    icon: <TeamOutlined className="text-xl text-[#2586ff]" />,
  },
  {
    title: "下载分发",
    description: "集中管理客户端、文档和验证下载资源，支持版本信息、校验值和下载统计。",
    icon: <CodeOutlined className="text-xl text-[#2586ff]" />,
  },
  {
    title: "后台管理",
    description: "围绕资源、公告、邀请码和访问数据提供管理入口，方便后续持续维护。",
    icon: <SafetyCertificateOutlined className="text-xl text-[#2586ff]" />,
  },
];

const capabilities = [
  { name: "React", detail: "前端界面与路由" },
  { name: "TypeScript", detail: "类型约束与工程化" },
  { name: "Spring Boot", detail: "后台接口服务" },
  { name: "MySQL", detail: "业务数据存储" },
  { name: "下载中心", detail: "资源分发与校验" },
  { name: "管理后台", detail: "权限与内容维护" },
];

const roadmap = [
  {
    title: "把基础功能做稳",
    description: "继续补齐空状态、错误提示、权限边界和后台操作反馈，让每个流程都有清楚的结果。",
    icon: <ToolOutlined className="text-xl text-[#2586ff]" />,
  },
  {
    title: "提升内容可信度",
    description: "完善资源说明、版本日志、校验信息和站点公告，让用户知道每个入口的用途。",
    icon: <DatabaseOutlined className="text-xl text-[#2586ff]" />,
  },
  {
    title: "强化运营视角",
    description: "基于浏览统计、下载统计和用户反馈，逐步优化导航、模块优先级和管理效率。",
    icon: <BarChartOutlined className="text-xl text-[#2586ff]" />,
  },
];

export default function About() {
  return (
    <MainLayout>
      <div className="space-y-8 py-8 md:py-10">
        <section className="rounded-[28px] border border-white/75 bg-white/90 px-6 py-8 shadow-[0_18px_50px_rgba(15,23,42,0.05)] md:px-8 md:py-10">
          <Tag color="blue">关于 IDNCAR</Tag>
          <h1 className="mt-4 max-w-4xl text-3xl font-semibold leading-tight text-slate-900 md:text-4xl">
            一个面向站内交流、资源分发和后台维护的综合站点
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            IDNCAR 目前把登录注册、下载中心、论坛互动、用户资料和后台管理放在同一套体验里。当前阶段的重点不是做大而全，而是把常用入口做清楚，把状态反馈做完整，把后续维护路径留顺。
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <Card key={item.title} className="h-full rounded-[24px] border-white/75 bg-white/90 shadow-sm">
              <div className="space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff]">{item.icon}</div>
                <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                <p className="leading-7 text-slate-600">{item.description}</p>
              </div>
            </Card>
          ))}
        </section>

        <section className="rounded-[28px] border border-white/75 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] md:p-7">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-slate-900">当前能力构成</h2>
            <p className="mt-2 text-slate-500">这里列的是站点当前已经形成闭环或正在完善的核心模块。</p>
          </div>
          <Row gutter={[16, 16]}>
            {capabilities.map((item) => (
              <Col xs={12} sm={8} md={6} key={item.name}>
                <div className="h-full rounded-[20px] border border-slate-100 bg-slate-50 px-4 py-4">
                  <div className="text-base font-semibold text-slate-900">{item.name}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">{item.detail}</div>
                </div>
              </Col>
            ))}
          </Row>
        </section>

        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-slate-900">下一阶段优化方向</h2>
            <p className="mt-2 text-slate-500">优先补体验短板，再逐步加强内容和运营能力。</p>
          </div>
          <Row gutter={[16, 16]}>
            {roadmap.map((item) => (
              <Col xs={24} md={8} key={item.title}>
                <Card className="h-full rounded-[24px] border-white/75 bg-white/90 shadow-sm">
                  <div className="space-y-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff]">{item.icon}</div>
                    <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                    <p className="leading-7 text-slate-600">{item.description}</p>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </section>

        <section className="rounded-[28px] border border-white/75 bg-slate-900 px-6 py-6 text-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
          <h2 className="text-xl font-semibold">维护节奏</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-300">
            站点会按“功能可用、状态清楚、内容可信、后台好维护”的顺序继续迭代。对外页面先保证稳定，对内模块再逐步补强效率。
          </p>
        </section>
      </div>
    </MainLayout>
  );
}

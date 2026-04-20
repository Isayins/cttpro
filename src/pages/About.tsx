import { BarChartOutlined, CodeOutlined, GithubOutlined, SafetyCertificateOutlined, TeamOutlined, ToolOutlined } from "@ant-design/icons";
import { Card, Col, Row, Tag } from "antd";

import MainLayout from "../layouts/MainLayout";

const highlights = [
  {
    title: "社区交流",
    description: "用户可以在论坛里发布帖子、回复内容、完善资料，形成站内交流闭环。",
    icon: <TeamOutlined className="text-xl text-[#2586ff]" />,
  },
  {
    title: "下载中心",
    description: "统一管理客户端、资源文件和验证下载入口，方便版本维护与集中分发。",
    icon: <CodeOutlined className="text-xl text-[#2586ff]" />,
  },
  {
    title: "站点管理",
    description: "管理员可管理邀请码、下载内容、站点公告，并查看后台浏览统计。",
    icon: <SafetyCertificateOutlined className="text-xl text-[#2586ff]" />,
  },
];

const skills = [
  { name: "React", level: "前端界面" },
  { name: "TypeScript", level: "类型与工程化" },
  { name: "Java / Spring Boot", level: "后台接口" },
  { name: "MySQL", level: "站点数据存储" },
  { name: "论坛与下载", level: "核心业务模块" },
  { name: "管理后台", level: "权限与内容管理" },
];

const roadmap = [
  {
    title: "站点基础能力",
    description: "登录注册、邀请码、公告管理、下载中心和用户资料已完成基础闭环。",
    icon: <ToolOutlined className="text-xl text-[#2586ff]" />,
  },
  {
    title: "数据与内容能力",
    description: "现已接入浏览统计，下一阶段会继续补论坛增强、下载专业信息和后台日志。",
    icon: <BarChartOutlined className="text-xl text-[#2586ff]" />,
  },
  {
    title: "品牌功能扩展",
    description: "啥也没。",
    icon: <GithubOutlined className="text-xl text-[#2586ff]" />,
  },
];

export default function About() {
  return (
    <MainLayout>
      <div className="space-y-8 py-10">
        <section className="rounded-[32px] border border-slate-100 bg-white/90 px-8 py-10 shadow-sm">
          <div className="space-y-4">
            <Tag color="blue">ABOUT IDNCAR</Tag>
            <h1 className="text-3xl font-semibold text-slate-900 md:text-4xl">一个围绕社区、下载和后台管理持续完善的站点</h1>
            <p className="max-w-3xl leading-8 text-slate-600">
              IDNCAR 
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <Card key={item.title} className="rounded-[24px] border-slate-100 shadow-sm">
              <div className="space-y-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff]">{item.icon}</div>
                <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                <p className="leading-7 text-slate-600">{item.description}</p>
              </div>
            </Card>
          ))}
        </section>

        <section>
          <div className="mb-5 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">当前能力构成</h2>
            <p className="mt-2 text-slate-500">这里列的是站点当前重点使用的技术与功能方向。</p>
          </div>
          <Row gutter={[16, 16]}>
            {skills.map((skill) => (
              <Col xs={12} sm={8} md={6} key={skill.name}>
                <Card className="rounded-[22px] border-slate-100 shadow-sm">
                  <div className="text-center">
                    <div className="text-base font-semibold text-slate-900">{skill.name}</div>
                    <div className="mt-2 text-sm text-slate-500">{skill.level}</div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </section>

        <section>
          <div className="mb-5 text-center">
            <h2 className="text-2xl font-semibold text-slate-900">建设路线</h2>
            <p className="mt-2 text-slate-500">IDNCAR 的下一阶段会从体验完整度和品牌特色两条线继续推进。</p>
          </div>
          <Row gutter={[16, 16]}>
            {roadmap.map((item) => (
              <Col xs={24} md={8} key={item.title}>
                <Card className="h-full rounded-[24px] border-slate-100 shadow-sm">
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

        <section className="rounded-[28px] border border-slate-100 bg-slate-50 px-6 py-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">联系方式</h2>
          <p className="mt-3 leading-7 text-slate-600">
            88888888888888888
          </p>
          <div className="mt-4 flex items-center gap-3 text-slate-600">
            <GithubOutlined />
            <span>GitHub 与外部联系入口待补充</span>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

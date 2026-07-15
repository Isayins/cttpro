import {
  CalendarOutlined,
  CodeOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  ReadOutlined,
} from "@ant-design/icons";

import MainLayout from "../layouts/MainLayout";

const noteGroups = [
  {
    title: "编程基础",
    description: "记录 JavaScript、TypeScript、React 和常用工程工具的学习笔记。",
    icon: <CodeOutlined />,
    accent: "border-t-[#2563eb]",
  },
  {
    title: "后端实践",
    description: "整理接口设计、数据库建模、权限校验和部署运维中的常见问题。",
    icon: <DatabaseOutlined />,
    accent: "border-t-[#16a34a]",
  },
  {
    title: "阅读摘记",
    description: "保留技术文章、书籍章节和官方文档中的重点结论与复盘。",
    icon: <ReadOutlined />,
    accent: "border-t-[#d97706]",
  },
  {
    title: "项目复盘",
    description: "把真实开发中的问题、取舍和排查过程沉淀成下次可复用的清单。",
    icon: <ExperimentOutlined />,
    accent: "border-t-[#c2410c]",
  },
];

const weeklyPlan = [
  "复习 React 组件拆分、状态管理和表单校验",
  "整理 Spring Boot 接口规范与异常处理笔记",
  "补充 Linux 部署、日志排查和备份流程清单",
  "每周回看一次已学内容，保留可复用的示例代码",
];

export default function Home() {
  return (
    <MainLayout variant="bare">
      <div className="space-y-10 py-4 md:space-y-12 md:py-8">
        <section id="notes">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <FileTextOutlined className="text-lg text-slate-500" />
              <h2 className="text-2xl font-semibold text-slate-950">学习记录</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-slate-500">
              按主题归档，优先保留能直接复用的结论、代码片段和排查步骤。
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {noteGroups.map((item) => (
              <article key={item.title} className={`rounded-lg border border-t-2 border-slate-200 bg-white p-5 shadow-sm ${item.accent}`}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-lg text-slate-700">
                  {item.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="plan">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-3">
              <CalendarOutlined className="text-lg text-slate-500" />
              <h2 className="text-2xl font-semibold text-slate-950">本周计划</h2>
            </div>
            <p className="text-sm text-slate-500">用小步推进，避免笔记只堆积不回看。</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-3">
              {weeklyPlan.map((item, index) => (
                <div key={item} className="flex gap-3 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-7 text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}

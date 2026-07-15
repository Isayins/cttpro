import { Button, Select, Tag } from "antd";

import { Card, CardContent } from "../../components/ui";
import { recommendedTools, toolCategoryConfig, toolConfig } from "./toolConfig";
import type { ToolType } from "./types";

type ToolsPageHeaderProps = {
  activeTool: ToolType;
  historyCount: number;
  onSelectTool: (tool: ToolType) => void;
};

type ToolPanelHeaderProps = {
  activeTool: ToolType;
};

const toolEntries = Object.keys(toolConfig) as ToolType[];
const toolOptions = toolEntries.map((tool) => ({
  label: toolConfig[tool].name,
  value: tool,
}));
const categoryEntries = Object.entries(toolCategoryConfig);

export function ToolsPageHeader({ activeTool, historyCount, onSelectTool }: ToolsPageHeaderProps) {
  const currentTool = toolConfig[activeTool];
  const CurrentToolIcon = currentTool.icon;
  const summaryCards = [
    { label: "工具数量", value: toolEntries.length, detail: "覆盖常用处理场景" },
    { label: "工具分类", value: categoryEntries.length, detail: categoryEntries.map(([, item]) => item.name).join(" / ") },
    { label: "历史记录", value: historyCount, detail: historyCount > 0 ? "可从侧栏恢复" : "本地记录为空" },
  ];

  return (
    <>
      <section className="rounded-[28px] border border-white/75 bg-white/90 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)] md:p-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.75fr)]">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-slate-500">工具工作台</div>
            <h1 className="mt-3 text-2xl font-semibold text-slate-900 md:text-4xl">实用工具箱</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${currentTool.bgColor}`}>
                <CurrentToolIcon style={{ color: currentTool.color, fontSize: 20 }} />
              </span>
              <div>
                <div className="text-sm text-slate-500">当前工具</div>
                <div className="text-lg font-semibold text-slate-900">{currentTool.name}</div>
              </div>
              <Tag color={toolCategoryConfig[currentTool.category].tone}>{toolCategoryConfig[currentTool.category].name}</Tag>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{currentTool.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {summaryCards.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white bg-slate-50/85 px-4 py-3">
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="mt-1 text-2xl font-semibold leading-none text-slate-950">{item.value}</div>
                <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm font-medium text-slate-700">常用入口</div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-start lg:justify-end">
            {recommendedTools.map((tool) => {
              const config = toolConfig[tool];
              const Icon = config.icon;
              const active = activeTool === tool;

              return (
                <Button
                  key={tool}
                  type={active ? "primary" : "default"}
                  icon={<Icon />}
                  className="w-full min-w-0 justify-center text-xs sm:w-auto sm:text-sm"
                  onClick={() => onSelectTool(tool)}
                >
                  {config.name}
                </Button>
              );
            })}
          </div>
        </div>
      </section>

      <Card className="border-0 shadow-sm xl:hidden">
        <CardContent className="p-5">
          <label className="mb-2 block text-sm font-medium text-slate-700">选择工具</label>
          <Select
            size="large"
            value={activeTool}
            className="w-full [&_.ant-select-selector]:!rounded-2xl"
            optionFilterProp="label"
            showSearch
            options={toolOptions}
            onChange={(value: ToolType) => onSelectTool(value)}
          />
        </CardContent>
      </Card>
    </>
  );
}

export function ToolPanelHeader({ activeTool }: ToolPanelHeaderProps) {
  const currentTool = toolConfig[activeTool];
  const CurrentToolIcon = currentTool.icon;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${currentTool.bgColor}`}>
        <CurrentToolIcon style={{ color: currentTool.color, fontSize: 22 }} />
      </span>
      <div>
        <div className="text-lg font-semibold text-slate-900">{currentTool.name}</div>
        <div className="text-sm text-slate-500">{currentTool.description}</div>
      </div>
    </div>
  );
}

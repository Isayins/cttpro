import { useEffect, useMemo, useState } from "react";
import { CheckCircleOutlined, DeleteOutlined, HistoryOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Empty, Input, Segmented, Tag } from "antd";

import { Card, CardContent } from "../../components/ui";
import { toolCategoryConfig, toolConfig } from "./toolConfig";
import type { HistoryScope, ToolHistoryItem, ToolType } from "./types";
import { formatHistoryTime, getHistoryPreview } from "./toolUtils";

type ToolsSidebarProps = {
  activeTool: ToolType;
  history: ToolHistoryItem[];
  historyItems: ToolHistoryItem[];
  historyScope: HistoryScope;
  onSelectTool: (tool: ToolType) => void;
  onSetHistoryScope: (scope: HistoryScope) => void;
  onClearHistory: () => void;
  onRestoreHistoryItem: (item: ToolHistoryItem) => void;
  onRemoveHistoryItem: (id: string) => void;
};

const toolEntries = Object.keys(toolConfig) as ToolType[];
const COLLAPSED_HISTORY_LIMIT = 6;

export function ToolsSidebar({
  activeTool,
  history,
  historyItems,
  historyScope,
  onSelectTool,
  onSetHistoryScope,
  onClearHistory,
  onRestoreHistoryItem,
  onRemoveHistoryItem,
}: ToolsSidebarProps) {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [toolKeyword, setToolKeyword] = useState("");
  const currentHistoryCount = history.filter((item) => item.tool === activeTool).length;
  const normalizedToolKeyword = toolKeyword.trim().toLowerCase();
  const visibleToolEntries = useMemo(
    () =>
      toolEntries.filter((tool) => {
        const config = toolConfig[tool];
        if (!normalizedToolKeyword) {
          return true;
        }
        return [config.name, config.description, toolCategoryConfig[config.category].name]
          .some((value) => value.toLowerCase().includes(normalizedToolKeyword));
      }),
    [normalizedToolKeyword],
  );
  const visibleHistoryItems = useMemo(
    () => (historyExpanded ? historyItems : historyItems.slice(0, COLLAPSED_HISTORY_LIMIT)),
    [historyExpanded, historyItems],
  );

  useEffect(() => {
    setHistoryExpanded(false);
  }, [activeTool, historyScope]);

  return (
    <div className="order-2 min-w-0 space-y-6 xl:order-1 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
      <Card className="hidden border-0 shadow-sm xl:block">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-base font-semibold text-gray-800">工具列表</div>
            <Tag className="m-0">{visibleToolEntries.length} / {toolEntries.length}</Tag>
          </div>
          <Input
            allowClear
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="搜索工具"
            value={toolKeyword}
            onChange={(event) => setToolKeyword(event.target.value)}
            className="mb-4"
          />
          <div className="max-h-[460px] space-y-4 overflow-y-auto pr-1">
            {Object.entries(toolCategoryConfig).map(([category, categoryConfig]) => {
              const categoryTools = visibleToolEntries.filter((tool) => toolConfig[tool].category === category);

              if (categoryTools.length === 0) {
                return null;
              }

              return (
                <div key={category}>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <div className="text-xs font-medium text-slate-500">{categoryConfig.name}</div>
                    <span className="text-xs text-slate-400">{categoryTools.length}</span>
                  </div>
                  <div className="space-y-2">
                    {categoryTools.map((tool) => {
                      const config = toolConfig[tool];
                      const Icon = config.icon;
                      const active = activeTool === tool;

                      return (
                        <button
                          key={tool}
                          type="button"
                          onClick={() => onSelectTool(tool)}
                          className={`flex w-full items-start justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                            active ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span className="flex min-w-0 items-start gap-2">
                            <Icon className="mt-0.5 flex-shrink-0" style={{ color: config.color }} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-800">{config.name}</span>
                              <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-slate-500">{config.description}</span>
                            </span>
                          </span>
                          {active ? <CheckCircleOutlined className="mt-0.5 flex-shrink-0" style={{ color: config.color }} /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {visibleToolEntries.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的工具" /> : null}
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
              <HistoryOutlined />
              最近记录
            </div>
            <Button type="text" disabled={history.length === 0} onClick={onClearHistory}>
              清空
            </Button>
          </div>

          <Segmented
            block
            size="small"
            value={historyScope}
            onChange={(value) => onSetHistoryScope(value as HistoryScope)}
            options={[
              { label: `当前 ${currentHistoryCount}`, value: "current" },
              { label: `全部 ${history.length}`, value: "all" },
            ]}
            className="mb-3"
          />

          {historyItems.length > 0 ? (
            <>
              <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                {visibleHistoryItems.map((item) => (
                  <div key={item.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-2.5 transition hover:border-slate-200 hover:bg-white">
                    <div className="flex min-w-0 items-start gap-2">
                      <button
                        type="button"
                        disabled={item.restorable === false}
                        className="min-w-0 flex-1 overflow-hidden text-left disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => onRestoreHistoryItem(item)}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-800">{item.action}</span>
                          {item.tool !== activeTool || historyScope === "all" ? (
                            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500">{toolConfig[item.tool].name}</span>
                          ) : null}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{formatHistoryTime(item.createdAt)}</span>
                          <span>{item.restorable === false ? "内容过长，仅保留预览" : "点击恢复"}</span>
                        </div>
                        <div className="mt-1 max-w-full truncate text-xs text-slate-500">{getHistoryPreview(item.output ?? item.input, 56)}</div>
                      </button>
                      <Button
                        type="text"
                        size="small"
                        aria-label="删除历史记录"
                        title="删除历史记录"
                        icon={<DeleteOutlined />}
                        onClick={() => onRemoveHistoryItem(item.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {historyItems.length > COLLAPSED_HISTORY_LIMIT ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <span className="text-xs text-slate-500">
                    {visibleHistoryItems.length} / {historyItems.length}
                  </span>
                  <Button type="link" size="small" className="!h-auto !p-0" onClick={() => setHistoryExpanded((value) => !value)}>
                    {historyExpanded ? "收起" : `展开 ${historyItems.length - COLLAPSED_HISTORY_LIMIT} 条`}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂时还没有使用记录" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

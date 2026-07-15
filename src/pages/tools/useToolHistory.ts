import { useCallback, useMemo, useState } from "react";
import { message } from "antd";

import type { HistoryScope, ToolHistoryItem, ToolType } from "./types";
import { TOOL_HISTORY_LIMIT, TOOL_HISTORY_STORAGE_KEY, readToolHistory, trimHistoryText, writeToolHistory } from "./toolUtils";

export type ToolHistoryDraft = Omit<ToolHistoryItem, "id" | "createdAt">;
export type PushToolHistory = (entry: ToolHistoryDraft) => void;

export function useToolHistory(activeTool: ToolType) {
  const [history, setHistory] = useState<ToolHistoryItem[]>(() => readToolHistory());
  const [historyScope, setHistoryScope] = useState<HistoryScope>("current");

  const historyItems = useMemo(() => {
    if (historyScope === "all") {
      return history;
    }

    return history.filter((item) => item.tool === activeTool);
  }, [activeTool, history, historyScope]);

  const pushHistory = useCallback((entry: ToolHistoryDraft) => {
    setHistory((current) => {
      const nextItem: ToolHistoryItem = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        input: trimHistoryText(entry.input),
        secondaryInput: entry.secondaryInput ? trimHistoryText(entry.secondaryInput) : undefined,
        output: entry.output ? trimHistoryText(entry.output) : undefined,
        createdAt: new Date().toISOString(),
      };

      const deduped = current.filter(
        (item) => !(item.tool === nextItem.tool && item.action === nextItem.action && item.input === nextItem.input),
      );
      const next = [nextItem, ...deduped].slice(0, TOOL_HISTORY_LIMIT);
      writeToolHistory(next);
      return next;
    });
  }, []);

  const removeHistoryItem = useCallback((id: string) => {
    setHistory((current) => {
      const next = current.filter((item) => item.id !== id);
      writeToolHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOOL_HISTORY_STORAGE_KEY);
    }
    message.success("已清空工具历史记录");
  }, []);

  return {
    history,
    historyScope,
    setHistoryScope,
    historyItems,
    pushHistory,
    removeHistoryItem,
    clearHistory,
  };
}

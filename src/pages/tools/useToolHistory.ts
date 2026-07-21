import { useCallback, useMemo, useState } from "react";
import { message } from "antd";

import type { HistoryScope, ToolHistoryItem, ToolType } from "./types";
import {
  buildToolHistoryKey,
  TOOL_HISTORY_LIMIT,
  TOOL_HISTORY_STORAGE_KEY,
  TOOL_HISTORY_TEXT_LIMIT,
  readToolHistory,
  trimHistoryText,
  writeToolHistory,
} from "./toolUtils";

export type ToolHistoryDraft = Omit<
  ToolHistoryItem,
  "id" | "createdAt" | "historyKey" | "restorable"
>;
export type PushToolHistory = (entry: ToolHistoryDraft) => void;

export function createToolHistoryItem(
  entry: ToolHistoryDraft,
  id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  createdAt = new Date().toISOString(),
): ToolHistoryItem {
  const restorable = [entry.input, entry.secondaryInput, entry.output]
    .filter((value): value is string => typeof value === "string")
    .every((value) => value.length <= TOOL_HISTORY_TEXT_LIMIT);

  return {
    ...entry,
    id,
    historyKey: buildToolHistoryKey(entry),
    restorable,
    input: trimHistoryText(entry.input),
    secondaryInput: entry.secondaryInput
      ? trimHistoryText(entry.secondaryInput)
      : undefined,
    output: entry.output ? trimHistoryText(entry.output) : undefined,
    createdAt,
  };
}

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
      const nextItem = createToolHistoryItem(entry);

      const deduped = current.filter(
        (item) => item.historyKey !== nextItem.historyKey,
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

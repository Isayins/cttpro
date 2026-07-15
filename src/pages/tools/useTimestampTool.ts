import { useCallback, useState } from "react";

import type { ToolHistoryItem } from "./types";
import type { PushToolHistory } from "./useToolHistory";

export function useTimestampTool(pushHistory: PushToolHistory) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const convert = useCallback(() => {
    setError(null);

    try {
      if (!input.trim()) {
        throw new Error("请输入时间戳或日期");
      }

      const trimmedInput = input.trim();
      let nextOutput = "";

      if (/^\d{10,13}$/.test(trimmedInput)) {
        const timestamp = Number(trimmedInput.length === 10 ? `${trimmedInput}000` : trimmedInput);
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) {
          throw new Error("时间戳无效");
        }

        nextOutput = [
          `本地时间：${date.toLocaleString("zh-CN")}`,
          `ISO：${date.toISOString()}`,
          `毫秒：${timestamp}`,
          `秒：${Math.floor(timestamp / 1000)}`,
        ].join("\n");
      } else {
        const date = new Date(trimmedInput);
        if (Number.isNaN(date.getTime())) {
          throw new Error("日期格式无效");
        }

        nextOutput = [
          `毫秒：${date.getTime()}`,
          `秒：${Math.floor(date.getTime() / 1000)}`,
          `本地时间：${date.toLocaleString("zh-CN")}`,
          `ISO：${date.toISOString()}`,
        ].join("\n");
      }

      setOutput(nextOutput);
      pushHistory({
        tool: "timestamp",
        action: "时间戳转换",
        input: trimmedInput,
        output: nextOutput,
      });
    } catch (convertError) {
      setOutput("");
      setError(convertError instanceof Error ? convertError.message : "时间转换失败");
    }
  }, [input, pushHistory]);

  const clear = useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
    setCopied(false);
  }, []);

  const restore = useCallback((item: ToolHistoryItem) => {
    setInput(item.input);
    setOutput(item.output ?? "");
    setError(null);
  }, []);

  return {
    input,
    output,
    copied,
    error,
    setInput,
    setCopied,
    convert,
    clear,
    restore,
  };
}

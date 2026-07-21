import { useCallback, useState } from "react";

import { parseUnixTimestamp } from "./toolUtils";
import type { TimestampUnit, ToolHistoryItem } from "./types";
import type { PushToolHistory } from "./useToolHistory";

export function useTimestampTool(pushHistory: PushToolHistory) {
  const [input, setInput] = useState("");
  const [unit, setUnit] = useState<TimestampUnit>("auto");
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

      if (/^[+-]?\d+$/.test(trimmedInput)) {
        const parsed = parseUnixTimestamp(trimmedInput, unit);

        nextOutput = [
          `识别单位：${parsed.unit === "seconds" ? "秒" : "毫秒"}`,
          `本地时间：${parsed.date.toLocaleString("zh-CN")}`,
          `ISO：${parsed.date.toISOString()}`,
          `毫秒：${parsed.milliseconds}`,
          `秒：${Math.floor(parsed.milliseconds / 1000)}`,
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
        timestampUnit: unit,
      });
    } catch (convertError) {
      setOutput("");
      setError(convertError instanceof Error ? convertError.message : "时间转换失败");
    }
  }, [input, pushHistory, unit]);

  const clear = useCallback(() => {
    setInput("");
    setUnit("auto");
    setOutput("");
    setError(null);
    setCopied(false);
  }, []);

  const restore = useCallback((item: ToolHistoryItem) => {
    setInput(item.input);
    setUnit(item.timestampUnit ?? "auto");
    setOutput(item.output ?? "");
    setError(null);
  }, []);

  return {
    input,
    unit,
    output,
    copied,
    error,
    setInput,
    setUnit,
    setCopied,
    convert,
    clear,
    restore,
  };
}

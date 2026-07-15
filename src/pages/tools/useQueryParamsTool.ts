import { useCallback, useState } from "react";

import type { ToolHistoryItem } from "./types";
import { buildQueryOutput } from "./toolUtils";
import type { PushToolHistory } from "./useToolHistory";

export function useQueryParamsTool(pushHistory: PushToolHistory) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parse = useCallback(() => {
    setError(null);

    try {
      if (!input.trim()) {
        throw new Error("请输入完整 URL 或查询字符串");
      }

      const nextOutput = buildQueryOutput(input);
      setOutput(nextOutput);
      pushHistory({
        tool: "query",
        action: "URL 参数解析",
        input: input.trim(),
        output: nextOutput,
      });
    } catch (parseError) {
      setOutput("");
      setError(parseError instanceof Error ? parseError.message : "URL 参数解析失败");
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
    parse,
    clear,
    restore,
  };
}

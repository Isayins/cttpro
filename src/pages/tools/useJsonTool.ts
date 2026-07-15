import { useCallback, useState } from "react";

import type { ToolHistoryItem } from "./types";
import type { PushToolHistory } from "./useToolHistory";

export function useJsonTool(pushHistory: PushToolHistory) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const format = useCallback(
    (pretty: boolean) => {
      setError(null);
      try {
        if (!input.trim()) {
          throw new Error("请输入 JSON 内容");
        }

        const nextOutput = JSON.stringify(JSON.parse(input), null, pretty ? 2 : 0);
        setOutput(nextOutput);
        pushHistory({
          tool: "json",
          action: pretty ? "JSON 格式化" : "JSON 压缩",
          input: input.trim(),
          output: nextOutput,
        });
      } catch (formatError) {
        setOutput("");
        setError(formatError instanceof Error ? formatError.message : "JSON 解析失败");
      }
    },
    [input, pushHistory],
  );

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
    format,
    clear,
    restore,
  };
}

import { useCallback, useState } from "react";

import type { CodecMode, ToolHistoryItem } from "./types";
import { decodeBase64, encodeBase64 } from "./toolUtils";
import type { PushToolHistory } from "./useToolHistory";

export function useBase64Tool(pushHistory: PushToolHistory) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<CodecMode>("encode");

  const convert = useCallback(() => {
    setError(null);

    try {
      if (!input.trim()) {
        throw new Error("请输入待处理内容");
      }

      const nextOutput = mode === "encode" ? encodeBase64(input) : decodeBase64(input.trim());
      setOutput(nextOutput);
      pushHistory({
        tool: "base64",
        action: mode === "encode" ? "Base64 编码" : "Base64 解码",
        input,
        output: nextOutput,
        mode,
      });
    } catch (convertError) {
      setOutput("");
      setError(convertError instanceof Error ? convertError.message : "Base64 转换失败");
    }
  }, [input, mode, pushHistory]);

  const clear = useCallback(() => {
    setInput("");
    setOutput("");
    setError(null);
    setCopied(false);
  }, []);

  const restore = useCallback((item: ToolHistoryItem) => {
    setInput(item.input);
    setOutput(item.output ?? "");
    setMode(item.mode ?? "encode");
    setError(null);
  }, []);

  return {
    input,
    output,
    copied,
    error,
    mode,
    setInput,
    setCopied,
    setMode,
    convert,
    clear,
    restore,
  };
}

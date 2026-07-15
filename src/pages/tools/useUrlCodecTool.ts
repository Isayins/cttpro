import { useCallback, useState } from "react";
import { message } from "antd";

import type { CodecMode, ToolHistoryItem } from "./types";
import type { PushToolHistory } from "./useToolHistory";

export function useUrlCodecTool(pushHistory: PushToolHistory) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<CodecMode>("encode");

  const convert = useCallback(() => {
    if (!input.trim()) {
      setOutput("");
      return;
    }

    try {
      const nextOutput = mode === "encode" ? encodeURIComponent(input) : decodeURIComponent(input);
      setOutput(nextOutput);
      pushHistory({
        tool: "url",
        action: mode === "encode" ? "URL 编码" : "URL 解码",
        input,
        output: nextOutput,
        mode,
      });
    } catch {
      setOutput("");
      message.error("URL 转换失败");
    }
  }, [input, mode, pushHistory]);

  const clear = useCallback(() => {
    setInput("");
    setOutput("");
    setCopied(false);
  }, []);

  const restore = useCallback((item: ToolHistoryItem) => {
    setInput(item.input);
    setOutput(item.output ?? "");
    setMode(item.mode ?? "encode");
  }, []);

  return {
    input,
    output,
    copied,
    mode,
    setInput,
    setCopied,
    setMode,
    convert,
    clear,
    restore,
  };
}

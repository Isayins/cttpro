import { useCallback, useState } from "react";

import type { CurlCodeMode, ToolHistoryItem } from "./types";
import { buildCurlCodeOutput } from "./toolUtils";
import type { PushToolHistory } from "./useToolHistory";

export function useCurlCodeTool(pushHistory: PushToolHistory) {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<CurlCodeMode>("fetch");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(() => {
    setError(null);

    try {
      if (!input.trim()) {
        throw new Error("请输入 cURL 命令");
      }

      const nextOutput = buildCurlCodeOutput(input, mode);
      setOutput(nextOutput);
      pushHistory({
        tool: "curlcode",
        action: `cURL 转 ${mode === "python" ? "Python" : mode === "axios" ? "Axios" : "Fetch"}`,
        input: input.trim(),
        output: nextOutput,
        codeMode: mode,
      });
    } catch (generateError) {
      setOutput("");
      setError(generateError instanceof Error ? generateError.message : "cURL 转换失败");
    }
  }, [input, mode, pushHistory]);

  const clear = useCallback(() => {
    setInput("");
    setMode("fetch");
    setOutput("");
    setCopied(false);
    setError(null);
  }, []);

  const restore = useCallback((item: ToolHistoryItem) => {
    setInput(item.input);
    setMode(item.codeMode ?? "fetch");
    setOutput(item.output ?? "");
    setError(null);
  }, []);

  return {
    input,
    mode,
    output,
    copied,
    error,
    setInput,
    setMode,
    setCopied,
    generate,
    clear,
    restore,
  };
}

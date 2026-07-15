import { useCallback, useState } from "react";

import type { ToolHistoryItem } from "./types";
import { buildTypeScriptTypesFromJson } from "./toolUtils";
import type { PushToolHistory } from "./useToolHistory";

export function useJsonTypesTool(pushHistory: PushToolHistory) {
  const [input, setInput] = useState("");
  const [rootName, setRootName] = useState("Root");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(() => {
    setError(null);

    try {
      if (!input.trim()) {
        throw new Error("请输入 JSON 示例");
      }

      const nextOutput = buildTypeScriptTypesFromJson(input, rootName);
      setOutput(nextOutput);
      pushHistory({
        tool: "jsontypes",
        action: "JSON 转 TS 类型",
        input: input.trim(),
        secondaryInput: rootName.trim() || "Root",
        output: nextOutput,
      });
    } catch (generateError) {
      setOutput("");
      setError(generateError instanceof Error ? generateError.message : "JSON 类型生成失败");
    }
  }, [input, pushHistory, rootName]);

  const clear = useCallback(() => {
    setInput("");
    setRootName("Root");
    setOutput("");
    setCopied(false);
    setError(null);
  }, []);

  const restore = useCallback((item: ToolHistoryItem) => {
    setInput(item.input);
    setRootName(item.secondaryInput ?? "Root");
    setOutput(item.output ?? "");
    setError(null);
  }, []);

  return {
    input,
    rootName,
    output,
    copied,
    error,
    setInput,
    setRootName,
    setCopied,
    generate,
    clear,
    restore,
  };
}

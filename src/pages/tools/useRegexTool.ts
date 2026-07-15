import { useCallback, useState } from "react";

import type { ToolHistoryItem } from "./types";
import { buildRegexOutput, normalizeRegexFlags } from "./toolUtils";
import type { PushToolHistory } from "./useToolHistory";

export function useRegexTool(pushHistory: PushToolHistory) {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [sample, setSample] = useState("");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const test = useCallback(() => {
    setError(null);

    try {
      if (!pattern) {
        throw new Error("请输入正则表达式");
      }

      const normalizedFlags = normalizeRegexFlags(flags);
      setFlags(normalizedFlags);
      const nextOutput = buildRegexOutput(pattern, normalizedFlags, sample);
      setOutput(nextOutput);
      pushHistory({
        tool: "regex",
        action: "正则测试",
        input: pattern,
        secondaryInput: sample,
        output: nextOutput,
        flags: normalizedFlags,
      });
    } catch (testError) {
      setOutput("");
      setError(testError instanceof Error ? testError.message : "正则测试失败");
    }
  }, [flags, pattern, pushHistory, sample]);

  const clear = useCallback(() => {
    setPattern("");
    setFlags("g");
    setSample("");
    setOutput("");
    setError(null);
    setCopied(false);
  }, []);

  const restore = useCallback((item: ToolHistoryItem) => {
    setPattern(item.input);
    setSample(item.secondaryInput ?? "");
    setOutput(item.output ?? "");
    setFlags(item.flags ?? "g");
    setError(null);
  }, []);

  return {
    pattern,
    flags,
    sample,
    output,
    copied,
    error,
    setPattern,
    setFlags,
    setSample,
    setCopied,
    test,
    clear,
    restore,
  };
}

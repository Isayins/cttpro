import { useCallback, useMemo, useState } from "react";

import type { SubscriptionTarget, ToolHistoryItem } from "./types";
import {
  buildClientImportLinks,
  buildSubConvertResult,
  buildSubscriptionSourceStat,
  defaultShortLinkTemplate,
  defaultSubConvertBackend,
  getSubscriptionTargetLabel,
  type ClientImportLink,
  type SubscriptionSourceStat,
} from "./subConvertUtils";
import type { PushToolHistory } from "./useToolHistory";

const defaultOutputName = "IDNCAR Subscription";
const defaultFlags = "EUA";

function buildFlags(values: {
  emoji: boolean;
  udp: boolean;
  tfo: boolean;
  skipCertVerify: boolean;
  appendType: boolean;
  sort: boolean;
}) {
  return [
    values.emoji ? "E" : "",
    values.udp ? "U" : "",
    values.tfo ? "T" : "",
    values.skipCertVerify ? "S" : "",
    values.appendType ? "A" : "",
    values.sort ? "R" : "",
  ].join("");
}

function parseFlags(flags = defaultFlags) {
  return {
    emoji: flags.includes("E"),
    udp: flags.includes("U"),
    tfo: flags.includes("T"),
    skipCertVerify: flags.includes("S"),
    appendType: flags.includes("A"),
    sort: flags.includes("R"),
  };
}

export function useSubConvertTool(pushHistory: PushToolHistory) {
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<SubscriptionTarget>("clash");
  const [backendUrl, setBackendUrl] = useState(defaultSubConvertBackend);
  const [shortLinkTemplate, setShortLinkTemplate] = useState(defaultShortLinkTemplate);
  const [outputName, setOutputName] = useState(defaultOutputName);
  const [configUrl, setConfigUrl] = useState("");
  const [includeFilter, setIncludeFilter] = useState("");
  const [excludeFilter, setExcludeFilter] = useState("");
  const [emoji, setEmoji] = useState(true);
  const [udp, setUdp] = useState(true);
  const [tfo, setTfo] = useState(false);
  const [skipCertVerify, setSkipCertVerify] = useState(false);
  const [appendType, setAppendType] = useState(true);
  const [sort, setSort] = useState(false);
  const [convertedUrl, setConvertedUrl] = useState("");
  const [shortLinkUrl, setShortLinkUrl] = useState("");
  const [clientLinks, setClientLinks] = useState<ClientImportLink[]>([]);
  const [stats, setStats] = useState<SubscriptionSourceStat | null>(null);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flags = useMemo(
    () => buildFlags({ emoji, udp, tfo, skipCertVerify, appendType, sort }),
    [appendType, emoji, skipCertVerify, sort, tfo, udp],
  );

  const generate = useCallback(() => {
    setError(null);
    setCopied(false);

    try {
      const result = buildSubConvertResult({
        input,
        target,
        backendUrl,
        outputName,
        configUrl,
        includeFilter,
        excludeFilter,
        shortLinkTemplate,
        emoji,
        udp,
        tfo,
        skipCertVerify,
        appendType,
        sort,
      });

      setConvertedUrl(result.convertedUrl);
      setShortLinkUrl(result.shortLinkUrl);
      setClientLinks(result.clientLinks);
      setStats(result.stats);
      setOutput(result.output);
      pushHistory({
        tool: "subconvert",
        action: `订阅转换 ${getSubscriptionTargetLabel(target)}`,
        input,
        output: result.output,
        subscriptionTarget: target,
        backendUrl,
        shortLinkTemplate,
        configUrl,
        includeFilter,
        excludeFilter,
        outputName,
        convertedUrl: result.convertedUrl,
        shortLinkUrl: result.shortLinkUrl,
        flags,
      });
    } catch (convertError) {
      setConvertedUrl("");
      setShortLinkUrl("");
      setClientLinks([]);
      setStats(null);
      setOutput("");
      setError(convertError instanceof Error ? convertError.message : "订阅转换链接生成失败");
    }
  }, [
    appendType,
    backendUrl,
    configUrl,
    emoji,
    excludeFilter,
    flags,
    includeFilter,
    input,
    outputName,
    pushHistory,
    shortLinkTemplate,
    skipCertVerify,
    sort,
    target,
    tfo,
    udp,
  ]);

  const clear = useCallback(() => {
    setInput("");
    setConvertedUrl("");
    setShortLinkUrl("");
    setClientLinks([]);
    setStats(null);
    setOutput("");
    setCopied(false);
    setError(null);
  }, []);

  const restore = useCallback((item: ToolHistoryItem) => {
    const nextFlags = parseFlags(item.flags);
    const nextTarget = item.subscriptionTarget ?? "clash";
    const nextBackendUrl = item.backendUrl ?? defaultSubConvertBackend;
    const nextShortLinkTemplate = item.shortLinkTemplate ?? defaultShortLinkTemplate;
    const nextOutputName = item.outputName ?? defaultOutputName;
    const nextConvertedUrl = item.convertedUrl ?? "";

    setInput(item.input);
    setTarget(nextTarget);
    setBackendUrl(nextBackendUrl);
    setShortLinkTemplate(nextShortLinkTemplate);
    setOutputName(nextOutputName);
    setConfigUrl(item.configUrl ?? "");
    setIncludeFilter(item.includeFilter ?? "");
    setExcludeFilter(item.excludeFilter ?? "");
    setEmoji(nextFlags.emoji);
    setUdp(nextFlags.udp);
    setTfo(nextFlags.tfo);
    setSkipCertVerify(nextFlags.skipCertVerify);
    setAppendType(nextFlags.appendType);
    setSort(nextFlags.sort);
    setConvertedUrl(nextConvertedUrl);
    setShortLinkUrl(item.shortLinkUrl ?? "");
    setClientLinks(nextConvertedUrl ? buildClientImportLinks(nextConvertedUrl, nextOutputName) : []);
    setStats(buildSubscriptionSourceStat(item.input));
    setOutput(item.output ?? "");
    setCopied(false);
    setError(null);
  }, []);

  return {
    input,
    target,
    backendUrl,
    shortLinkTemplate,
    outputName,
    configUrl,
    includeFilter,
    excludeFilter,
    emoji,
    udp,
    tfo,
    skipCertVerify,
    appendType,
    sort,
    convertedUrl,
    shortLinkUrl,
    clientLinks,
    stats,
    output,
    copied,
    error,
    setInput,
    setTarget,
    setBackendUrl,
    setShortLinkTemplate,
    setOutputName,
    setConfigUrl,
    setIncludeFilter,
    setExcludeFilter,
    setEmoji,
    setUdp,
    setTfo,
    setSkipCertVerify,
    setAppendType,
    setSort,
    setCopied,
    generate,
    clear,
    restore,
  };
}

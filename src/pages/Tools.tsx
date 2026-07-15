import { lazy, Suspense, useEffect, useState, type ChangeEvent } from "react";
import { message } from "antd";

import { Card, CardContent } from "../components/ui";
import MainLayout from "../layouts/MainLayout";
import { getErrorMessage } from "../lib/errorMessage";
import { toolsApi } from "../services/api/tools";
import { ToolPanelHeader, ToolsPageHeader } from "./tools/ToolsHeader";
import { ToolsSidebar } from "./tools/ToolsSidebar";
import type {
  CodecMode,
  CronMode,
  CsvDelimiter,
  HashAlgorithm,
  TextTransformMode,
  ToolHistoryItem,
  ToolType,
} from "./tools/types";
import {
  buildColorOutput,
  buildCsvJsonOutput,
  buildLineDiff,
  clampNumber,
  createUuidV4,
  decodeBase64Url,
  digestText,
  escapeHtml,
  formatJsonBlock,
  formatJwtUnixClaim,
  generatePassword,
  getHistoryPreview,
  parseColor,
  rgbToHex,
  transformText,
  textTransformOptions,
  unescapeHtml,
  weekOptions,
} from "./tools/toolUtils";
import { useBase64Tool } from "./tools/useBase64Tool";
import { useCurlCodeTool } from "./tools/useCurlCodeTool";
import { useJsonTool } from "./tools/useJsonTool";
import { useJsonTypesTool } from "./tools/useJsonTypesTool";
import { useQueryParamsTool } from "./tools/useQueryParamsTool";
import { decodeQrCodeFromFile } from "./tools/qrDecodeUtils";
import { useRegexTool } from "./tools/useRegexTool";
import { useSubConvertTool } from "./tools/useSubConvertTool";
import { useTimestampTool } from "./tools/useTimestampTool";
import { useToolHistory } from "./tools/useToolHistory";
import { useUrlCodecTool } from "./tools/useUrlCodecTool";

const Base64ToolPanel = lazy(() =>
  import("./tools/Base64ToolPanel").then((module) => ({
    default: module.Base64ToolPanel,
  })),
);
const ColorToolPanel = lazy(() =>
  import("./tools/ColorToolPanel").then((module) => ({
    default: module.ColorToolPanel,
  })),
);
const CronToolPanel = lazy(() =>
  import("./tools/CronToolPanel").then((module) => ({
    default: module.CronToolPanel,
  })),
);
const CsvJsonToolPanel = lazy(() =>
  import("./tools/CsvJsonToolPanel").then((module) => ({
    default: module.CsvJsonToolPanel,
  })),
);
const CurlCodeToolPanel = lazy(() =>
  import("./tools/CurlCodeToolPanel").then((module) => ({
    default: module.CurlCodeToolPanel,
  })),
);
const DiagnosticsToolPanel = lazy(() =>
  import("./tools/DiagnosticsToolPanel").then((module) => ({
    default: module.DiagnosticsToolPanel,
  })),
);
const HashToolPanel = lazy(() =>
  import("./tools/HashToolPanel").then((module) => ({
    default: module.HashToolPanel,
  })),
);
const HtmlEntityToolPanel = lazy(() =>
  import("./tools/HtmlEntityToolPanel").then((module) => ({
    default: module.HtmlEntityToolPanel,
  })),
);
const JavaDecompileToolPanel = lazy(() =>
  import("./tools/JavaDecompileToolPanel").then((module) => ({
    default: module.JavaDecompileToolPanel,
  })),
);
const JsonFormatToolPanel = lazy(() =>
  import("./tools/JsonFormatToolPanel").then((module) => ({
    default: module.JsonFormatToolPanel,
  })),
);
const JsonTypesToolPanel = lazy(() =>
  import("./tools/JsonTypesToolPanel").then((module) => ({
    default: module.JsonTypesToolPanel,
  })),
);
const JwtToolPanel = lazy(() =>
  import("./tools/JwtToolPanel").then((module) => ({
    default: module.JwtToolPanel,
  })),
);
const PasswordToolPanel = lazy(() =>
  import("./tools/PasswordToolPanel").then((module) => ({
    default: module.PasswordToolPanel,
  })),
);
const QueryParamsToolPanel = lazy(() =>
  import("./tools/QueryParamsToolPanel").then((module) => ({
    default: module.QueryParamsToolPanel,
  })),
);
const QrcodeToolPanel = lazy(() =>
  import("./tools/QrcodeToolPanel").then((module) => ({
    default: module.QrcodeToolPanel,
  })),
);
const QrDecodeToolPanel = lazy(() =>
  import("./tools/QrDecodeToolPanel").then((module) => ({
    default: module.QrDecodeToolPanel,
  })),
);
const RegexToolPanel = lazy(() =>
  import("./tools/RegexToolPanel").then((module) => ({
    default: module.RegexToolPanel,
  })),
);
const SubConvertToolPanel = lazy(() =>
  import("./tools/SubConvertToolPanel").then((module) => ({
    default: module.SubConvertToolPanel,
  })),
);
const TextDiffToolPanel = lazy(() =>
  import("./tools/TextDiffToolPanel").then((module) => ({
    default: module.TextDiffToolPanel,
  })),
);
const TextTransformToolPanel = lazy(() =>
  import("./tools/TextTransformToolPanel").then((module) => ({
    default: module.TextTransformToolPanel,
  })),
);
const TimestampToolPanel = lazy(() =>
  import("./tools/TimestampToolPanel").then((module) => ({
    default: module.TimestampToolPanel,
  })),
);
const UrlCodecToolPanel = lazy(() =>
  import("./tools/UrlCodecToolPanel").then((module) => ({
    default: module.UrlCodecToolPanel,
  })),
);
const UuidToolPanel = lazy(() =>
  import("./tools/UuidToolPanel").then((module) => ({
    default: module.UuidToolPanel,
  })),
);

function ToolPanelLoadingFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-500">
      工具加载中...
    </div>
  );
}

export default function Tools() {
  const [activeTool, setActiveTool] = useState<ToolType>("json");
  const {
    history,
    historyScope,
    setHistoryScope,
    historyItems,
    pushHistory,
    removeHistoryItem,
    clearHistory,
  } = useToolHistory(activeTool);
  const jsonTool = useJsonTool(pushHistory);
  const jsonTypesTool = useJsonTypesTool(pushHistory);
  const timestampTool = useTimestampTool(pushHistory);
  const base64Tool = useBase64Tool(pushHistory);
  const urlTool = useUrlCodecTool(pushHistory);
  const queryTool = useQueryParamsTool(pushHistory);
  const curlCodeTool = useCurlCodeTool(pushHistory);
  const regexTool = useRegexTool(pushHistory);
  const subConvertTool = useSubConvertTool(pushHistory);

  const [diffLeft, setDiffLeft] = useState("");
  const [diffRight, setDiffRight] = useState("");
  const [diffOutput, setDiffOutput] = useState("");
  const [diffCopied, setDiffCopied] = useState(false);

  const [colorInput, setColorInput] = useState("");
  const [colorOutput, setColorOutput] = useState("");
  const [colorSwatch, setColorSwatch] = useState("#2563EB");
  const [colorCopied, setColorCopied] = useState(false);
  const [colorError, setColorError] = useState<string | null>(null);

  const [passwordLength, setPasswordLength] = useState(16);
  const [passwordCount, setPasswordCount] = useState(5);
  const [passwordUseUpper, setPasswordUseUpper] = useState(true);
  const [passwordUseLower, setPasswordUseLower] = useState(true);
  const [passwordUseNumbers, setPasswordUseNumbers] = useState(true);
  const [passwordUseSymbols, setPasswordUseSymbols] = useState(true);
  const [passwordOutput, setPasswordOutput] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [htmlInput, setHtmlInput] = useState("");
  const [htmlOutput, setHtmlOutput] = useState("");
  const [htmlMode, setHtmlMode] = useState<CodecMode>("encode");
  const [htmlCopied, setHtmlCopied] = useState(false);

  const [csvInput, setCsvInput] = useState("");
  const [csvDelimiter, setCsvDelimiter] = useState<CsvDelimiter>("comma");
  const [csvOutput, setCsvOutput] = useState("");
  const [csvCopied, setCsvCopied] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const [textInput, setTextInput] = useState("");
  const [textMode, setTextMode] = useState<TextTransformMode>("trim");
  const [textOutput, setTextOutput] = useState("");
  const [textCopied, setTextCopied] = useState(false);

  const [diagnosticsCount, setDiagnosticsCount] = useState(3);
  const [diagnosticsOutput, setDiagnosticsOutput] = useState("");
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);

  const [jwtInput, setJwtInput] = useState("");
  const [jwtOutput, setJwtOutput] = useState("");
  const [jwtCopied, setJwtCopied] = useState(false);
  const [jwtError, setJwtError] = useState<string | null>(null);

  const [uuidCount, setUuidCount] = useState(5);
  const [uuidOutput, setUuidOutput] = useState("");
  const [uuidCopied, setUuidCopied] = useState(false);

  const [hashInput, setHashInput] = useState("");
  const [hashAlgorithm, setHashAlgorithm] = useState<HashAlgorithm>("SHA-256");
  const [hashOutput, setHashOutput] = useState("");
  const [hashCopied, setHashCopied] = useState(false);
  const [hashError, setHashError] = useState<string | null>(null);

  const [cronMode, setCronMode] = useState<CronMode>("minutes");
  const [cronIntervalMinutes, setCronIntervalMinutes] = useState(5);
  const [cronMinute, setCronMinute] = useState(0);
  const [cronHour, setCronHour] = useState(9);
  const [cronWeekday, setCronWeekday] = useState(1);
  const [cronMonthDay, setCronMonthDay] = useState(1);
  const [cronOutput, setCronOutput] = useState("");
  const [cronDescription, setCronDescription] = useState("");
  const [cronCopied, setCronCopied] = useState(false);
  const [cronError, setCronError] = useState<string | null>(null);

  const [qrcodeInput, setQrcodeInput] = useState("");
  const [qrcodeSize, setQrcodeSize] = useState(180);
  const [qrcodeValue, setQrcodeValue] = useState("");

  const [qrDecodeFileName, setQrDecodeFileName] = useState("");
  const [qrDecodePreviewUrl, setQrDecodePreviewUrl] = useState("");
  const [qrDecodeOutput, setQrDecodeOutput] = useState("");
  const [qrDecodeCopied, setQrDecodeCopied] = useState(false);
  const [qrDecodeError, setQrDecodeError] = useState<string | null>(null);
  const [qrDecoding, setQrDecoding] = useState(false);

  const [javaClassContent, setJavaClassContent] = useState("");
  const [javaDecompileOutput, setJavaDecompileOutput] = useState("");
  const [javaDecompileCopied, setJavaDecompileCopied] = useState(false);
  const [javaDecompileError, setJavaDecompileError] = useState<string | null>(
    null,
  );
  const [javaFileName, setJavaFileName] = useState("");
  const [javaDecompiling, setJavaDecompiling] = useState(false);

  const copyText = async (
    value: string,
    setCopied: (value: boolean) => void,
  ) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      message.error("复制失败，请检查浏览器剪贴板权限");
    }
  };

  useEffect(() => {
    return () => {
      if (qrDecodePreviewUrl) {
        URL.revokeObjectURL(qrDecodePreviewUrl);
      }
    };
  }, [qrDecodePreviewUrl]);

  const resetCopiedStates = () => {
    [
      jsonTool.setCopied,
      jsonTypesTool.setCopied,
      timestampTool.setCopied,
      base64Tool.setCopied,
      urlTool.setCopied,
      queryTool.setCopied,
      curlCodeTool.setCopied,
      regexTool.setCopied,
      subConvertTool.setCopied,
      setDiffCopied,
      setColorCopied,
      setPasswordCopied,
      setHtmlCopied,
      setCsvCopied,
      setTextCopied,
      setDiagnosticsCopied,
      setJwtCopied,
      setUuidCopied,
      setHashCopied,
      setCronCopied,
      setQrDecodeCopied,
      setJavaDecompileCopied,
    ].forEach((setCopied) => setCopied(false));
  };

  const restoreHistoryItem = (item: ToolHistoryItem) => {
    resetCopiedStates();
    setActiveTool(item.tool);

    switch (item.tool) {
      case "json":
        jsonTool.restore(item);
        break;
      case "jsontypes":
        jsonTypesTool.restore(item);
        break;
      case "timestamp":
        timestampTool.restore(item);
        break;
      case "base64":
        base64Tool.restore(item);
        break;
      case "url":
        urlTool.restore(item);
        break;
      case "query":
        queryTool.restore(item);
        break;
      case "curlcode":
        curlCodeTool.restore(item);
        break;
      case "regex":
        regexTool.restore(item);
        break;
      case "subconvert":
        subConvertTool.restore(item);
        break;
      case "diff":
        setDiffLeft(item.input);
        setDiffRight(item.secondaryInput ?? "");
        setDiffOutput(item.output ?? "");
        break;
      case "color":
        setColorInput(item.input);
        setColorOutput(item.output ?? "");
        setColorError(null);
        try {
          setColorSwatch(rgbToHex(parseColor(item.input)));
        } catch {
          setColorSwatch("#2563EB");
        }
        break;
      case "password": {
        const flags = item.flags ?? "ULNS";
        setPasswordLength(item.size ?? 16);
        setPasswordCount(item.count ?? 5);
        setPasswordUseUpper(flags.includes("U"));
        setPasswordUseLower(flags.includes("L"));
        setPasswordUseNumbers(flags.includes("N"));
        setPasswordUseSymbols(flags.includes("S"));
        setPasswordOutput(item.output ?? "");
        setPasswordError(null);
        break;
      }
      case "html":
        setHtmlInput(item.input);
        setHtmlOutput(item.output ?? "");
        setHtmlMode(item.mode ?? "encode");
        break;
      case "csv":
        setCsvInput(item.input);
        setCsvOutput(item.output ?? "");
        setCsvDelimiter(item.delimiter ?? "comma");
        setCsvError(null);
        break;
      case "text":
        setTextInput(item.input);
        setTextOutput(item.output ?? "");
        setTextMode(item.textMode ?? "trim");
        break;
      case "diagnostics":
        setDiagnosticsOutput(item.output ?? "");
        setDiagnosticsCount(item.count ?? 3);
        setDiagnosticsError(null);
        break;
      case "jwt":
        setJwtInput(item.input);
        setJwtOutput(item.output ?? "");
        setJwtError(null);
        break;
      case "uuid":
        setUuidOutput(item.output ?? "");
        setUuidCount(item.count ?? 5);
        break;
      case "hash":
        setHashInput(item.input);
        setHashOutput(item.output ?? "");
        setHashAlgorithm(item.algorithm ?? "SHA-256");
        setHashError(null);
        break;
      case "cron":
        setCronDescription(item.input);
        setCronOutput(item.output ?? "");
        setCronError(null);
        break;
      case "qrcode":
        setQrcodeInput(item.input);
        setQrcodeValue(
          item.output?.startsWith("https://api.qrserver.com/")
            ? item.input
            : (item.output ?? item.input),
        );
        setQrcodeSize(item.size ?? 180);
        break;
      case "qrdecode":
        setQrDecodeFileName(item.fileName ?? item.input);
        setQrDecodeOutput(item.output ?? "");
        setQrDecodePreviewUrl("");
        setQrDecodeError(null);
        break;
      case "javadecompile":
        setJavaClassContent(item.input);
        setJavaDecompileOutput(item.output ?? "");
        setJavaFileName(item.fileName ?? "");
        setJavaDecompileError(null);
        break;
    }

    message.success("已恢复到当前工具");
  };

  const handleTextDiff = () => {
    const output = buildLineDiff(diffLeft, diffRight);
    setDiffOutput(output);
    pushHistory({
      tool: "diff",
      action: "文本 Diff",
      input: diffLeft,
      secondaryInput: diffRight,
      output,
    });
  };

  const handleColorConvert = () => {
    setColorError(null);

    try {
      if (!colorInput.trim()) {
        throw new Error("请输入颜色值");
      }

      const rgb = parseColor(colorInput);
      const hex = rgbToHex(rgb);
      const output = buildColorOutput(rgb);
      setColorSwatch(hex);
      setColorOutput(output);
      pushHistory({
        tool: "color",
        action: "颜色转换",
        input: colorInput.trim(),
        output,
      });
    } catch (error) {
      setColorOutput("");
      setColorError(getErrorMessage(error, "颜色转换失败"));
    }
  };

  const handleGeneratePassword = () => {
    setPasswordError(null);

    const sets = [
      passwordUseUpper ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "",
      passwordUseLower ? "abcdefghijkmnopqrstuvwxyz" : "",
      passwordUseNumbers ? "23456789" : "",
      passwordUseSymbols ? "!@#$%^&*_-+=" : "",
    ].filter(Boolean);

    if (sets.length === 0) {
      setPasswordOutput("");
      setPasswordError("请至少选择一种字符类型");
      return;
    }

    const length = clampNumber(passwordLength, 6, 64);
    const count = clampNumber(passwordCount, 1, 30);
    const flags = `${passwordUseUpper ? "U" : ""}${passwordUseLower ? "L" : ""}${passwordUseNumbers ? "N" : ""}${passwordUseSymbols ? "S" : ""}`;
    setPasswordLength(length);
    setPasswordCount(count);

    const output = Array.from({ length: count }, () =>
      generatePassword(length, sets),
    ).join("\n");
    setPasswordOutput(output);
    pushHistory({
      tool: "password",
      action: `密码生成 x${count}`,
      input: `长度 ${length} / ${count} 个 / ${flags}`,
      output,
      size: length,
      count,
      flags,
    });
  };

  const handleHtmlConvert = () => {
    if (!htmlInput) {
      setHtmlOutput("");
      return;
    }

    const output =
      htmlMode === "encode" ? escapeHtml(htmlInput) : unescapeHtml(htmlInput);
    setHtmlOutput(output);
    pushHistory({
      tool: "html",
      action: htmlMode === "encode" ? "HTML 实体转义" : "HTML 实体还原",
      input: htmlInput,
      output,
      mode: htmlMode,
    });
  };

  const handleCsvConvert = () => {
    setCsvError(null);

    try {
      if (!csvInput.trim()) {
        throw new Error("请输入 CSV/TSV 内容");
      }

      const output = buildCsvJsonOutput(csvInput, csvDelimiter);
      setCsvOutput(output);
      pushHistory({
        tool: "csv",
        action: "CSV 转 JSON",
        input: csvInput,
        output,
        delimiter: csvDelimiter,
      });
    } catch (error) {
      setCsvOutput("");
      setCsvError(getErrorMessage(error, "CSV 转换失败"));
    }
  };

  const handleTextTransform = () => {
    const output = transformText(textInput, textMode);
    setTextOutput(output);
    pushHistory({
      tool: "text",
      action:
        textTransformOptions.find((item) => item.value === textMode)?.label ??
        "文本整理",
      input: textInput,
      output,
      textMode,
    });
  };

  const handleRunDiagnostics = async () => {
    setDiagnosticsCopied(false);
    setDiagnosticsError(null);

    try {
      setDiagnosticsRunning(true);
      const count = clampNumber(diagnosticsCount, 1, 8);
      setDiagnosticsCount(count);

      const lines: string[] = [
        `接口诊断次数：${count}`,
        `客户端开始：${new Date().toLocaleString("zh-CN")}`,
        "",
      ];
      let totalLatency = 0;
      let totalOffset = 0;

      for (let index = 0; index < count; index += 1) {
        const startedAt = Date.now();
        const result = await toolsApi.getDiagnostics();
        const endedAt = Date.now();
        const latency = endedAt - startedAt;
        const midpoint = Math.round((startedAt + endedAt) / 2);
        const offset = result.serverTimeMillis - midpoint;
        totalLatency += latency;
        totalOffset += offset;

        lines.push(
          `#${index + 1}`,
          `  requestId: ${result.requestId}`,
          `  RTT: ${latency} ms`,
          `  时钟偏移: ${offset >= 0 ? "+" : ""}${offset} ms`,
          `  服务端时间: ${result.serverTimeIso}`,
          `  服务端时区: ${result.serverZone}`,
          `  用户 ID: ${result.userId}`,
          `  Java: ${result.javaVersion ?? "未知"}`,
          `  RemoteAddr: ${result.remoteAddr ?? "未知"}`,
          `  X-Forwarded-For: ${result.forwardedFor ?? "无"}`,
          `  Path: ${result.method ?? "GET"} ${result.path ?? "/api/tools/diagnostics"}`,
          `  User-Agent: ${result.userAgent ?? "未知"}`,
          "",
        );
      }

      lines.splice(
        2,
        0,
        `平均 RTT：${Math.round(totalLatency / count)} ms`,
        `平均时钟偏移：${Math.round(totalOffset / count)} ms`,
      );
      const output = lines.join("\n").trim();
      setDiagnosticsOutput(output);
      pushHistory({
        tool: "diagnostics",
        action: `接口诊断 x${count}`,
        input: `连续请求 ${count} 次 / ${new Date().toLocaleString("zh-CN")}`,
        output,
        count,
      });
    } catch (error) {
      setDiagnosticsOutput("");
      setDiagnosticsError(getErrorMessage(error, "接口诊断失败"));
    } finally {
      setDiagnosticsRunning(false);
    }
  };

  const handleJwtParse = () => {
    setJwtError(null);

    try {
      const token = jwtInput.trim().replace(/^Bearer\s+/i, "");
      if (!token) {
        throw new Error("请输入 JWT Token");
      }

      const parts = token.split(".");
      if (parts.length < 2) {
        throw new Error("JWT 至少需要包含 Header 和 Payload 两段");
      }

      const header = JSON.parse(decodeBase64Url(parts[0])) as unknown;
      const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<
        string,
        unknown
      >;
      const timeHints = [
        formatJwtUnixClaim("签发时间 iat", payload.iat),
        formatJwtUnixClaim("生效时间 nbf", payload.nbf),
        formatJwtUnixClaim("过期时间 exp", payload.exp),
      ].filter(Boolean);
      const output = [
        "Header",
        formatJsonBlock(header),
        "",
        "Payload",
        formatJsonBlock(payload),
        ...(timeHints.length > 0 ? ["", "时间字段", ...timeHints] : []),
        "",
        `签名片段：${parts[2] ? getHistoryPreview(parts[2], 48) : "无"}`,
      ].join("\n");

      setJwtOutput(output);
      pushHistory({
        tool: "jwt",
        action: "JWT 解析",
        input: token,
        output,
      });
    } catch (error) {
      setJwtOutput("");
      setJwtError(getErrorMessage(error, "JWT 解析失败"));
    }
  };

  const handleGenerateUuid = () => {
    const count = clampNumber(uuidCount, 1, 50);
    setUuidCount(count);

    const output = Array.from({ length: count }, () => createUuidV4()).join(
      "\n",
    );
    setUuidOutput(output);
    pushHistory({
      tool: "uuid",
      action: `UUID 生成 x${count}`,
      input: `生成 ${count} 个 UUID v4`,
      output,
      count,
    });
  };

  const handleHashText = async () => {
    setHashError(null);

    try {
      if (!hashInput) {
        throw new Error("请输入要计算哈希的文本");
      }

      const output = await digestText(hashInput, hashAlgorithm);
      setHashOutput(output);
      pushHistory({
        tool: "hash",
        action: `${hashAlgorithm} 哈希`,
        input: hashInput,
        output,
        algorithm: hashAlgorithm,
      });
    } catch (error) {
      setHashOutput("");
      setHashError(getErrorMessage(error, "哈希计算失败"));
    }
  };

  const handleGenerateCron = () => {
    setCronError(null);

    try {
      let expression = "";
      let description = "";

      if (cronMode === "minutes") {
        const interval = clampNumber(cronIntervalMinutes, 1, 59);
        setCronIntervalMinutes(interval);
        expression = `*/${interval} * * * *`;
        description = `每隔 ${interval} 分钟执行一次。`;
      } else if (cronMode === "hourly") {
        const minute = clampNumber(cronMinute, 0, 59);
        setCronMinute(minute);
        expression = `${minute} * * * *`;
        description = `每小时的第 ${minute} 分执行。`;
      } else if (cronMode === "daily") {
        const hour = clampNumber(cronHour, 0, 23);
        const minute = clampNumber(cronMinute, 0, 59);
        setCronHour(hour);
        setCronMinute(minute);
        expression = `${minute} ${hour} * * *`;
        description = `每天 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} 执行。`;
      } else if (cronMode === "weekly") {
        const hour = clampNumber(cronHour, 0, 23);
        const minute = clampNumber(cronMinute, 0, 59);
        const weekday = clampNumber(cronWeekday, 0, 6);
        setCronHour(hour);
        setCronMinute(minute);
        setCronWeekday(weekday);
        expression = `${minute} ${hour} * * ${weekday}`;
        description = `每周${weekOptions.find((item) => item.value === weekday)?.label ?? "周一"} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} 执行。`;
      } else {
        const hour = clampNumber(cronHour, 0, 23);
        const minute = clampNumber(cronMinute, 0, 59);
        const monthDay = clampNumber(cronMonthDay, 1, 31);
        setCronHour(hour);
        setCronMinute(minute);
        setCronMonthDay(monthDay);
        expression = `${minute} ${hour} ${monthDay} * *`;
        description = `每月 ${monthDay} 日 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} 执行。`;
      }

      setCronOutput(expression);
      setCronDescription(description);
      pushHistory({
        tool: "cron",
        action: "Cron 表达式生成",
        input: description,
        output: expression,
      });
    } catch (error) {
      setCronOutput("");
      setCronDescription("");
      setCronError(getErrorMessage(error, "Cron 生成失败"));
    }
  };

  const handleGenerateQrCode = () => {
    if (!qrcodeInput.trim()) {
      message.warning("请输入二维码内容");
      return;
    }

    const output = qrcodeInput.trim();
    setQrcodeValue(output);
    pushHistory({
      tool: "qrcode",
      action: "二维码生成",
      input: qrcodeInput.trim(),
      output,
      size: qrcodeSize,
    });
  };

  const handleDecodeQrCode = async (file: File) => {
    setQrDecodeCopied(false);
    setQrDecodeError(null);
    setQrDecodeOutput("");
    setQrDecodeFileName(file.name);
    setQrDecodePreviewUrl(URL.createObjectURL(file));

    try {
      setQrDecoding(true);
      const result = await decodeQrCodeFromFile(file);
      setQrDecodeOutput(result.content);
      pushHistory({
        tool: "qrdecode",
        action: "二维码解析",
        input: file.name,
        output: result.content,
        fileName: file.name,
        size: file.size,
      });
      message.success(`解析完成：${result.width} x ${result.height}`);
    } catch (error) {
      setQrDecodeOutput("");
      setQrDecodeError(getErrorMessage(error, "二维码解析失败"));
    } finally {
      setQrDecoding(false);
    }
  };

  const handleJavaFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.endsWith(".class")) {
      setJavaDecompileError("请上传 .class 文件");
      return;
    }

    setJavaFileName(file.name);
    setJavaDecompileError(null);

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const result = String(loadEvent.target?.result ?? "");
      const base64Content = result.includes(",")
        ? result.split(",")[1]
        : result;
      setJavaClassContent(base64Content);
    };
    reader.readAsDataURL(file);
  };

  const handleJavaDecompile = async () => {
    setJavaDecompileCopied(false);
    setJavaDecompileError(null);

    if (!javaClassContent.trim()) {
      setJavaDecompileError("请上传 Class 文件或输入 Base64 字节码");
      return;
    }

    try {
      setJavaDecompiling(true);
      const result = await toolsApi.javaDecompile({
        fileName: javaFileName || "Uploaded.class",
        base64Content: javaClassContent.trim(),
      });

      setJavaFileName(result.fileName);
      setJavaDecompileOutput(result.output);
      pushHistory({
        tool: "javadecompile",
        action: "Java 反编译",
        input: javaClassContent.trim(),
        output: result.output,
        fileName: result.fileName,
      });
      message.success(`反编译完成，当前引擎：${result.engine}`);
    } catch (error) {
      setJavaDecompileOutput("");
      setJavaDecompileError(getErrorMessage(error, "反编译失败"));
    } finally {
      setJavaDecompiling(false);
    }
  };

  const renderToolContent = () => {
    if (activeTool === "json") {
      return (
        <JsonFormatToolPanel
          input={jsonTool.input}
          output={jsonTool.output}
          copied={jsonTool.copied}
          error={jsonTool.error}
          onInputChange={jsonTool.setInput}
          onFormat={jsonTool.format}
          onClear={jsonTool.clear}
          onCopy={() => void copyText(jsonTool.output, jsonTool.setCopied)}
        />
      );
    }

    if (activeTool === "jsontypes") {
      return (
        <JsonTypesToolPanel
          input={jsonTypesTool.input}
          rootName={jsonTypesTool.rootName}
          output={jsonTypesTool.output}
          copied={jsonTypesTool.copied}
          error={jsonTypesTool.error}
          onInputChange={jsonTypesTool.setInput}
          onRootNameChange={jsonTypesTool.setRootName}
          onGenerate={jsonTypesTool.generate}
          onClear={jsonTypesTool.clear}
          onCopy={() =>
            void copyText(jsonTypesTool.output, jsonTypesTool.setCopied)
          }
        />
      );
    }

    if (activeTool === "subconvert") {
      return (
        <SubConvertToolPanel
          {...subConvertTool}
          onCopy={() =>
            void copyText(subConvertTool.output, subConvertTool.setCopied)
          }
        />
      );
    }

    if (activeTool === "timestamp") {
      return (
        <TimestampToolPanel
          input={timestampTool.input}
          output={timestampTool.output}
          copied={timestampTool.copied}
          error={timestampTool.error}
          onInputChange={timestampTool.setInput}
          onConvert={timestampTool.convert}
          onClear={timestampTool.clear}
          onCopy={() =>
            void copyText(timestampTool.output, timestampTool.setCopied)
          }
        />
      );
    }

    if (activeTool === "base64") {
      return (
        <Base64ToolPanel
          input={base64Tool.input}
          mode={base64Tool.mode}
          output={base64Tool.output}
          copied={base64Tool.copied}
          error={base64Tool.error}
          onInputChange={base64Tool.setInput}
          onModeChange={base64Tool.setMode}
          onConvert={base64Tool.convert}
          onClear={base64Tool.clear}
          onCopy={() => void copyText(base64Tool.output, base64Tool.setCopied)}
        />
      );
    }

    if (activeTool === "url") {
      return (
        <UrlCodecToolPanel
          input={urlTool.input}
          mode={urlTool.mode}
          output={urlTool.output}
          copied={urlTool.copied}
          onInputChange={urlTool.setInput}
          onModeChange={urlTool.setMode}
          onConvert={urlTool.convert}
          onClear={urlTool.clear}
          onCopy={() => void copyText(urlTool.output, urlTool.setCopied)}
        />
      );
    }

    if (activeTool === "query") {
      return (
        <QueryParamsToolPanel
          input={queryTool.input}
          output={queryTool.output}
          copied={queryTool.copied}
          error={queryTool.error}
          onInputChange={queryTool.setInput}
          onParse={queryTool.parse}
          onClear={queryTool.clear}
          onCopy={() => void copyText(queryTool.output, queryTool.setCopied)}
        />
      );
    }

    if (activeTool === "curlcode") {
      return (
        <CurlCodeToolPanel
          input={curlCodeTool.input}
          mode={curlCodeTool.mode}
          output={curlCodeTool.output}
          copied={curlCodeTool.copied}
          error={curlCodeTool.error}
          onInputChange={curlCodeTool.setInput}
          onModeChange={curlCodeTool.setMode}
          onGenerate={curlCodeTool.generate}
          onClear={curlCodeTool.clear}
          onCopy={() =>
            void copyText(curlCodeTool.output, curlCodeTool.setCopied)
          }
        />
      );
    }

    if (activeTool === "regex") {
      return (
        <RegexToolPanel
          pattern={regexTool.pattern}
          flags={regexTool.flags}
          sample={regexTool.sample}
          output={regexTool.output}
          copied={regexTool.copied}
          error={regexTool.error}
          onPatternChange={regexTool.setPattern}
          onFlagsChange={regexTool.setFlags}
          onSampleChange={regexTool.setSample}
          onTest={regexTool.test}
          onClear={regexTool.clear}
          onCopy={() => void copyText(regexTool.output, regexTool.setCopied)}
        />
      );
    }

    if (activeTool === "diff") {
      return (
        <TextDiffToolPanel
          left={diffLeft}
          right={diffRight}
          output={diffOutput}
          copied={diffCopied}
          onLeftChange={setDiffLeft}
          onRightChange={setDiffRight}
          onDiff={handleTextDiff}
          onClear={() => {
            setDiffLeft("");
            setDiffRight("");
            setDiffOutput("");
            setDiffCopied(false);
          }}
          onCopy={() => void copyText(diffOutput, setDiffCopied)}
        />
      );
    }

    if (activeTool === "color") {
      return (
        <ColorToolPanel
          input={colorInput}
          swatch={colorSwatch}
          output={colorOutput}
          copied={colorCopied}
          error={colorError}
          onInputChange={setColorInput}
          onConvert={handleColorConvert}
          onClear={() => {
            setColorInput("");
            setColorOutput("");
            setColorSwatch("#2563EB");
            setColorError(null);
            setColorCopied(false);
          }}
          onCopy={() => void copyText(colorOutput, setColorCopied)}
        />
      );
    }

    if (activeTool === "password") {
      return (
        <PasswordToolPanel
          length={passwordLength}
          count={passwordCount}
          useUpper={passwordUseUpper}
          useLower={passwordUseLower}
          useNumbers={passwordUseNumbers}
          useSymbols={passwordUseSymbols}
          output={passwordOutput}
          copied={passwordCopied}
          error={passwordError}
          onLengthChange={setPasswordLength}
          onCountChange={setPasswordCount}
          onUseUpperChange={setPasswordUseUpper}
          onUseLowerChange={setPasswordUseLower}
          onUseNumbersChange={setPasswordUseNumbers}
          onUseSymbolsChange={setPasswordUseSymbols}
          onGenerate={handleGeneratePassword}
          onClear={() => {
            setPasswordOutput("");
            setPasswordError(null);
            setPasswordCopied(false);
          }}
          onCopy={() => void copyText(passwordOutput, setPasswordCopied)}
        />
      );
    }

    if (activeTool === "html") {
      return (
        <HtmlEntityToolPanel
          input={htmlInput}
          mode={htmlMode}
          output={htmlOutput}
          copied={htmlCopied}
          onInputChange={setHtmlInput}
          onModeChange={setHtmlMode}
          onConvert={handleHtmlConvert}
          onClear={() => {
            setHtmlInput("");
            setHtmlOutput("");
            setHtmlCopied(false);
          }}
          onCopy={() => void copyText(htmlOutput, setHtmlCopied)}
        />
      );
    }

    if (activeTool === "csv") {
      return (
        <CsvJsonToolPanel
          input={csvInput}
          delimiter={csvDelimiter}
          output={csvOutput}
          copied={csvCopied}
          error={csvError}
          onInputChange={setCsvInput}
          onDelimiterChange={setCsvDelimiter}
          onConvert={handleCsvConvert}
          onClear={() => {
            setCsvInput("");
            setCsvOutput("");
            setCsvError(null);
            setCsvCopied(false);
          }}
          onCopy={() => void copyText(csvOutput, setCsvCopied)}
        />
      );
    }

    if (activeTool === "text") {
      return (
        <TextTransformToolPanel
          input={textInput}
          mode={textMode}
          output={textOutput}
          copied={textCopied}
          onInputChange={setTextInput}
          onModeChange={setTextMode}
          onTransform={handleTextTransform}
          onClear={() => {
            setTextInput("");
            setTextOutput("");
            setTextCopied(false);
          }}
          onCopy={() => void copyText(textOutput, setTextCopied)}
        />
      );
    }

    if (activeTool === "diagnostics") {
      return (
        <DiagnosticsToolPanel
          count={diagnosticsCount}
          output={diagnosticsOutput}
          copied={diagnosticsCopied}
          error={diagnosticsError}
          running={diagnosticsRunning}
          onCountChange={setDiagnosticsCount}
          onRun={() => void handleRunDiagnostics()}
          onClear={() => {
            setDiagnosticsOutput("");
            setDiagnosticsError(null);
            setDiagnosticsCopied(false);
          }}
          onCopy={() => void copyText(diagnosticsOutput, setDiagnosticsCopied)}
        />
      );
    }

    if (activeTool === "jwt") {
      return (
        <JwtToolPanel
          input={jwtInput}
          output={jwtOutput}
          copied={jwtCopied}
          error={jwtError}
          onInputChange={setJwtInput}
          onParse={handleJwtParse}
          onClear={() => {
            setJwtInput("");
            setJwtOutput("");
            setJwtError(null);
            setJwtCopied(false);
          }}
          onCopy={() => void copyText(jwtOutput, setJwtCopied)}
        />
      );
    }

    if (activeTool === "uuid") {
      return (
        <UuidToolPanel
          count={uuidCount}
          output={uuidOutput}
          copied={uuidCopied}
          onCountChange={setUuidCount}
          onGenerate={handleGenerateUuid}
          onClear={() => {
            setUuidOutput("");
            setUuidCopied(false);
          }}
          onCopy={() => void copyText(uuidOutput, setUuidCopied)}
        />
      );
    }

    if (activeTool === "hash") {
      return (
        <HashToolPanel
          input={hashInput}
          algorithm={hashAlgorithm}
          output={hashOutput}
          copied={hashCopied}
          error={hashError}
          onInputChange={setHashInput}
          onAlgorithmChange={setHashAlgorithm}
          onRun={() => void handleHashText()}
          onClear={() => {
            setHashInput("");
            setHashOutput("");
            setHashError(null);
            setHashCopied(false);
          }}
          onCopy={() => void copyText(hashOutput, setHashCopied)}
        />
      );
    }

    if (activeTool === "cron") {
      return (
        <CronToolPanel
          mode={cronMode}
          intervalMinutes={cronIntervalMinutes}
          minute={cronMinute}
          hour={cronHour}
          weekday={cronWeekday}
          monthDay={cronMonthDay}
          output={cronOutput}
          description={cronDescription}
          copied={cronCopied}
          error={cronError}
          onModeChange={setCronMode}
          onIntervalMinutesChange={setCronIntervalMinutes}
          onMinuteChange={setCronMinute}
          onHourChange={setCronHour}
          onWeekdayChange={setCronWeekday}
          onMonthDayChange={setCronMonthDay}
          onGenerate={handleGenerateCron}
          onClear={() => {
            setCronOutput("");
            setCronDescription("");
            setCronError(null);
            setCronCopied(false);
          }}
          onCopy={() => void copyText(cronOutput, setCronCopied)}
        />
      );
    }

    if (activeTool === "qrcode") {
      return (
        <QrcodeToolPanel
          input={qrcodeInput}
          size={qrcodeSize}
          value={qrcodeValue}
          onInputChange={setQrcodeInput}
          onSizeChange={setQrcodeSize}
          onGenerate={handleGenerateQrCode}
          onClear={() => {
            setQrcodeInput("");
            setQrcodeValue("");
          }}
        />
      );
    }

    if (activeTool === "qrdecode") {
      return (
        <QrDecodeToolPanel
          fileName={qrDecodeFileName}
          previewUrl={qrDecodePreviewUrl}
          output={qrDecodeOutput}
          copied={qrDecodeCopied}
          error={qrDecodeError}
          decoding={qrDecoding}
          onFileDecode={(file) => void handleDecodeQrCode(file)}
          onClear={() => {
            setQrDecodeFileName("");
            setQrDecodePreviewUrl("");
            setQrDecodeOutput("");
            setQrDecodeCopied(false);
            setQrDecodeError(null);
          }}
          onCopy={() => void copyText(qrDecodeOutput, setQrDecodeCopied)}
        />
      );
    }

    return (
      <JavaDecompileToolPanel
        classContent={javaClassContent}
        output={javaDecompileOutput}
        copied={javaDecompileCopied}
        error={javaDecompileError}
        fileName={javaFileName}
        decompiling={javaDecompiling}
        onClassContentChange={setJavaClassContent}
        onFileUpload={handleJavaFileUpload}
        onRun={() => void handleJavaDecompile()}
        onClear={() => {
          setJavaClassContent("");
          setJavaDecompileOutput("");
          setJavaDecompileCopied(false);
          setJavaDecompileError(null);
          setJavaFileName("");
        }}
        onCopy={() =>
          void copyText(javaDecompileOutput, setJavaDecompileCopied)
        }
      />
    );
  };

  return (
    <MainLayout contentWidth="wide">
      <div className="py-8">
        <div className="space-y-6">
          <ToolsPageHeader
            activeTool={activeTool}
            historyCount={history.length}
            onSelectTool={setActiveTool}
          />

          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <ToolsSidebar
              activeTool={activeTool}
              history={history}
              historyItems={historyItems}
              historyScope={historyScope}
              onSelectTool={setActiveTool}
              onSetHistoryScope={setHistoryScope}
              onClearHistory={clearHistory}
              onRestoreHistoryItem={restoreHistoryItem}
              onRemoveHistoryItem={removeHistoryItem}
            />

            <Card className="order-1 border-0 shadow-sm xl:order-2">
              <CardContent className="space-y-6 p-6">
                <ToolPanelHeader activeTool={activeTool} />

                <Suspense fallback={<ToolPanelLoadingFallback />}>
                  {renderToolContent()}
                </Suspense>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

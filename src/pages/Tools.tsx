import React, { useMemo, useState, type ComponentType, type CSSProperties } from "react";
import { Alert, Button, Col, Empty, Input, Row, Slider, Tag, message } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileTextOutlined,
  HistoryOutlined,
  KeyOutlined,
  LinkOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  UploadOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import { Card, CardContent } from "../components/ui";
import MainLayout from "../layouts/MainLayout";
import { toolsApi } from "../services/api";

const { TextArea } = Input;

type ToolType = "json" | "timestamp" | "base64" | "url" | "qrcode" | "javadecompile";

type ToolHistoryItem = {
  id: string;
  tool: ToolType;
  action: string;
  input: string;
  output?: string;
  mode?: "encode" | "decode";
  size?: number;
  fileName?: string;
  createdAt: string;
};

const TOOL_HISTORY_STORAGE_KEY = "idncar.tools.history";
const TOOL_HISTORY_LIMIT = 18;
const TOOL_HISTORY_TEXT_LIMIT = 4000;

type ToolIconProps = {
  style?: CSSProperties;
  className?: string;
};

const toolConfig: Record<
  ToolType,
  { name: string; icon: ComponentType<ToolIconProps>; color: string; bgColor: string }
> = {
  json: { name: "JSON 格式化", icon: CodeOutlined, color: "#2563eb", bgColor: "bg-blue-100" },
  timestamp: { name: "时间戳转换", icon: ClockCircleOutlined, color: "#2f855a", bgColor: "bg-green-100" },
  base64: { name: "Base64 编解码", icon: KeyOutlined, color: "#c0841a", bgColor: "bg-amber-100" },
  url: { name: "URL 编解码", icon: LinkOutlined, color: "#dc2626", bgColor: "bg-rose-100" },
  qrcode: { name: "二维码生成", icon: QrcodeOutlined, color: "#7c3aed", bgColor: "bg-violet-100" },
  javadecompile: { name: "Java 反编译", icon: FileTextOutlined, color: "#ea580c", bgColor: "bg-orange-100" },
};

function encodeBase64(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

function decodeBase64(value: string) {
  return decodeURIComponent(escape(atob(value)));
}

function trimHistoryText(value: string, limit = TOOL_HISTORY_TEXT_LIMIT) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n...`;
}

function readToolHistory(): ToolHistoryItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(TOOL_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is ToolHistoryItem => Boolean(item?.id && item?.tool && item?.action && item?.createdAt));
  } catch {
    return [];
  }
}

function writeToolHistory(history: ToolHistoryItem[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(TOOL_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function formatHistoryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getHistoryPreview(value?: string) {
  if (!value) {
    return "暂无结果预览";
  }
  return value.replace(/\s+/g, " ").trim().slice(0, 72) || "暂无结果预览";
}

export default function Tools() {
  const [activeTool, setActiveTool] = useState<ToolType>("json");
  const [history, setHistory] = useState<ToolHistoryItem[]>(() => readToolHistory());

  const [inputJson, setInputJson] = useState("");
  const [outputJson, setOutputJson] = useState("");
  const [jsonCopied, setJsonCopied] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [timestampInput, setTimestampInput] = useState("");
  const [timestampOutput, setTimestampOutput] = useState("");
  const [timestampCopied, setTimestampCopied] = useState(false);
  const [timestampError, setTimestampError] = useState<string | null>(null);

  const [base64Input, setBase64Input] = useState("");
  const [base64Output, setBase64Output] = useState("");
  const [base64Copied, setBase64Copied] = useState(false);
  const [base64Error, setBase64Error] = useState<string | null>(null);
  const [base64Mode, setBase64Mode] = useState<"encode" | "decode">("encode");

  const [urlInput, setUrlInput] = useState("");
  const [urlOutput, setUrlOutput] = useState("");
  const [urlCopied, setUrlCopied] = useState(false);
  const [urlMode, setUrlMode] = useState<"encode" | "decode">("encode");

  const [qrcodeInput, setQrcodeInput] = useState("");
  const [qrcodeSize, setQrcodeSize] = useState(180);
  const [qrcodeUrl, setQrcodeUrl] = useState("");

  const [javaClassContent, setJavaClassContent] = useState("");
  const [javaDecompileOutput, setJavaDecompileOutput] = useState("");
  const [javaDecompileCopied, setJavaDecompileCopied] = useState(false);
  const [javaDecompileError, setJavaDecompileError] = useState<string | null>(null);
  const [javaFileName, setJavaFileName] = useState("");
  const [javaDecompiling, setJavaDecompiling] = useState(false);

  const currentTool = useMemo(() => toolConfig[activeTool], [activeTool]);
  const historyItems = useMemo(() => {
    const current = history.filter((item) => item.tool === activeTool);
    const others = history.filter((item) => item.tool !== activeTool);
    return [...current, ...others].slice(0, 8);
  }, [activeTool, history]);

  const pushHistory = (entry: Omit<ToolHistoryItem, "id" | "createdAt">) => {
    setHistory((current) => {
      const nextItem: ToolHistoryItem = {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        input: trimHistoryText(entry.input),
        output: entry.output ? trimHistoryText(entry.output) : undefined,
        createdAt: new Date().toISOString(),
      };

      const deduped = current.filter(
        (item) => !(item.tool === nextItem.tool && item.action === nextItem.action && item.input === nextItem.input),
      );
      const next = [nextItem, ...deduped].slice(0, TOOL_HISTORY_LIMIT);
      writeToolHistory(next);
      return next;
    });
  };

  const removeHistoryItem = (id: string) => {
    setHistory((current) => {
      const next = current.filter((item) => item.id !== id);
      writeToolHistory(next);
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TOOL_HISTORY_STORAGE_KEY);
    }
    message.success("已清空工具历史记录");
  };

  const copyText = async (value: string, setCopied: (value: boolean) => void) => {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      message.error("复制失败，请检查浏览器权限");
    }
  };

  const resetCopiedStates = () => {
    setJsonCopied(false);
    setTimestampCopied(false);
    setBase64Copied(false);
    setUrlCopied(false);
    setJavaDecompileCopied(false);
  };

  const restoreHistoryItem = (item: ToolHistoryItem) => {
    resetCopiedStates();
    setActiveTool(item.tool);

    if (item.tool === "json") {
      setInputJson(item.input);
      setOutputJson(item.output ?? "");
      setJsonError(null);
    }

    if (item.tool === "timestamp") {
      setTimestampInput(item.input);
      setTimestampOutput(item.output ?? "");
      setTimestampError(null);
    }

    if (item.tool === "base64") {
      setBase64Input(item.input);
      setBase64Output(item.output ?? "");
      setBase64Mode(item.mode ?? "encode");
      setBase64Error(null);
    }

    if (item.tool === "url") {
      setUrlInput(item.input);
      setUrlOutput(item.output ?? "");
      setUrlMode(item.mode ?? "encode");
    }

    if (item.tool === "qrcode") {
      setQrcodeInput(item.input);
      setQrcodeUrl(item.output ?? "");
      setQrcodeSize(item.size ?? 180);
    }

    if (item.tool === "javadecompile") {
      setJavaClassContent(item.input);
      setJavaDecompileOutput(item.output ?? "");
      setJavaFileName(item.fileName ?? "");
      setJavaDecompileError(null);
    }

    message.success("已恢复到当前工具");
  };

  const handleJsonFormat = () => {
    setJsonError(null);
    try {
      if (!inputJson.trim()) {
        throw new Error("请输入 JSON 内容");
      }

      const output = JSON.stringify(JSON.parse(inputJson), null, 2);
      setOutputJson(output);
      pushHistory({
        tool: "json",
        action: "JSON 格式化",
        input: inputJson.trim(),
        output,
      });
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "JSON 解析失败");
      setOutputJson("");
    }
  };

  const handleJsonMinify = () => {
    setJsonError(null);
    try {
      if (!inputJson.trim()) {
        throw new Error("请输入 JSON 内容");
      }

      const output = JSON.stringify(JSON.parse(inputJson));
      setOutputJson(output);
      pushHistory({
        tool: "json",
        action: "JSON 压缩",
        input: inputJson.trim(),
        output,
      });
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : "JSON 解析失败");
      setOutputJson("");
    }
  };

  const handleTimestampConvert = () => {
    setTimestampError(null);
    try {
      if (!timestampInput.trim()) {
        throw new Error("请输入时间戳或日期");
      }

      const input = timestampInput.trim();
      let output = "";

      if (/^\d{10,13}$/.test(input)) {
        const timestamp = Number(input.length === 10 ? `${input}000` : input);
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) {
          throw new Error("时间戳无效");
        }

        output = [`本地时间：${date.toLocaleString("zh-CN")}`, `ISO：${date.toISOString()}`, `毫秒：${timestamp}`].join("\n");
      } else {
        const date = new Date(input);
        if (Number.isNaN(date.getTime())) {
          throw new Error("日期格式无效");
        }

        output = [`毫秒：${date.getTime()}`, `秒：${Math.floor(date.getTime() / 1000)}`, `ISO：${date.toISOString()}`].join("\n");
      }

      setTimestampOutput(output);
      pushHistory({
        tool: "timestamp",
        action: "时间戳转换",
        input,
        output,
      });
    } catch (err) {
      setTimestampError(err instanceof Error ? err.message : "时间转换失败");
      setTimestampOutput("");
    }
  };

  const handleBase64Convert = () => {
    setBase64Error(null);
    try {
      if (!base64Input.trim()) {
        throw new Error("请输入待处理内容");
      }

      const output = base64Mode === "encode" ? encodeBase64(base64Input) : decodeBase64(base64Input);
      setBase64Output(output);
      pushHistory({
        tool: "base64",
        action: base64Mode === "encode" ? "Base64 编码" : "Base64 解码",
        input: base64Input,
        output,
        mode: base64Mode,
      });
    } catch (err) {
      setBase64Error(err instanceof Error ? err.message : "Base64 转换失败");
      setBase64Output("");
    }
  };

  const handleUrlConvert = () => {
    if (!urlInput.trim()) {
      setUrlOutput("");
      return;
    }

    try {
      const output = urlMode === "encode" ? encodeURIComponent(urlInput) : decodeURIComponent(urlInput);
      setUrlOutput(output);
      pushHistory({
        tool: "url",
        action: urlMode === "encode" ? "URL 编码" : "URL 解码",
        input: urlInput,
        output,
        mode: urlMode,
      });
    } catch {
      setUrlOutput("");
      message.error("URL 转换失败");
    }
  };

  const handleGenerateQrCode = () => {
    if (!qrcodeInput.trim()) {
      message.warning("请输入二维码内容");
      return;
    }

    const encoded = encodeURIComponent(qrcodeInput.trim());
    const output = `https://api.qrserver.com/v1/create-qr-code/?size=${qrcodeSize}x${qrcodeSize}&data=${encoded}`;
    setQrcodeUrl(output);
    pushHistory({
      tool: "qrcode",
      action: "二维码生成",
      input: qrcodeInput.trim(),
      output,
      size: qrcodeSize,
    });
  };

  const handleJavaFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      const base64Content = result.includes(",") ? result.split(",")[1] : result;
      setJavaClassContent(base64Content);
    };
    reader.readAsDataURL(file);
  };

  const handleJavaDecompile = async () => {
    setJavaDecompileError(null);
    setJavaDecompileCopied(false);

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
      message.success(`反编译完成，使用引擎：${result.engine}`);
    } catch (err) {
      setJavaDecompileOutput("");
      setJavaDecompileError(err instanceof Error ? err.message : "反编译失败");
    } finally {
      setJavaDecompiling(false);
    }
  };

  const renderCopyButton = (value: string, copied: boolean, setCopied: (value: boolean) => void) => (
    <Button
      type="text"
      disabled={!value}
      icon={copied ? <CheckCircleOutlined /> : <CopyOutlined />}
      onClick={() => {
        void copyText(value, setCopied);
      }}
      style={{ color: copied ? "#52c41a" : undefined }}
    >
      {copied ? "已复制" : "复制"}
    </Button>
  );

  const renderToolContent = () => {
    if (activeTool === "json") {
      return (
        <div className="space-y-6">
          {jsonError && <Alert type="error" showIcon icon={<WarningOutlined />} message="格式化失败" description={jsonError} />}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <label className="mb-2 block text-sm font-medium text-gray-700">输入</label>
              <TextArea rows={10} value={inputJson} onChange={(e) => setInputJson(e.target.value)} placeholder='{"name":"test"}' />
              <div className="mt-4 flex gap-2">
                <Button type="primary" onClick={handleJsonFormat} style={{ flex: 1 }}>
                  格式化
                </Button>
                <Button onClick={handleJsonMinify} style={{ flex: 1 }}>
                  压缩
                </Button>
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    setInputJson("");
                    setOutputJson("");
                    setJsonError(null);
                    setJsonCopied(false);
                  }}
                />
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">输出</label>
                {renderCopyButton(outputJson, jsonCopied, setJsonCopied)}
              </div>
              <TextArea rows={10} readOnly value={outputJson} placeholder="结果会显示在这里" className="bg-gray-50 font-mono" />
            </Col>
          </Row>
        </div>
      );
    }

    if (activeTool === "timestamp") {
      return (
        <div className="space-y-6">
          {timestampError && <Alert type="error" showIcon icon={<WarningOutlined />} message="转换失败" description={timestampError} />}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <label className="mb-2 block text-sm font-medium text-gray-700">输入时间戳或日期</label>
              <Input value={timestampInput} onChange={(e) => setTimestampInput(e.target.value)} placeholder="例如 1713268800000 或 2026-04-16 15:00:00" />
              <div className="mt-4 flex gap-2">
                <Button type="primary" onClick={handleTimestampConvert} style={{ flex: 1 }}>
                  转换
                </Button>
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    setTimestampInput("");
                    setTimestampOutput("");
                    setTimestampError(null);
                    setTimestampCopied(false);
                  }}
                />
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">输出</label>
                {renderCopyButton(timestampOutput, timestampCopied, setTimestampCopied)}
              </div>
              <TextArea rows={6} readOnly value={timestampOutput} placeholder="结果会显示在这里" className="bg-gray-50 font-mono" />
            </Col>
          </Row>
        </div>
      );
    }

    if (activeTool === "base64") {
      return (
        <div className="space-y-6">
          {base64Error && <Alert type="error" showIcon icon={<WarningOutlined />} message="转换失败" description={base64Error} />}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <div className="mb-3 flex gap-2">
                <Button type={base64Mode === "encode" ? "primary" : "default"} onClick={() => setBase64Mode("encode")}>
                  编码
                </Button>
                <Button type={base64Mode === "decode" ? "primary" : "default"} onClick={() => setBase64Mode("decode")}>
                  解码
                </Button>
              </div>
              <TextArea rows={8} value={base64Input} onChange={(e) => setBase64Input(e.target.value)} placeholder="输入原文或 Base64 内容" />
              <div className="mt-4 flex gap-2">
                <Button type="primary" onClick={handleBase64Convert} style={{ flex: 1 }}>
                  执行
                </Button>
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    setBase64Input("");
                    setBase64Output("");
                    setBase64Error(null);
                    setBase64Copied(false);
                  }}
                />
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">输出</label>
                {renderCopyButton(base64Output, base64Copied, setBase64Copied)}
              </div>
              <TextArea rows={8} readOnly value={base64Output} placeholder="结果会显示在这里" className="bg-gray-50 font-mono" />
            </Col>
          </Row>
        </div>
      );
    }

    if (activeTool === "url") {
      return (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <div className="mb-3 flex gap-2">
              <Button type={urlMode === "encode" ? "primary" : "default"} onClick={() => setUrlMode("encode")}>
                编码
              </Button>
              <Button type={urlMode === "decode" ? "primary" : "default"} onClick={() => setUrlMode("decode")}>
                解码
              </Button>
            </div>
            <TextArea rows={5} value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="输入 URL 或待编码内容" />
            <div className="mt-4 flex gap-2">
              <Button type="primary" onClick={handleUrlConvert} style={{ flex: 1 }}>
                执行
              </Button>
              <Button
                icon={<DeleteOutlined />}
                onClick={() => {
                  setUrlInput("");
                  setUrlOutput("");
                  setUrlCopied(false);
                }}
              />
            </div>
          </Col>
          <Col xs={24} lg={12}>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">输出</label>
              {renderCopyButton(urlOutput, urlCopied, setUrlCopied)}
            </div>
            <TextArea rows={5} readOnly value={urlOutput} placeholder="结果会显示在这里" className="bg-gray-50 font-mono" />
          </Col>
        </Row>
      );
    }

    if (activeTool === "qrcode") {
      return (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={9}>
            <label className="mb-2 block text-sm font-medium text-gray-700">二维码内容</label>
            <TextArea rows={6} value={qrcodeInput} onChange={(e) => setQrcodeInput(e.target.value)} placeholder="输入链接、文本或任意内容" />
            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">尺寸：{qrcodeSize}px</label>
              <Slider min={100} max={320} value={qrcodeSize} onChange={(value) => setQrcodeSize(Number(value))} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button type="primary" onClick={handleGenerateQrCode} style={{ flex: 1 }}>
                生成二维码
              </Button>
              <Button
                icon={<DeleteOutlined />}
                onClick={() => {
                  setQrcodeInput("");
                  setQrcodeUrl("");
                }}
              />
            </div>
          </Col>
          <Col xs={24} lg={15}>
            <label className="mb-2 block text-sm font-medium text-gray-700">预览</label>
            <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-gray-100 bg-gray-50">
              {qrcodeUrl ? (
                <div className="text-center">
                  <img src={qrcodeUrl} alt="二维码预览" className="mx-auto rounded-lg border border-gray-200" />
                  <a href={qrcodeUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-blue-500">
                    打开或下载二维码
                  </a>
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <QrcodeOutlined style={{ fontSize: 56 }} />
                  <p className="mt-3">二维码预览区域</p>
                </div>
              )}
            </div>
          </Col>
        </Row>
      );
    }

    return (
      <div className="space-y-6">
        {javaDecompileError && (
          <Alert type="error" showIcon icon={<WarningOutlined />} message="反编译失败" description={javaDecompileError} />
        )}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={10}>
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">上传 Class 文件</label>
                <div
                  className="cursor-pointer rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center transition-colors hover:border-blue-400"
                  onClick={() => document.getElementById("class-file-input")?.click()}
                >
                  <UploadOutlined style={{ fontSize: 42, color: "#9CA3AF", marginBottom: 12 }} />
                  <div className="font-medium text-gray-700">点击上传 .class 文件</div>
                  <div className="mt-1 text-sm text-gray-400">文件会发送到 Java 后端进行处理</div>
                  {javaFileName ? <div className="mt-3 text-sm text-green-600">已选择：{javaFileName}</div> : null}
                  <input id="class-file-input" type="file" accept=".class" onChange={handleJavaFileUpload} className="hidden" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">或输入 Base64 字节码</label>
                <TextArea
                  rows={8}
                  value={javaClassContent}
                  onChange={(e) => setJavaClassContent(e.target.value)}
                  placeholder="粘贴 .class 文件对应的 Base64 内容"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  loading={javaDecompiling}
                  onClick={() => void handleJavaDecompile()}
                  style={{ flex: 1 }}
                >
                  开始反编译
                </Button>
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    setJavaClassContent("");
                    setJavaDecompileOutput("");
                    setJavaDecompileCopied(false);
                    setJavaDecompileError(null);
                    setJavaFileName("");
                  }}
                />
              </div>
            </div>
          </Col>

          <Col xs={24} lg={14}>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">反编译结果</label>
              {renderCopyButton(javaDecompileOutput, javaDecompileCopied, setJavaDecompileCopied)}
            </div>
            <div className="min-h-[420px] overflow-auto rounded-xl bg-gray-900 p-4">
              {javaDecompiling ? (
                <div className="flex h-full min-h-[388px] items-center justify-center text-gray-400">
                  <div className="text-center">
                    <FileTextOutlined style={{ fontSize: 52 }} />
                    <p className="mt-4">正在调用后端反编译...</p>
                    <p className="mt-2 text-xs">当前使用 JDK 自带 javap 输出结果</p>
                  </div>
                </div>
              ) : javaDecompileOutput ? (
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300">{javaDecompileOutput}</pre>
              ) : (
                <div className="flex h-full min-h-[388px] items-center justify-center text-gray-500">
                  <div className="text-center">
                    <FileTextOutlined style={{ fontSize: 52 }} />
                    <p className="mt-4">反编译结果预览区域</p>
                    <p className="mt-2 text-xs">上传 .class 文件后会在这里展示后端输出</p>
                  </div>
                </div>
              )}
            </div>
          </Col>
        </Row>
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <h1 className="mb-3 text-3xl font-bold text-gray-800">实用工具箱</h1>
            <p className="text-gray-500">把常用开发工具收在一个页面里，直接在线处理</p>
          </div>

          <div className="mb-8 flex flex-wrap justify-center gap-3">
            {(Object.keys(toolConfig) as ToolType[]).map((tool) => {
              const config = toolConfig[tool];
              const Icon = config.icon;
              const active = activeTool === tool;

              return (
                <Button key={tool} type={active ? "primary" : "default"} onClick={() => setActiveTool(tool)} className={active ? "shadow-md" : ""}>
                  <Icon style={{ marginRight: 8 }} />
                  {config.name}
                </Button>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="border-0 shadow-sm xl:sticky xl:top-24">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-base font-semibold text-gray-800">
                      <HistoryOutlined />
                      最近使用
                    </div>
                    <p className="mt-1 text-sm leading-6 text-gray-500">保留最近工具操作，点一下就能恢复输入和结果。</p>
                  </div>
                  <Button type="text" danger disabled={history.length === 0} onClick={clearHistory}>
                    清空
                  </Button>
                </div>

                <div className="mt-4">
                  {historyItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10">
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="你最近还没有工具使用记录" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historyItems.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Tag color={item.tool === activeTool ? "processing" : "default"}>{toolConfig[item.tool].name}</Tag>
                                <span className="text-sm font-medium text-slate-800">{item.action}</span>
                              </div>
                              <div className="mt-2 text-xs text-slate-400">{formatHistoryTime(item.createdAt)}</div>
                            </div>
                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeHistoryItem(item.id)} />
                          </div>

                          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-600">
                            {getHistoryPreview(item.output || item.input)}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-400">{item.fileName ? `文件：${item.fileName}` : "可直接恢复到工具区"}</div>
                            <Button size="small" icon={<ReloadOutlined />} onClick={() => restoreHistoryItem(item)}>
                              恢复
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm" style={{ minHeight: 520 }}>
              <CardContent className="p-6">
                <div className="mb-6 flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${currentTool.bgColor}`}>
                    <currentTool.icon style={{ fontSize: 24, color: currentTool.color }} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">{currentTool.name}</h2>
                    <p className="mt-1 text-sm text-gray-500">当前工具的最近记录会自动排在左侧最前面。</p>
                  </div>
                </div>

                {renderToolContent()}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

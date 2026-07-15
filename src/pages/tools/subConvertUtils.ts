import type { SubscriptionTarget } from "./types";

export type SubscriptionSourceKind = "subscription" | "node" | "unknown";

export type SubscriptionSourceStat = {
  total: number;
  unique: number;
  subscriptions: number;
  nodes: number;
  unknown: number;
  duplicates: number;
};

export type SubConvertOptions = {
  input: string;
  target: SubscriptionTarget;
  backendUrl: string;
  outputName: string;
  configUrl: string;
  includeFilter: string;
  excludeFilter: string;
  shortLinkTemplate: string;
  emoji: boolean;
  udp: boolean;
  tfo: boolean;
  skipCertVerify: boolean;
  appendType: boolean;
  sort: boolean;
};

export type ClientImportLink = {
  label: string;
  value: string;
};

export type SubConvertResult = {
  sourceUrls: string[];
  convertedUrl: string;
  shortLinkUrl: string;
  clientLinks: ClientImportLink[];
  stats: SubscriptionSourceStat;
  output: string;
};

export const defaultSubConvertBackend = "http://127.0.0.1:25500/sub";
export const defaultShortLinkTemplate = "";

export const subscriptionTargetOptions: { label: string; value: SubscriptionTarget }[] = [
  { label: "Clash", value: "clash" },
  { label: "ClashR", value: "clashr" },
  { label: "Sing-Box", value: "singbox" },
  { label: "Surge", value: "surge" },
  { label: "Quantumult X", value: "quanx" },
  { label: "Quantumult", value: "quan" },
  { label: "Loon", value: "loon" },
  { label: "Shadowrocket", value: "shadowrocket" },
  { label: "V2Ray", value: "v2ray" },
  { label: "Mixed", value: "mixed" },
  { label: "Shadowsocks", value: "ss" },
  { label: "SSR", value: "ssr" },
  { label: "Trojan", value: "trojan" },
];

export const subConvertBackendPresets = [
  { label: "本机 127.0.0.1", value: defaultSubConvertBackend },
  { label: "本机 localhost", value: "http://localhost:25500/sub" },
];

export const subConvertConfigPresets = [
  { label: "不使用远程配置", value: "" },
  {
    label: "ACL4SSR 在线默认",
    value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini",
  },
  {
    label: "ACL4SSR 精简分组",
    value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini.ini",
  },
];

const nodeSchemePattern = /^(ss|ssr|vmess|vless|trojan|hysteria|hysteria2|hy2|tuic|juicity|socks|http|https):\/\//i;
const subscriptionUrlPattern = /^https?:\/\//i;

export function getSubscriptionTargetLabel(target: SubscriptionTarget) {
  return subscriptionTargetOptions.find((item) => item.value === target)?.label ?? target;
}

function normalizeSourceLine(value: string) {
  return value.trim().replace(/\s+$/, "");
}

export function splitSubscriptionSources(input: string) {
  const seen = new Set<string>();
  const sources: { value: string; kind: SubscriptionSourceKind; duplicate: boolean }[] = [];

  input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(normalizeSourceLine)
    .filter(Boolean)
    .forEach((value) => {
      const duplicate = seen.has(value);
      const kind = classifySubscriptionSource(value);
      sources.push({ value, kind, duplicate });
      seen.add(value);
    });

  return sources;
}

export function classifySubscriptionSource(value: string): SubscriptionSourceKind {
  if (subscriptionUrlPattern.test(value)) {
    return "subscription";
  }
  if (nodeSchemePattern.test(value)) {
    return "node";
  }
  return "unknown";
}

export function buildSubscriptionSourceStat(input: string): SubscriptionSourceStat {
  const sources = splitSubscriptionSources(input);
  const uniqueValues = new Set(sources.map((item) => item.value));
  const uniqueSources = sources.filter((item) => !item.duplicate);

  return {
    total: sources.length,
    unique: uniqueValues.size,
    subscriptions: uniqueSources.filter((item) => item.kind === "subscription").length,
    nodes: uniqueSources.filter((item) => item.kind === "node").length,
    unknown: uniqueSources.filter((item) => item.kind === "unknown").length,
    duplicates: sources.filter((item) => item.duplicate).length,
  };
}

function normalizeHttpUrl(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`请填写${label}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label}不是有效 URL`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${label}仅支持 HTTP 或 HTTPS`);
  }

  return parsed;
}

function appendOptionalParam(params: URLSearchParams, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) {
    params.set(key, trimmed);
  }
}

export function buildSubConvertUrl(options: SubConvertOptions, sourceUrls: string[]) {
  const endpoint = normalizeHttpUrl(options.backendUrl, "转换后端地址");
  const params = endpoint.searchParams;

  params.set("target", options.target);
  params.set("url", sourceUrls.join("|"));
  params.set("emoji", String(options.emoji));
  params.set("udp", String(options.udp));
  params.set("tfo", String(options.tfo));
  params.set("scv", String(options.skipCertVerify));
  params.set("append_type", String(options.appendType));
  params.set("sort", String(options.sort));
  appendOptionalParam(params, "config", options.configUrl);
  appendOptionalParam(params, "include", options.includeFilter);
  appendOptionalParam(params, "exclude", options.excludeFilter);
  appendOptionalParam(params, "filename", options.outputName);

  return endpoint.toString();
}

export function buildShortLinkUrl(convertedUrl: string, template: string) {
  const trimmed = template.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("{url}")) {
    return trimmed.replaceAll("{url}", encodeURIComponent(convertedUrl));
  }

  const endpoint = normalizeHttpUrl(trimmed, "短链接口模板");
  endpoint.searchParams.set("url", convertedUrl);
  return endpoint.toString();
}

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function buildClientImportLinks(convertedUrl: string, outputName: string): ClientImportLink[] {
  const encodedUrl = encodeURIComponent(convertedUrl);
  const encodedName = encodeURIComponent(outputName.trim() || "Subscription");

  return [
    { label: "Clash", value: `clash://install-config?url=${encodedUrl}&name=${encodedName}` },
    { label: "Surge", value: `surge:///install-config?url=${encodedUrl}` },
    { label: "Loon", value: `loon://import?sub=${encodedUrl}` },
    { label: "Quantumult X", value: `quantumult-x:///add-resource?remote-resource=${encodedUrl}` },
    { label: "Shadowrocket", value: `shadowrocket://add/sub://${toBase64Url(convertedUrl)}?remark=${encodedName}` },
    { label: "Sing-Box", value: `sing-box://import-remote-profile?url=${encodedUrl}` },
  ];
}

export function buildSubConvertOutput(result: Omit<SubConvertResult, "output">, target: SubscriptionTarget) {
  const lines = [
    `目标客户端：${getSubscriptionTargetLabel(target)}`,
    `源链接：${result.stats.unique} 个去重后链接（订阅 ${result.stats.subscriptions} / 节点 ${result.stats.nodes} / 未识别 ${result.stats.unknown}）`,
    result.stats.duplicates > 0 ? `重复链接：${result.stats.duplicates} 个已参与去重` : "",
    "",
    "转换链接",
    result.convertedUrl,
    "",
    result.shortLinkUrl ? "短链请求" : "",
    result.shortLinkUrl,
    "",
    "客户端导入链接",
    ...result.clientLinks.map((item) => `${item.label}: ${item.value}`),
  ];

  return lines.filter((line, index, values) => line !== "" || values[index - 1] !== "").join("\n").trim();
}

export function buildSubConvertResult(options: SubConvertOptions): SubConvertResult {
  const sources = splitSubscriptionSources(options.input);
  const sourceUrls = Array.from(new Set(sources.map((item) => item.value)));

  if (sourceUrls.length === 0) {
    throw new Error("请至少输入一个订阅地址或节点链接");
  }

  const convertedUrl = buildSubConvertUrl(options, sourceUrls);
  const shortLinkUrl = buildShortLinkUrl(convertedUrl, options.shortLinkTemplate);
  const clientLinks = buildClientImportLinks(convertedUrl, options.outputName);
  const stats = buildSubscriptionSourceStat(options.input);
  const partial = { sourceUrls, convertedUrl, shortLinkUrl, clientLinks, stats };
  const output = buildSubConvertOutput(partial, options.target);

  return {
    ...partial,
    output,
  };
}

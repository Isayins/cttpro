import type { ComponentType, CSSProperties } from "react";

export type ToolType =
  | "json"
  | "jsontypes"
  | "subconvert"
  | "timestamp"
  | "base64"
  | "url"
  | "query"
  | "curlcode"
  | "regex"
  | "diff"
  | "color"
  | "password"
  | "html"
  | "csv"
  | "text"
  | "diagnostics"
  | "jwt"
  | "uuid"
  | "hash"
  | "cron"
  | "qrcode"
  | "qrdecode"
  | "javadecompile";

export type CodecMode = "encode" | "decode";
export type CurlCodeMode = "fetch" | "axios" | "python";
export type CronMode = "minutes" | "hourly" | "daily" | "weekly" | "monthly";
export type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
export type HistoryScope = "current" | "all";
export type CsvDelimiter = "comma" | "tab" | "semicolon";
export type TextTransformMode = "trim" | "dedupe" | "sort" | "lower" | "upper" | "lineNumbers";
export type SubscriptionTarget =
  | "clash"
  | "clashr"
  | "singbox"
  | "surge"
  | "quanx"
  | "quan"
  | "loon"
  | "shadowrocket"
  | "v2ray"
  | "mixed"
  | "ss"
  | "ssr"
  | "trojan";
export type RgbColor = { r: number; g: number; b: number };
export type ToolCategory = "data" | "codec" | "text" | "security" | "debug" | "network";

export type ToolHistoryItem = {
  id: string;
  historyKey?: string;
  restorable?: boolean;
  tool: ToolType;
  action: string;
  input: string;
  secondaryInput?: string;
  output?: string;
  mode?: CodecMode;
  codeMode?: CurlCodeMode;
  algorithm?: HashAlgorithm;
  delimiter?: CsvDelimiter;
  textMode?: TextTransformMode;
  subscriptionTarget?: SubscriptionTarget;
  backendUrl?: string;
  shortLinkTemplate?: string;
  configUrl?: string;
  includeFilter?: string;
  excludeFilter?: string;
  outputName?: string;
  convertedUrl?: string;
  shortLinkUrl?: string;
  flags?: string;
  size?: number;
  count?: number;
  fileName?: string;
  cronMode?: CronMode;
  cronIntervalMinutes?: number;
  cronMinute?: number;
  cronHour?: number;
  cronWeekday?: number;
  cronMonthDay?: number;
  createdAt: string;
};

export type ToolIconProps = {
  style?: CSSProperties;
  className?: string;
};

export type ToolConfigItem = {
  name: string;
  description: string;
  category: ToolCategory;
  icon: ComponentType<ToolIconProps>;
  color: string;
  bgColor: string;
};

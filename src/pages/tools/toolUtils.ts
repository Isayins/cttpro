import { toolTypes } from "./types";
import type { CurlCodeMode, CsvDelimiter, HashAlgorithm, RgbColor, TextTransformMode, TimestampUnit, ToolHistoryItem, ToolType } from "./types";

export const TOOL_HISTORY_STORAGE_KEY = "idncar.tools.history";
export const TOOL_HISTORY_LIMIT = 36;
export const TOOL_HISTORY_TEXT_LIMIT = 4000;
const PERSISTED_HISTORY_TOOLS = new Set<ToolType>(["color", "cron", "uuid"]);
const TOOL_TYPES = new Set<string>(toolTypes);

export const weekOptions = [
  { label: "周日", value: 0 },
  { label: "周一", value: 1 },
  { label: "周二", value: 2 },
  { label: "周三", value: 3 },
  { label: "周四", value: 4 },
  { label: "周五", value: 5 },
  { label: "周六", value: 6 },
] as const;

export const cronModeOptions = [
  { label: "每隔 N 分钟", value: "minutes" },
  { label: "每小时", value: "hourly" },
  { label: "每天", value: "daily" },
  { label: "每周", value: "weekly" },
  { label: "每月", value: "monthly" },
] as const;

export const hashAlgorithmOptions: { label: HashAlgorithm; value: HashAlgorithm }[] = [
  { label: "SHA-256", value: "SHA-256" },
  { label: "SHA-1", value: "SHA-1" },
  { label: "SHA-384", value: "SHA-384" },
  { label: "SHA-512", value: "SHA-512" },
];

export const csvDelimiterOptions: { label: string; value: CsvDelimiter }[] = [
  { label: "逗号 CSV", value: "comma" },
  { label: "制表符 TSV", value: "tab" },
  { label: "分号", value: "semicolon" },
];

export const textTransformOptions: { label: string; value: TextTransformMode }[] = [
  { label: "清理首尾空白", value: "trim" },
  { label: "按行去重", value: "dedupe" },
  { label: "按行排序", value: "sort" },
  { label: "转小写", value: "lower" },
  { label: "转大写", value: "upper" },
  { label: "添加行号", value: "lineNumbers" },
];

export const timestampUnitOptions: { label: string; value: TimestampUnit }[] = [
  { label: "自动识别", value: "auto" },
  { label: "秒", value: "seconds" },
  { label: "毫秒", value: "milliseconds" },
];

export function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return decodeBase64(padded);
}

export function formatJsonBlock(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function toPascalCase(value: string) {
  const normalized = value
    .trim()
    .replace(/^[^a-zA-Z_$]+/, "")
    .replace(/[^a-zA-Z0-9_$]+(.)/g, (_, char: string) => char.toUpperCase());
  const candidate = normalized ? `${normalized[0].toUpperCase()}${normalized.slice(1)}` : "Root";
  return /^[A-Z_$][a-zA-Z0-9_$]*$/.test(candidate) ? candidate : "Root";
}

function formatTypePropertyName(value: string) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value) ? value : JSON.stringify(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueTypeValues(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function unionTypes(values: string[]) {
  const uniqueValues = uniqueTypeValues(values);
  return uniqueValues.length === 1 ? uniqueValues[0] : uniqueValues.join(" | ");
}

export function buildTypeScriptTypesFromJson(jsonText: string, rootName = "Root") {
  const parsed: unknown = JSON.parse(jsonText);
  const declarations: string[] = [];
  const usedNames = new Set<string>();

  const reserveName = (rawName: string) => {
    const baseName = toPascalCase(rawName);
    let name = baseName;
    let index = 2;
    while (usedNames.has(name)) {
      name = `${baseName}${index}`;
      index += 1;
    }
    usedNames.add(name);
    return name;
  };

  const inferType = (value: unknown, suggestedName: string): string => {
    if (value === null) {
      return "null";
    }
    if (Array.isArray(value)) {
      return inferArrayType(value, suggestedName);
    }
    if (isPlainRecord(value)) {
      return createInterface([value], suggestedName);
    }

    const valueType = typeof value;
    if (valueType === "string" || valueType === "number" || valueType === "boolean") {
      return valueType;
    }
    return "unknown";
  };

  const inferArrayType = (values: unknown[], suggestedName: string) => {
    if (values.length === 0) {
      return "unknown[]";
    }

    if (values.every(isPlainRecord)) {
      return `${createInterface(values, `${suggestedName}Item`)}[]`;
    }

    const itemType = unionTypes(values.map((item, index) => inferType(item, `${suggestedName}Item${index + 1}`)));
    return itemType.includes(" | ") ? `Array<${itemType}>` : `${itemType}[]`;
  };

  const createInterface = (records: Record<string, unknown>[], suggestedName: string) => {
    const name = reserveName(suggestedName);
    const keys = Array.from(new Set(records.flatMap((record) => Object.keys(record)))).sort((left, right) => left.localeCompare(right));
    const lines = keys.map((key) => {
      const values = records.filter((record) => Object.prototype.hasOwnProperty.call(record, key)).map((record) => record[key]);
      const optional = values.length < records.length;
      const recordValues = values.filter(isPlainRecord);
      const nonRecordValues = values.filter((value) => !isPlainRecord(value));
      const type =
        recordValues.length > 0
          ? unionTypes([createInterface(recordValues, key), ...nonRecordValues.map((value) => inferType(value, key))])
          : unionTypes(values.map((value) => inferType(value, key)));
      return `  ${formatTypePropertyName(key)}${optional ? "?" : ""}: ${type};`;
    });

    declarations.push(`export interface ${name} {\n${lines.join("\n")}\n}`);
    return name;
  };

  const rootType = Array.isArray(parsed) ? inferArrayType(parsed, rootName) : isPlainRecord(parsed) ? createInterface([parsed], rootName) : inferType(parsed, rootName);
  if (!rootType.endsWith("[]") && !rootType.startsWith("Array<") && declarations.some((item) => item.startsWith(`export interface ${rootType}`))) {
    return declarations.reverse().join("\n\n");
  }

  return [`export type ${toPascalCase(rootName)} = ${rootType};`, ...declarations.reverse()].join("\n\n");
}

export function formatJwtUnixClaim(label: string, value: unknown) {
  const seconds = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
  if (seconds === null || !Number.isFinite(seconds)) {
    return null;
  }

  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return `${label}: ${date.toLocaleString("zh-CN")} / ${date.toISOString()}`;
}

export function parseUnixTimestamp(value: string, requestedUnit: TimestampUnit) {
  const trimmed = value.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) {
    throw new Error("时间戳必须是整数");
  }

  const numericValue = Number(trimmed);
  if (!Number.isSafeInteger(numericValue)) {
    throw new Error("时间戳超出安全整数范围");
  }

  let unit = requestedUnit;
  if (unit === "auto") {
    const digitCount = trimmed.replace(/^[+-]/, "").length;
    if (digitCount <= 10) {
      unit = "seconds";
    } else if (digitCount >= 13) {
      unit = "milliseconds";
    } else {
      throw new Error("11 或 12 位时间戳单位不明确，请选择秒或毫秒");
    }
  }

  const milliseconds = unit === "seconds" ? numericValue * 1000 : numericValue;
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) {
    throw new Error("时间戳无效");
  }

  return { date, milliseconds, unit };
}

export function createUuidV4() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("当前浏览器不支持安全随机数生成");
  }
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex
    .slice(10, 16)
    .join("")}`;
}

export async function digestText(value: string, algorithm: HashAlgorithm) {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("当前浏览器不支持 Web Crypto 哈希计算");
  }

  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest(algorithm, bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function normalizeRegexFlags(value: string) {
  const allowed = "gimsuy";
  const seen = new Set<string>();
  value
    .toLowerCase()
    .split("")
    .forEach((flag) => {
      if (allowed.includes(flag)) {
        seen.add(flag);
      }
    });
  return allowed
    .split("")
    .filter((flag) => seen.has(flag))
    .join("");
}

export function buildRegexOutput(pattern: string, rawFlags: string, sample: string) {
  const flags = normalizeRegexFlags(rawFlags);
  const matchingFlags = flags.includes("g") ? flags : `${flags}g`;
  const regex = new RegExp(pattern, matchingFlags);
  const matches: string[] = [];
  let match = regex.exec(sample);

  while (match && matches.length < 80) {
    const groups = match.slice(1).map((group, index) => `  group ${index + 1}: ${group ?? ""}`);
    matches.push([`#${matches.length + 1} index ${match.index}`, `  match: ${match[0]}`, ...groups].join("\n"));
    if (match[0] === "") {
      regex.lastIndex += 1;
    }
    match = regex.exec(sample);
  }

  return [
    `正则：/${pattern}/${flags}`,
    `命中：${matches.length}${matches.length >= 80 ? "（仅显示前 80 条）" : ""}`,
    "",
    matches.length > 0 ? matches.join("\n\n") : "没有匹配到内容",
  ].join("\n");
}

function splitDiffLines(value: string) {
  return value ? value.replace(/\r\n/g, "\n").split("\n") : [];
}

function buildSimpleDiff(leftLines: string[], rightLines: string[]) {
  const maxLength = Math.max(leftLines.length, rightLines.length);
  const lines: string[] = [];
  let same = 0;
  let removed = 0;
  let added = 0;

  for (let index = 0; index < maxLength; index += 1) {
    const left = leftLines[index];
    const right = rightLines[index];
    if (left !== undefined && right !== undefined && left === right) {
      same += 1;
      lines.push(`  ${left}`);
    } else {
      if (left !== undefined) {
        removed += 1;
        lines.push(`- ${left}`);
      }
      if (right !== undefined) {
        added += 1;
        lines.push(`+ ${right}`);
      }
    }
  }

  return { lines, same, removed, added };
}

export function buildLineDiff(left: string, right: string) {
  const leftLines = splitDiffLines(left);
  const rightLines = splitDiffLines(right);
  const tooLargeForLcs = leftLines.length * rightLines.length > 240_000;
  const result = tooLargeForLcs ? buildSimpleDiff(leftLines, rightLines) : buildLcsDiff(leftLines, rightLines);
  return [
    `统计：相同 ${result.same} 行 / 删除 ${result.removed} 行 / 新增 ${result.added} 行`,
    tooLargeForLcs ? "提示：文本较长，已使用快速逐行比较。" : "",
    "",
    result.lines.join("\n") || "两侧文本都为空",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function buildLcsDiff(leftLines: string[], rightLines: string[]) {
  const dp = Array.from({ length: leftLines.length + 1 }, () => new Uint16Array(rightLines.length + 1));

  for (let leftIndex = leftLines.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = rightLines.length - 1; rightIndex >= 0; rightIndex -= 1) {
      dp[leftIndex][rightIndex] =
        leftLines[leftIndex] === rightLines[rightIndex]
          ? dp[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(dp[leftIndex + 1][rightIndex], dp[leftIndex][rightIndex + 1]);
    }
  }

  const lines: string[] = [];
  let same = 0;
  let removed = 0;
  let added = 0;
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < leftLines.length && rightIndex < rightLines.length) {
    if (leftLines[leftIndex] === rightLines[rightIndex]) {
      same += 1;
      lines.push(`  ${leftLines[leftIndex]}`);
      leftIndex += 1;
      rightIndex += 1;
    } else if (dp[leftIndex + 1][rightIndex] >= dp[leftIndex][rightIndex + 1]) {
      removed += 1;
      lines.push(`- ${leftLines[leftIndex]}`);
      leftIndex += 1;
    } else {
      added += 1;
      lines.push(`+ ${rightLines[rightIndex]}`);
      rightIndex += 1;
    }
  }

  while (leftIndex < leftLines.length) {
    removed += 1;
    lines.push(`- ${leftLines[leftIndex]}`);
    leftIndex += 1;
  }

  while (rightIndex < rightLines.length) {
    added += 1;
    lines.push(`+ ${rightLines[rightIndex]}`);
    rightIndex += 1;
  }

  return { lines, same, removed, added };
}

export function rgbToHex({ r, g, b }: RgbColor) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function rgbToHsl({ r, g, b }: RgbColor) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(lightness * 100) };
  }

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return { h: Math.round(hue * 60), s: Math.round(saturation * 100), l: Math.round(lightness * 100) };
}

function hslToRgb(hue: number, saturation: number, lightness: number): RgbColor {
  const normalizedHue = (((hue % 360) + 360) % 360) / 360;
  const normalizedSaturation = clampNumber(saturation, 0, 100) / 100;
  const normalizedLightness = clampNumber(lightness, 0, 100) / 100;

  if (normalizedSaturation === 0) {
    const value = Math.round(normalizedLightness * 255);
    return { r: value, g: value, b: value };
  }

  const hueToRgb = (p: number, q: number, t: number) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };

  const q =
    normalizedLightness < 0.5
      ? normalizedLightness * (1 + normalizedSaturation)
      : normalizedLightness + normalizedSaturation - normalizedLightness * normalizedSaturation;
  const p = 2 * normalizedLightness - q;

  return {
    r: Math.round(hueToRgb(p, q, normalizedHue + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, normalizedHue) * 255),
    b: Math.round(hueToRgb(p, q, normalizedHue - 1 / 3) * 255),
  };
}

function parseRgbPart(value: string) {
  const trimmed = value.trim();
  const numericValue = Number(trimmed.endsWith("%") ? trimmed.slice(0, -1) : trimmed);
  if (!Number.isFinite(numericValue)) {
    throw new Error("RGB 颜色通道必须是数字");
  }
  if (trimmed.endsWith("%")) {
    if (numericValue < 0 || numericValue > 100) {
      throw new Error("RGB 百分比必须在 0% 到 100% 之间");
    }
    return Math.round((numericValue / 100) * 255);
  }
  if (numericValue < 0 || numericValue > 255) {
    throw new Error("RGB 颜色通道必须在 0 到 255 之间");
  }
  return Math.round(numericValue);
}

export function parseColor(value: string): RgbColor {
  const input = value.trim();
  const hex = input.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split("").map((char) => `${char}${char}`).join("") : hex[1];
    return {
      r: Number.parseInt(raw.slice(0, 2), 16),
      g: Number.parseInt(raw.slice(2, 4), 16),
      b: Number.parseInt(raw.slice(4, 6), 16),
    };
  }

  const rgb = input.match(/^rgb\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(",");
    if (parts.length !== 3) {
      throw new Error("RGB 需要 3 个颜色通道");
    }
    return { r: parseRgbPart(parts[0]), g: parseRgbPart(parts[1]), b: parseRgbPart(parts[2]) };
  }

  const hsl = input.match(/^hsl\(([^)]+)\)$/i);
  if (hsl) {
    const parts = hsl[1].split(",");
    if (parts.length !== 3 || !parts[1].trim().endsWith("%") || !parts[2].trim().endsWith("%")) {
      throw new Error("HSL 格式示例：hsl(210, 50%, 40%)");
    }
    const hue = Number(parts[0].trim());
    const saturation = Number(parts[1].trim().slice(0, -1));
    const lightness = Number(parts[2].trim().slice(0, -1));
    if (![hue, saturation, lightness].every(Number.isFinite) || saturation < 0 || saturation > 100 || lightness < 0 || lightness > 100) {
      throw new Error("HSL 色相必须是数字，饱和度和亮度必须在 0% 到 100% 之间");
    }
    return hslToRgb(hue, saturation, lightness);
  }

  throw new Error("支持 #RRGGBB、#RGB、rgb(...)、hsl(...)");
}

export function buildColorOutput(rgb: RgbColor) {
  const hex = rgbToHex(rgb);
  const hsl = rgbToHsl(rgb);
  return [
    `HEX：${hex}`,
    `RGB：rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
    `HSL：hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
    "",
    `CSS 变量：--color: ${hex};`,
    `Tailwind 任意值：bg-[${hex}]`,
  ].join("\n");
}

export function buildQueryOutput(value: string) {
  const input = value.trim();
  const withoutHash = input.split("#")[0];
  const query = /^[a-z][a-z\d+.-]*:\/\//i.test(input)
    ? new URL(input).search.slice(1)
    : withoutHash.includes("?")
      ? withoutHash.slice(withoutHash.indexOf("?") + 1)
      : withoutHash.replace(/^\?/, "");
  const params = new URLSearchParams(query);
  const entries = Array.from(params.entries());

  if (entries.length === 0) {
    throw new Error("没有解析到 URL 参数");
  }

  const grouped = entries.reduce<Record<string, string | string[]>>((current, [key, itemValue]) => {
    if (current[key] === undefined) {
      current[key] = itemValue;
    } else if (Array.isArray(current[key])) {
      current[key].push(itemValue);
    } else {
      current[key] = [current[key], itemValue];
    }
    return current;
  }, {});

  const table = entries.map(([key, itemValue], index) => `${index + 1}. ${key} = ${itemValue}`).join("\n");

  return [`参数数量：${entries.length}`, "", table, "", "JSON", formatJsonBlock(grouped)].join("\n");
}

function tokenizeShellCommand(value: string) {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;

  const pushCurrent = () => {
    if (current) {
      tokens.push(current);
      current = "";
    }
  };

  for (const char of value.trim()) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\" && quote !== "'") {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      pushCurrent();
      continue;
    }

    current += char;
  }

  if (quote) {
    throw new Error("cURL 命令引号未闭合");
  }
  if (escaping) {
    current += "\\";
  }

  pushCurrent();
  return tokens;
}

function parseCurlHeader(value: string) {
  const splitIndex = value.indexOf(":");
  if (splitIndex <= 0) {
    throw new Error(`Header 格式无效：${value}`);
  }

  return {
    key: value.slice(0, splitIndex).trim(),
    value: value.slice(splitIndex + 1).trim(),
  };
}

function encodeCurlData(value: string) {
  if (value.startsWith("@") || /^[^=]+@/.test(value)) {
    throw new Error("--data-urlencode 的文件读取语法暂不支持");
  }
  const equalsIndex = value.indexOf("=");
  if (equalsIndex > 0) {
    return `${encodeURIComponent(value.slice(0, equalsIndex))}=${encodeURIComponent(value.slice(equalsIndex + 1))}`;
  }
  return encodeURIComponent(value.replace(/^=/, ""));
}

function parseCurlCommand(value: string) {
  const tokens = tokenizeShellCommand(value);
  if (tokens.length === 0 || !tokens[0].toLowerCase().endsWith("curl")) {
    throw new Error("请输入以 curl 开头的命令");
  }

  let url = "";
  let method = "";
  const headers: Record<string, string> = {};
  const dataParts: string[] = [];
  let jsonBody = false;
  const ignoredFlags = new Set([
    "-L",
    "--location",
    "--compressed",
    "-s",
    "--silent",
    "-S",
    "--show-error",
    "-k",
    "--insecure",
    "--fail",
    "--fail-with-body",
  ]);

  const addData = (value: string, isJson = false) => {
    if ((jsonBody || isJson) && dataParts.length > 0) {
      throw new Error("--json 不能与其他请求体参数混用");
    }
    if (isJson) {
      jsonBody = true;
      if (!Object.keys(headers).some((key) => key.toLowerCase() === "content-type")) {
        headers["Content-Type"] = "application/json";
      }
      if (!Object.keys(headers).some((key) => key.toLowerCase() === "accept")) {
        headers.Accept = "application/json";
      }
    }
    dataParts.push(value);
  };

  const requireNext = (index: number, flag: string) => {
    const next = tokens[index + 1];
    if (!next || next.startsWith("-")) {
      throw new Error(`${flag} 缺少参数`);
    }
    return next;
  };

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === "-X" || token === "--request") {
      method = requireNext(index, token).toUpperCase();
      index += 1;
    } else if (token.startsWith("--request=")) {
      method = token.slice("--request=".length).toUpperCase();
    } else if (token.startsWith("-X") && token.length > 2) {
      method = token.slice(2).toUpperCase();
    } else if (token === "-H" || token === "--header") {
      const header = parseCurlHeader(requireNext(index, token));
      headers[header.key] = header.value;
      index += 1;
    } else if (token.startsWith("--header=")) {
      const header = parseCurlHeader(token.slice("--header=".length));
      headers[header.key] = header.value;
    } else if (token.startsWith("-H") && token.length > 2) {
      const header = parseCurlHeader(token.slice(2));
      headers[header.key] = header.value;
    } else if (["-d", "--data", "--data-raw", "--data-binary", "--data-ascii"].includes(token)) {
      addData(requireNext(index, token));
      index += 1;
    } else if (token.startsWith("--data=")) {
      addData(token.slice("--data=".length));
    } else if (token.startsWith("--data-raw=")) {
      addData(token.slice("--data-raw=".length));
    } else if (token.startsWith("-d") && token.length > 2) {
      addData(token.slice(2));
    } else if (token === "--data-urlencode") {
      addData(encodeCurlData(requireNext(index, token)));
      index += 1;
    } else if (token.startsWith("--data-urlencode=")) {
      addData(encodeCurlData(token.slice("--data-urlencode=".length)));
    } else if (token === "--json") {
      addData(requireNext(index, token), true);
      index += 1;
    } else if (token.startsWith("--json=")) {
      addData(token.slice("--json=".length), true);
    } else if (token === "-F" || token === "--form" || token.startsWith("--form=") || (token.startsWith("-F") && token.length > 2)) {
      throw new Error("multipart 表单暂不支持，请改用其他工具生成上传代码");
    } else if (token === "--url") {
      url = requireNext(index, token);
      index += 1;
    } else if (token.startsWith("--url=")) {
      url = token.slice("--url=".length);
    } else if (!token.startsWith("-") && /^https?:\/\//i.test(token)) {
      url = token;
    } else if (ignoredFlags.has(token)) {
      continue;
    } else if (token.startsWith("-")) {
      throw new Error(`暂不支持 cURL 参数：${token}`);
    } else {
      throw new Error(`无法识别 cURL 内容：${token}`);
    }
  }

  if (!url) {
    throw new Error("未识别到请求 URL");
  }

  const body = dataParts.length > 0 ? dataParts.join(jsonBody ? "" : "&") : "";
  return {
    url,
    method: method || (body ? "POST" : "GET"),
    headers,
    body,
  };
}

function tryParseJson(value: string) {
  if (!value.trim()) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function indentMultiline(value: string, spaces: number) {
  const indent = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join("\n");
}

function formatJsObject(value: Record<string, string>) {
  return indentMultiline(JSON.stringify(value, null, 2), 4);
}

function toPythonLiteral(value: unknown, indent = 0): string {
  const padding = " ".repeat(indent);
  const nestedPadding = " ".repeat(indent + 4);

  if (value === null) return "None";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return value === true ? "True" : value === false ? "False" : String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((item) => `${nestedPadding}${toPythonLiteral(item, indent + 4)}`).join(",\n")},\n${padding}]`;
  }
  if (isPlainRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    return `{\n${entries.map(([key, item]) => `${nestedPadding}${JSON.stringify(key)}: ${toPythonLiteral(item, indent + 4)}`).join(",\n")},\n${padding}}`;
  }
  return "None";
}

export function buildCurlCodeOutput(curlText: string, mode: CurlCodeMode) {
  const request = parseCurlCommand(curlText);
  const jsonBody = tryParseJson(request.body);
  const headerEntries = Object.entries(request.headers);
  const hasHeaders = headerEntries.length > 0;

  if (mode === "axios") {
    const lines = ["import axios from \"axios\";", "", "const response = await axios({", `  method: ${JSON.stringify(request.method.toLowerCase())},`, `  url: ${JSON.stringify(request.url)},`];
    if (hasHeaders) {
      lines.push(`  headers: ${formatJsObject(request.headers)},`);
    }
    if (request.body) {
      lines.push(`  data: ${jsonBody === null ? JSON.stringify(request.body) : indentMultiline(JSON.stringify(jsonBody, null, 2), 4)},`);
    }
    lines.push("});", "", "console.log(response.data);");
    return lines.join("\n");
  }

  if (mode === "python") {
    const method = request.method.toLowerCase();
    const args = [`    ${JSON.stringify(request.url)}`];
    if (hasHeaders) {
      args.push(`    headers=${toPythonLiteral(request.headers, 4)}`);
    }
    if (request.body) {
      args.push(`    ${jsonBody === null ? "data" : "json"}=${toPythonLiteral(jsonBody === null ? request.body : jsonBody, 4)}`);
    }
    return ["import requests", "", `response = requests.${method}(`, args.join(",\n"), ")", "print(response.json())"].join("\n");
  }

  const options: string[] = [];
  if (request.method !== "GET") {
    options.push(`  method: ${JSON.stringify(request.method)},`);
  }
  if (hasHeaders) {
    options.push(`  headers: ${formatJsObject(request.headers)},`);
  }
  if (request.body) {
    options.push(`  body: ${jsonBody === null ? JSON.stringify(request.body) : `JSON.stringify(${indentMultiline(JSON.stringify(jsonBody, null, 2), 4)})`},`);
  }

  const fetchCall =
    options.length > 0 ? `const response = await fetch(${JSON.stringify(request.url)}, {\n${options.join("\n")}\n});` : `const response = await fetch(${JSON.stringify(request.url)});`;
  return [fetchCall, "", "const data = await response.json();", "console.log(data);"].join("\n");
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function unescapeHtml(value: string) {
  const decodeCodePoint = (entity: string, rawCode: string, radix: number) => {
    const code = Number.parseInt(rawCode, radix);
    return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  };
  return value
    .replace(/&#(\d+);/g, (entity, code: string) => decodeCodePoint(entity, code, 10))
    .replace(/&#x([0-9a-f]+);/gi, (entity, code: string) => decodeCodePoint(entity, code, 16))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function getDelimiter(value: CsvDelimiter) {
  if (value === "tab") {
    return "\t";
  }
  if (value === "semicolon") {
    return ";";
  }
  return ",";
}

function parseDelimitedRows(value: string, delimiter: string) {
  const rows: { fields: string[]; explicit: boolean }[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let rowHasExplicitField = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const nextChar = value[index + 1];

    if (char === '"') {
      rowHasExplicitField = true;
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      rowHasExplicitField = true;
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push({ fields: row, explicit: rowHasExplicitField });
      row = [];
      field = "";
      rowHasExplicitField = false;
    } else {
      field += char;
    }
  }

  row.push(field);
  rows.push({ fields: row, explicit: rowHasExplicitField });

  if (inQuotes) {
    throw new Error("CSV 引号未闭合");
  }

  return rows
    .filter(
      (item) =>
        item.explicit ||
        item.fields.some((fieldValue) => fieldValue.trim() !== ""),
    )
    .map((item) => item.fields);
}

function normalizeHeader(value: string, index: number, used: Set<string>) {
  const base = value.trim() || `column_${index + 1}`;
  let name = base;
  let suffix = 2;

  while (used.has(name)) {
    name = `${base}_${suffix}`;
    suffix += 1;
  }

  used.add(name);
  return name;
}

export function buildCsvJsonOutput(value: string, delimiterMode: CsvDelimiter) {
  const rows = parseDelimitedRows(value.trim(), getDelimiter(delimiterMode));
  if (rows.length < 2) {
    throw new Error("至少需要表头和一行数据");
  }

  const usedHeaders = new Set<string>();
  const headers = rows[0].map((header, index) => normalizeHeader(header, index, usedHeaders));
  rows.slice(1).forEach((row, index) => {
    if (row.length !== headers.length) {
      throw new Error(`第 ${index + 2} 行有 ${row.length} 列，表头有 ${headers.length} 列`);
    }
  });
  const records = rows.slice(1).map((row) =>
    headers.reduce<Record<string, string>>((current, header, index) => {
      current[header] = row[index] ?? "";
      return current;
    }, {}),
  );

  return [`行数：${records.length}`, `字段：${headers.join(", ")}`, "", formatJsonBlock(records)].join("\n");
}

function randomIndex(max: number) {
  if (!Number.isSafeInteger(max) || max <= 0) {
    throw new Error("随机字符集不能为空");
  }
  if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
    throw new Error("当前浏览器不支持安全随机数生成");
  }

  const bytes = new Uint32Array(1);
  const limit = 0x1_0000_0000 - (0x1_0000_0000 % max);
  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0] >= limit);
  return bytes[0] % max;
}

function shuffleText(value: string) {
  const chars = value.split("");
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }
  return chars.join("");
}

export function generatePassword(length: number, sets: string[]) {
  const charset = sets.join("");
  const required = sets.map((set) => set[randomIndex(set.length)]).join("");
  const remaining = Array.from({ length: Math.max(0, length - required.length) }, () => charset[randomIndex(charset.length)]).join("");
  return shuffleText(required + remaining);
}

export function transformText(value: string, mode: TextTransformMode) {
  if (mode === "trim") {
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .join("\n");
  }

  if (mode === "dedupe") {
    return Array.from(new Set(value.split(/\r?\n/))).join("\n");
  }

  if (mode === "sort") {
    return value.split(/\r?\n/).sort((left, right) => left.localeCompare(right, "zh-CN")).join("\n");
  }

  if (mode === "lower") {
    return value.toLowerCase();
  }

  if (mode === "upper") {
    return value.toUpperCase();
  }

  return value
    .split(/\r?\n/)
    .map((line, index) => `${String(index + 1).padStart(2, "0")}. ${line}`)
    .join("\n");
}

export function trimHistoryText(value: string, limit = TOOL_HISTORY_TEXT_LIMIT) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n...`;
}

export function buildToolHistoryKey(
  item: Omit<ToolHistoryItem, "id" | "createdAt" | "historyKey" | "restorable">,
) {
  const excludedFields = new Set(["id", "createdAt", "historyKey", "restorable"]);
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(item)
        .filter(([field]) => !excludedFields.has(field))
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
  );
}

function normalizeStoredHistoryItem(value: unknown): ToolHistoryItem | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.tool !== "string" ||
    !TOOL_TYPES.has(item.tool) ||
    !PERSISTED_HISTORY_TOOLS.has(item.tool as ToolType) ||
    typeof item.action !== "string" ||
    typeof item.input !== "string" ||
    typeof item.createdAt !== "string" ||
    (item.output !== undefined && typeof item.output !== "string") ||
    (item.secondaryInput !== undefined && typeof item.secondaryInput !== "string")
  ) {
    return null;
  }

  const numericFields = [
    "size",
    "count",
    "cronIntervalMinutes",
    "cronMinute",
    "cronHour",
    "cronWeekday",
    "cronMonthDay",
  ];
  if (
    numericFields.some(
      (field) =>
        item[field] !== undefined &&
        (typeof item[field] !== "number" || !Number.isFinite(item[field])),
    )
  ) {
    return null;
  }

  const normalized = item as ToolHistoryItem;
  const historyKey =
    typeof normalized.historyKey === "string"
      ? normalized.historyKey
      : buildToolHistoryKey(normalized);
  return {
    ...normalized,
    historyKey,
    restorable: normalized.restorable !== false,
  };
}

export function readToolHistory(): ToolHistoryItem[] {
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

    const history = parsed
      .map(normalizeStoredHistoryItem)
      .filter((item): item is ToolHistoryItem => item !== null);
    if (history.length !== parsed.length) {
      writeToolHistory(history);
    }
    return history;
  } catch {
    return [];
  }
}

export function writeToolHistory(history: ToolHistoryItem[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    TOOL_HISTORY_STORAGE_KEY,
    JSON.stringify(history.filter((item) => PERSISTED_HISTORY_TOOLS.has(item.tool))),
  );
}

export function formatHistoryTime(value: string) {
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

export function getHistoryPreview(value?: string, limit = 72) {
  if (!value) {
    return "暂无结果预览";
  }
  return value.replace(/\s+/g, " ").trim().slice(0, limit) || "暂无结果预览";
}

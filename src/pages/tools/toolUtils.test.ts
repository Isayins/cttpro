import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildColorOutput,
  buildCsvJsonOutput,
  buildCurlCodeOutput,
  buildLineDiff,
  buildQueryOutput,
  buildRegexOutput,
  buildTypeScriptTypesFromJson,
  createUuidV4,
  decodeBase64,
  decodeBase64Url,
  encodeBase64,
  escapeHtml,
  generatePassword,
  getHistoryPreview,
  normalizeRegexFlags,
  parseColor,
  parseUnixTimestamp,
  parseWheelOptions,
  readToolHistory,
  rgbToHex,
  secureRandomIndex,
  TOOL_HISTORY_STORAGE_KEY,
  transformText,
  trimHistoryText,
  unescapeHtml,
  writeToolHistory,
} from "./toolUtils";
import type { ToolHistoryItem } from "./types";

function stubToolHistoryStorage(initialValue?: string) {
  const storage = new Map<string, string>();
  if (initialValue !== undefined) {
    storage.set(TOOL_HISTORY_STORAGE_KEY, initialValue);
  }

  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });

  return storage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tool utils", () => {
  it("parses wheel options and requires at least two entries", () => {
    expect(parseWheelOptions(" A \n\nB\n")).toEqual(["A", "B"]);
    expect(() => parseWheelOptions("only one")).toThrow("至少输入两个选项");
    expect(() => parseWheelOptions(Array.from({ length: 51 }, (_, index) => String(index)).join("\n"))).toThrow("不能超过 50 个");
  });
  it("rejects out-of-range random values before selecting a wheel index", () => {
    const values = [0xffff_ffff, 5];
    vi.stubGlobal("crypto", {
      getRandomValues: (target: Uint32Array) => {
        target[0] = values.shift() ?? 0;
        return target;
      },
    });

    expect(secureRandomIndex(10)).toBe(5);
    expect(values).toHaveLength(0);
  });
  it("round-trips unicode text through Base64 helpers", () => {
    const input = "hello 中文";

    expect(decodeBase64(encodeBase64(input))).toBe(input);
    expect(decodeBase64Url("aGVsbG8_")).toBe("hello?");
  });

  it("normalizes regex flags and builds grouped match output", () => {
    const output = buildRegexOutput("(\\w+)@(\\w+\\.com)", "migxgg", "A@test.com\nnone");

    expect(normalizeRegexFlags("migxgg")).toBe("gim");
    expect(output).toContain("命中：1");
    expect(output).toContain("group 1: A");
    expect(output).toContain("group 2: test.com");
  });

  it("builds an LCS-based line diff summary", () => {
    const output = buildLineDiff("a\nb\nc", "a\nx\nc\nd");

    expect(output).toContain("统计：相同 2 行 / 删除 1 行 / 新增 2 行");
    expect(output).toContain("- b");
    expect(output).toContain("+ x");
    expect(output).toContain("+ d");
  });

  it("parses common color formats and formats color output", () => {
    expect(parseColor("#369")).toEqual({ r: 51, g: 102, b: 153 });
    expect(parseColor("rgb(10, 20, 30)")).toEqual({ r: 10, g: 20, b: 30 });
    expect(parseColor("hsl(210, 50%, 40%)")).toEqual({ r: 51, g: 102, b: 153 });
    expect(rgbToHex({ r: 51, g: 102, b: 153 })).toBe("#336699");
    expect(buildColorOutput({ r: 51, g: 102, b: 153 })).toContain("HSL：hsl(210, 50%, 40%)");
    expect(() => parseColor("rgb(nope, 20, 30)")).toThrow("必须是数字");
    expect(() => parseColor("hsl(210, 101%, 40%)")).toThrow("0% 到 100%");
  });

  it("groups repeated query params and decodes encoded values", () => {
    const output = buildQueryOutput("https://example.test/search?a=1&a=2&b=hello%20world#top");

    expect(output).toContain("参数数量：3");
    expect(output).toContain("1. a = 1");
    expect(output).toContain('"a": [');
    expect(output).toContain('"hello world"');
    expect(() => buildQueryOutput("https://example.test/search#top")).toThrow("没有解析到 URL 参数");
  });

  it("converts quoted CSV rows into JSON records", () => {
    const output = buildCsvJsonOutput('name,age\n"Alice, A",30\nBob,25', "comma");

    expect(output).toContain("行数：2");
    expect(output).toContain('"name": "Alice, A"');
    expect(output).toContain('"age": "25"');
    expect(() => buildCsvJsonOutput('name,age\n"Alice,30', "comma")).toThrow("CSV 引号未闭合");
    expect(() => buildCsvJsonOutput("name,age\nAlice,30,extra", "comma")).toThrow("第 2 行有 3 列");
    expect(buildCsvJsonOutput("name,age\n,", "comma")).toContain('"name": ""');
    expect(buildCsvJsonOutput('value\n""', "comma")).toContain('"value": ""');
    expect(buildCsvJsonOutput("name,age\n\nBob,25", "comma")).toContain("行数：1");
  });

  it("generates TypeScript interfaces from nested JSON arrays", () => {
    const output = buildTypeScriptTypesFromJson(
      JSON.stringify([
        { id: 1, name: "Alice", active: true, profile: { email: "a@test.com" } },
        { id: 2, name: "Bob", tags: ["admin", "ops"], profile: { email: "b@test.com" } },
      ]),
      "UserList",
    );

    expect(output).toContain("export type UserList = UserListItem[];");
    expect(output).toContain("export interface UserListItem");
    expect(output).toContain("active?: boolean;");
    expect(output).toContain("tags?: string[];");
    expect(output).toContain("profile: Profile;");
    expect(output).toContain("email: string;");
  });

  it("converts cURL commands into fetch, axios and Python snippets", () => {
    const curl = `curl 'https://api.example.com/users' -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer token' --data-raw '{"name":"Alice"}'`;

    const fetchOutput = buildCurlCodeOutput(curl, "fetch");
    expect(fetchOutput).toContain('await fetch("https://api.example.com/users"');
    expect(fetchOutput).toContain('method: "POST"');
    expect(fetchOutput).toContain('"Authorization": "Bearer token"');
    expect(fetchOutput).toContain("JSON.stringify");

    const axiosOutput = buildCurlCodeOutput(curl, "axios");
    expect(axiosOutput).toContain('import axios from "axios";');
    expect(axiosOutput).toContain('method: "post"');
    expect(axiosOutput).toContain('"name": "Alice"');

    const pythonOutput = buildCurlCodeOutput(curl, "python");
    expect(pythonOutput).toContain("import requests");
    expect(pythonOutput).toContain("response = requests.post(");
    expect(pythonOutput).toContain('json={');
  });

  it("handles supported cURL body flags and rejects lossy conversions", () => {
    const jsonOutput = buildCurlCodeOutput(
      `curl https://api.example.com/users --json '{"name":"Alice"}'`,
      "fetch",
    );
    expect(jsonOutput).toContain('"Content-Type": "application/json"');
    expect(jsonOutput).toContain('"Accept": "application/json"');
    expect(jsonOutput).toContain('method: "POST"');

    const encodedOutput = buildCurlCodeOutput(
      `curl https://api.example.com/search --data-urlencode 'q=hello world'`,
      "fetch",
    );
    expect(encodedOutput).toContain('body: "q=hello%20world"');

    expect(() =>
      buildCurlCodeOutput("curl https://api.example.com/upload -F file=@demo.txt", "fetch"),
    ).toThrow("multipart 表单暂不支持");
    expect(() =>
      buildCurlCodeOutput("curl https://api.example.com --oauth2-bearer token", "fetch"),
    ).toThrow("暂不支持 cURL 参数");
  });

  it("parses explicit timestamp units without guessing ambiguous values", () => {
    expect(parseUnixTimestamp("946684800", "auto")).toMatchObject({
      milliseconds: 946684800000,
      unit: "seconds",
    });
    expect(parseUnixTimestamp("-1", "auto")).toMatchObject({
      milliseconds: -1000,
      unit: "seconds",
    });
    expect(parseUnixTimestamp("1713268800000", "auto")).toMatchObject({
      milliseconds: 1713268800000,
      unit: "milliseconds",
    });
    expect(() => parseUnixTimestamp("17132688000", "auto")).toThrow("单位不明确");
    expect(parseUnixTimestamp("17132688000", "seconds").unit).toBe("seconds");
  });

  it("transforms text and handles HTML entities", () => {
    expect(transformText(" b \n a ", "trim")).toBe("b\na");
    expect(transformText("a\nb\na", "dedupe")).toBe("a\nb");
    expect(transformText("b\na", "lineNumbers")).toBe("01. b\n02. a");

    const escaped = escapeHtml('<div title="x">A&B</div>');
    expect(escaped).toBe("&lt;div title=&quot;x&quot;&gt;A&amp;B&lt;/div&gt;");
    expect(unescapeHtml(escaped)).toBe('<div title="x">A&B</div>');
    expect(unescapeHtml("&#9999999999;")).toBe("&#9999999999;");
  });

  it("keeps history text and previews bounded", () => {
    expect(trimHistoryText("abcdef", 3)).toBe("abc\n...");
    expect(getHistoryPreview("  alpha\n beta\tgamma  ")).toBe("alpha beta gamma");
    expect(getHistoryPreview("")).toBe("暂无结果预览");
  });

  it("refuses to generate passwords or UUIDs without Web Crypto", () => {
    vi.stubGlobal("crypto", undefined);

    expect(() => generatePassword(12, ["abc", "123"])).toThrow("不支持安全随机数");
    expect(() => createUuidV4()).toThrow("不支持安全随机数");
  });

  it("writes and reads allowlisted tool history from localStorage", () => {
    stubToolHistoryStorage();
    const history: ToolHistoryItem[] = [
      {
        id: "history-1",
        tool: "color",
        action: "颜色转换",
        input: "#336699",
        output: "HEX：#336699",
        createdAt: "2026-07-06T00:00:00.000Z",
      },
    ];

    writeToolHistory(history);

    expect(readToolHistory()).toEqual([
      expect.objectContaining({
        ...history[0],
        restorable: true,
        historyKey: expect.any(String),
      }),
    ]);
  });

  it("ignores malformed or unknown history entries", () => {
    const validItem: ToolHistoryItem = {
      id: "history-2",
      tool: "cron",
      action: "Cron 表达式生成",
      input: "每天 09:00 执行。",
      output: "0 9 * * *",
      createdAt: "2026-07-06T00:00:00.000Z",
    };
    stubToolHistoryStorage(
      JSON.stringify([
        validItem,
        { id: "bad-tool", tool: "missing-tool", action: "坏数据", createdAt: "2026-07-06T00:00:00.000Z" },
        { id: "missing-action", tool: "json", createdAt: "2026-07-06T00:00:00.000Z" },
      ]),
    );

    expect(readToolHistory()).toEqual([
      expect.objectContaining({
        ...validItem,
        restorable: true,
        historyKey: expect.any(String),
      }),
    ]);

    stubToolHistoryStorage("{not-json");
    expect(readToolHistory()).toEqual([]);
  });

  it("only persists explicitly allowlisted tool history", () => {
    const storage = stubToolHistoryStorage();
    const history: ToolHistoryItem[] = [
      {
        id: "safe",
        tool: "color",
        action: "颜色转换",
        input: "#ffffff",
        createdAt: "2026-07-06T00:00:00.000Z",
      },
      {
        id: "secret",
        tool: "curlcode",
        action: "cURL 转 Fetch",
        input: "curl -H 'Authorization: Bearer secret' https://example.test",
        createdAt: "2026-07-06T00:00:00.000Z",
      },
    ];

    writeToolHistory(history);

    expect(JSON.parse(storage.get(TOOL_HISTORY_STORAGE_KEY) ?? "[]")).toEqual([history[0]]);
    expect(readToolHistory()).toEqual([
      expect.objectContaining({
        ...history[0],
        restorable: true,
        historyKey: expect.any(String),
      }),
    ]);
  });

  it("purges sensitive entries already stored by older versions", () => {
    const storage = stubToolHistoryStorage(
      JSON.stringify([
        {
          id: "secret",
          tool: "password",
          action: "密码生成",
          input: "secret",
          createdAt: "2026-07-06T00:00:00.000Z",
        },
      ]),
    );

    expect(readToolHistory()).toEqual([]);
    expect(storage.get(TOOL_HISTORY_STORAGE_KEY)).toBe("[]");
  });
});

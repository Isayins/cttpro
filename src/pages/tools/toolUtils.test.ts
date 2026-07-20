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
  readToolHistory,
  rgbToHex,
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

  it("writes and reads valid tool history from localStorage", () => {
    stubToolHistoryStorage();
    const history: ToolHistoryItem[] = [
      {
        id: "history-1",
        tool: "json",
        action: "格式化",
        input: '{"a":1}',
        output: '{\n  "a": 1\n}',
        createdAt: "2026-07-06T00:00:00.000Z",
      },
    ];

    writeToolHistory(history);

    expect(readToolHistory()).toEqual(history);
  });

  it("ignores malformed or unknown history entries", () => {
    const validItem: ToolHistoryItem = {
      id: "history-2",
      tool: "base64",
      action: "编码",
      input: "hello",
      output: "aGVsbG8=",
      createdAt: "2026-07-06T00:00:00.000Z",
    };
    stubToolHistoryStorage(
      JSON.stringify([
        validItem,
        { id: "bad-tool", tool: "missing-tool", action: "坏数据", createdAt: "2026-07-06T00:00:00.000Z" },
        { id: "missing-action", tool: "json", createdAt: "2026-07-06T00:00:00.000Z" },
      ]),
    );

    expect(readToolHistory()).toEqual([validItem]);

    stubToolHistoryStorage("{not-json");
    expect(readToolHistory()).toEqual([]);
  });

  it("never persists sensitive tool history", () => {
    const storage = stubToolHistoryStorage();
    const history: ToolHistoryItem[] = [
      {
        id: "safe",
        tool: "json",
        action: "格式化",
        input: '{"ok":true}',
        createdAt: "2026-07-06T00:00:00.000Z",
      },
      {
        id: "secret",
        tool: "jwt",
        action: "JWT 解析",
        input: "secret.jwt.token",
        createdAt: "2026-07-06T00:00:00.000Z",
      },
    ];

    writeToolHistory(history);

    expect(JSON.parse(storage.get(TOOL_HISTORY_STORAGE_KEY) ?? "[]")).toEqual([history[0]]);
    expect(readToolHistory()).toEqual([history[0]]);
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

import { describe, expect, it } from "vitest";

import { TOOL_HISTORY_TEXT_LIMIT } from "./toolUtils";
import { createToolHistoryItem } from "./useToolHistory";

describe("tool history snapshots", () => {
  it("marks truncated snapshots as preview-only", () => {
    const input = "x".repeat(TOOL_HISTORY_TEXT_LIMIT + 1);
    const item = createToolHistoryItem(
      { tool: "json", action: "格式化", input, output: "result" },
      "history-1",
      "2026-07-22T00:00:00.000Z",
    );

    expect(item.restorable).toBe(false);
    expect(item.input).toHaveLength(TOOL_HISTORY_TEXT_LIMIT + 4);
    expect(item.input.endsWith("\n...")).toBe(true);
  });

  it("uses all snapshot parameters when deduplicating history", () => {
    const first = createToolHistoryItem(
      {
        tool: "regex",
        action: "正则测试",
        input: "a+",
        secondaryInput: "aaa",
        flags: "g",
      },
      "history-1",
    );
    const second = createToolHistoryItem(
      {
        tool: "regex",
        action: "正则测试",
        input: "a+",
        secondaryInput: "bbb",
        flags: "i",
      },
      "history-2",
    );

    expect(first.historyKey).not.toBe(second.historyKey);
  });

  it("keeps every cron control value in the restorable snapshot", () => {
    const item = createToolHistoryItem({
      tool: "cron",
      action: "Cron 表达式生成",
      input: "每周三 09:30 执行。",
      output: "30 9 * * 3",
      cronMode: "weekly",
      cronIntervalMinutes: 5,
      cronMinute: 30,
      cronHour: 9,
      cronWeekday: 3,
      cronMonthDay: 1,
    });

    expect(item).toMatchObject({
      restorable: true,
      cronMode: "weekly",
      cronMinute: 30,
      cronHour: 9,
      cronWeekday: 3,
    });
  });
});

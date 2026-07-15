import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row, Select } from "antd";

import { CopyResultButton } from "./ToolResultOutput";
import type { CronMode } from "./types";
import { cronModeOptions, weekOptions } from "./toolUtils";

type CronToolPanelProps = {
  mode: CronMode;
  intervalMinutes: number;
  minute: number;
  hour: number;
  weekday: number;
  monthDay: number;
  output: string;
  description: string;
  copied: boolean;
  error: string | null;
  onModeChange: (value: CronMode) => void;
  onIntervalMinutesChange: (value: number) => void;
  onMinuteChange: (value: number) => void;
  onHourChange: (value: number) => void;
  onWeekdayChange: (value: number) => void;
  onMonthDayChange: (value: number) => void;
  onGenerate: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function CronToolPanel({
  mode,
  intervalMinutes,
  minute,
  hour,
  weekday,
  monthDay,
  output,
  description,
  copied,
  error,
  onModeChange,
  onIntervalMinutesChange,
  onMinuteChange,
  onHourChange,
  onWeekdayChange,
  onMonthDayChange,
  onGenerate,
  onClear,
  onCopy,
}: CronToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="Cron 生成失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="mb-3">
            <label className="mb-2 block text-sm font-medium text-gray-700">调度类型</label>
            <Select className="w-full" value={mode} onChange={(value: CronMode) => onModeChange(value)} options={[...cronModeOptions]} />
          </div>

          {mode === "minutes" ? (
            <div className="mb-3">
              <label className="mb-2 block text-sm font-medium text-gray-700">间隔分钟（1 - 59）</label>
              <Input type="number" min={1} max={59} value={intervalMinutes} onChange={(event) => onIntervalMinutesChange(Number(event.target.value))} />
            </div>
          ) : null}

          {mode !== "minutes" ? (
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">小时（0 - 23）</label>
                <Input type="number" min={0} max={23} value={hour} onChange={(event) => onHourChange(Number(event.target.value))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">分钟（0 - 59）</label>
                <Input type="number" min={0} max={59} value={minute} onChange={(event) => onMinuteChange(Number(event.target.value))} />
              </div>
            </div>
          ) : null}

          {mode === "weekly" ? (
            <div className="mb-3">
              <label className="mb-2 block text-sm font-medium text-gray-700">星期</label>
              <Select className="w-full" value={weekday} onChange={(value: number) => onWeekdayChange(value)} options={[...weekOptions]} />
            </div>
          ) : null}

          {mode === "monthly" ? (
            <div className="mb-3">
              <label className="mb-2 block text-sm font-medium text-gray-700">每月日期（1 - 31）</label>
              <Input type="number" min={1} max={31} value={monthDay} onChange={(event) => onMonthDayChange(Number(event.target.value))} />
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-medium text-slate-800">示例说明</div>
            <div className="mt-2 space-y-1">
              <div>`*/5 * * * *` 表示每 5 分钟执行一次。</div>
              <div>`30 9 * * *` 表示每天 09:30 执行一次。</div>
              <div>`0 10 * * 1` 表示每周一 10:00 执行一次。</div>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onGenerate} style={{ flex: 1 }}>
              生成表达式
            </Button>
            <Button icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>

        <Col xs={24} lg={12}>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Cron 表达式</label>
            <CopyResultButton value={output} copied={copied} onCopy={onCopy} />
          </div>
          <Input readOnly value={output} placeholder="例如 */5 * * * *" className="bg-gray-50 font-mono" />
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="mb-2 font-medium text-slate-800">自然语言说明</div>
            <div>{description || "生成后这里会显示更易读的中文描述。"}</div>
          </div>
        </Col>
      </Row>
    </div>
  );
}

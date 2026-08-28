import { CopyOutlined, DeleteOutlined, DownloadOutlined, PlayCircleOutlined, ReloadOutlined, UndoOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Input, InputNumber, Progress, Tag } from "antd";
import type { WheelRoundRecord } from "./types";
import { buildWheelStatistics, findWheelDuplicateOptions } from "./toolUtils";

type WheelToolPanelProps = {
  input: string;
  rotation: number;
  selected: string;
  spinning: boolean;
  error: string | null;
  results: string[];
  targetCount: number;
  rounds: WheelRoundRecord[];
  summaryCopied: boolean;
  onInputChange: (value: string) => void;
  onTargetCountChange: (value: number) => void;
  onSpin: () => void;
  onClear: () => void;
  onResetResults: () => void;
  onUndoLast: () => void;
  onCopySummary: () => void;
  onExport: () => void;
};

const colors = ["#2563eb", "#0d9488", "#db2777", "#ea580c", "#7c3aed", "#16a34a", "#ca8a04", "#0891b2"];

export function WheelToolPanel({ input, rotation, selected, spinning, error, results, targetCount, rounds, summaryCopied, onInputChange, onTargetCountChange, onSpin, onClear, onResetResults, onUndoLast, onCopySummary, onExport }: WheelToolPanelProps) {
  const options = input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const duplicateOptions = findWheelDuplicateOptions(options);
  const locked = spinning || results.length > 0;
  const completed = results.length >= targetCount;
  const statistics = buildWheelStatistics(options, results);
  const angle = options.length > 0 ? 360 / options.length : 360;
  const gradient = options.length > 0
    ? `conic-gradient(${options.map((_, index) => `${colors[index % colors.length]} ${index * angle}deg ${(index + 1) * angle}deg`).join(", ")})`
    : "conic-gradient(#e2e8f0 0deg 360deg)";

  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="转盘无法旋转" description={error} /> : null}
      {duplicateOptions.length > 0 && !error ? <Alert type="warning" showIcon message="选项存在重复" description={`请修改或删除重复项：${duplicateOptions.join("、")}`} /> : null}
      <div className="grid gap-8 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)] lg:items-center">
        <div className="mx-auto w-full max-w-[360px]">
          <div className="relative aspect-square">
            <div className="absolute left-1/2 top-[-4px] z-10 -translate-x-1/2 text-2xl leading-none text-slate-900">▼</div>
            <div
              className="absolute inset-0 rounded-full border-[10px] border-white shadow-[0_12px_30px_rgba(15,23,42,0.2)]"
              style={{ background: gradient, transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4.8s cubic-bezier(0.12, 0.72, 0.16, 1)" : "none" }}
            >
              {options.map((option, index) => {
                const centerAngle = (index + 0.5) * angle;
                const radians = (centerAngle * Math.PI) / 180;
                return (
                  <div
                    key={`${option}-${index}`}
                    className="pointer-events-none absolute flex w-[34%] -translate-x-1/2 -translate-y-1/2 justify-center text-center text-[11px] font-semibold text-white drop-shadow-sm sm:text-xs"
                    style={{ left: `${50 + Math.sin(radians) * 31}%`, top: `${50 - Math.cos(radians) * 31}%`, transform: `translate(-50%, -50%) rotate(${centerAngle}deg)` }}
                    title={option}
                  >
                    <span className="block max-w-full truncate">{option}</span>
                  </div>
                );
              })}
              <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-slate-900 text-xs font-semibold text-white shadow-lg">转盘</div>
            </div>
          </div>
          <div className="mt-4 text-center text-sm text-slate-500">指针停下的位置就是本次抽取结果</div>
          {selected ? <div className="mt-2 text-center text-xl font-semibold text-slate-900">结果：{selected}</div> : null}
        </div>
        <div className="space-y-4">
          <div>
            <label htmlFor="wheel-options" className="mb-2 block text-sm font-medium text-slate-700">选项（每行一个，2 至 50 个）</label>
            <Input.TextArea id="wheel-options" value={input} onChange={(event) => onInputChange(event.target.value)} rows={10} placeholder="例如：\n方案 A\n方案 B\n方案 C" disabled={locked} />
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="wheel-target-count" className="text-sm font-medium text-slate-700">统计次数</label>
            <InputNumber id="wheel-target-count" min={1} max={100} value={targetCount} disabled={locked} onChange={(value) => onTargetCountChange(Number(value ?? 10))} />
            {completed ? <Tag color="success" className="m-0">统计完成</Tag> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={onSpin} loading={spinning} disabled={spinning || completed || options.length < 2 || duplicateOptions.length > 0}>旋转转盘</Button>
            <Button size="large" icon={<ReloadOutlined />} onClick={() => onInputChange(options.join("\n"))} disabled={locked || options.length === 0}>整理选项</Button>
            <Button size="large" icon={<UndoOutlined />} onClick={onUndoLast} disabled={spinning || results.length === 0}>撤销上次</Button>
            <Button size="large" onClick={onResetResults} disabled={spinning || results.length === 0}>重新统计</Button>
            <Button size="large" aria-label="清空" title="清空" icon={<DeleteOutlined />} onClick={onClear} disabled={spinning} />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">已加载 {options.length} 个选项。每次旋转开始前使用浏览器安全随机数抽取索引，动画只呈现该索引对应的落点。</div>
        </div>
      </div>
      <section className="border-t border-slate-200 pt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">本轮统计</h2>
            <div className="mt-1 text-sm text-slate-500">已完成 {results.length} / {targetCount} 次</div>
          </div>
          <div className="flex w-full max-w-xs items-center gap-2"><Progress className="min-w-0 flex-1" percent={Math.min(100, Math.round(results.length / targetCount * 100))} showInfo={false} /><Button size="small" icon={<CopyOutlined />} onClick={onCopySummary} disabled={results.length === 0}>{summaryCopied ? "已复制" : "复制摘要"}</Button><Button size="small" icon={<DownloadOutlined />} onClick={onExport} disabled={results.length === 0}>导出 CSV</Button></div>
        </div>
        {results.length > 0 ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="max-h-80 overflow-auto rounded-lg border border-slate-100">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-white text-slate-500"><tr><th className="px-3 py-2 font-medium">选项</th><th className="px-3 py-2 font-medium">次数</th><th className="px-3 py-2 font-medium">占比</th></tr></thead>
                <tbody>{statistics.map(({ option, count, percentage }) => <tr key={option} className="border-b border-slate-100 last:border-b-0"><td className="max-w-[220px] truncate px-3 py-2.5 font-medium text-slate-800" title={option}>{option}</td><td className="px-3 py-2.5 text-slate-600">{count}</td><td className="px-3 py-2.5 text-slate-600">{percentage.toFixed(1)}%</td></tr>)}</tbody>
              </table>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">旋转记录</div>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-3">
                {results.map((result, index) => <div key={`${index}-${result}`} className="flex gap-3 text-sm"><span className="w-8 shrink-0 text-right text-slate-400">{index + 1}.</span><span className="font-medium text-slate-700">{result}</span></div>)}
              </div>
            </div>
          </div>
        ) : <div className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">旋转结果会依次记录在这里</div>}
      </section>
      {rounds.length > 0 ? (
        <section className="border-t border-slate-200 pt-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">历史轮次</h2>
              <div className="mt-1 text-sm text-slate-500">已保存最近 {rounds.length} 轮</div>
            </div>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {rounds.map((round) => (
              <div key={round.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{new Date(round.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                  <div className="mt-1 truncate text-slate-500" title={round.options.join("、")}>{round.options.length} 个选项 · {round.results.length} / {round.targetCount} 次 · {round.results.slice(0, 3).join("、")}{round.results.length > 3 ? " …" : ""}</div>
                </div>
                <Tag color={round.results.length >= round.targetCount ? "success" : "default"} className="m-0">{round.results.length >= round.targetCount ? "已完成" : "已保存"}</Tag>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

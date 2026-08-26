import { DeleteOutlined, PlayCircleOutlined, ReloadOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Input } from "antd";

type WheelToolPanelProps = {
  input: string;
  rotation: number;
  selected: string;
  spinning: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onSpin: () => void;
  onClear: () => void;
};

const colors = ["#2563eb", "#0d9488", "#db2777", "#ea580c", "#7c3aed", "#16a34a", "#ca8a04", "#0891b2"];

export function WheelToolPanel({ input, rotation, selected, spinning, error, onInputChange, onSpin, onClear }: WheelToolPanelProps) {
  const options = input.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const angle = options.length > 0 ? 360 / options.length : 360;
  const gradient = options.length > 0
    ? `conic-gradient(${options.map((_, index) => `${colors[index % colors.length]} ${index * angle}deg ${(index + 1) * angle}deg`).join(", ")})`
    : "conic-gradient(#e2e8f0 0deg 360deg)";

  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="转盘无法旋转" description={error} /> : null}
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
            <Input.TextArea id="wheel-options" value={input} onChange={(event) => onInputChange(event.target.value)} rows={12} placeholder="例如：\n方案 A\n方案 B\n方案 C" disabled={spinning} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={onSpin} loading={spinning} disabled={options.length < 2}>旋转转盘</Button>
            <Button size="large" icon={<ReloadOutlined />} onClick={() => onInputChange(options.join("\n"))} disabled={spinning || options.length === 0}>整理选项</Button>
            <Button size="large" aria-label="清空" title="清空" icon={<DeleteOutlined />} onClick={onClear} disabled={spinning} />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">已加载 {options.length} 个选项。每次旋转开始前使用浏览器安全随机数抽取索引，动画只呈现该索引对应的落点。</div>
        </div>
      </div>
    </div>
  );
}

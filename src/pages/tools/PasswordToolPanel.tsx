import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Col, Row, Slider } from "antd";

import { ToolTextResult } from "./ToolResultOutput";

type PasswordToolPanelProps = {
  length: number;
  count: number;
  useUpper: boolean;
  useLower: boolean;
  useNumbers: boolean;
  useSymbols: boolean;
  output: string;
  copied: boolean;
  error: string | null;
  onLengthChange: (value: number) => void;
  onCountChange: (value: number) => void;
  onUseUpperChange: (value: boolean) => void;
  onUseLowerChange: (value: boolean) => void;
  onUseNumbersChange: (value: boolean) => void;
  onUseSymbolsChange: (value: boolean) => void;
  onGenerate: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function PasswordToolPanel({
  length,
  count,
  useUpper,
  useLower,
  useNumbers,
  useSymbols,
  output,
  copied,
  error,
  onLengthChange,
  onCountChange,
  onUseUpperChange,
  onUseLowerChange,
  onUseNumbersChange,
  onUseSymbolsChange,
  onGenerate,
  onClear,
  onCopy,
}: PasswordToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="密码生成失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <label className="mb-2 block text-sm font-medium text-gray-700">密码长度：{length}</label>
          <Slider aria-label="密码长度" min={6} max={64} value={length} onChange={(value) => onLengthChange(Number(value))} />
          <label className="mb-2 mt-4 block text-sm font-medium text-gray-700">生成数量：{count}</label>
          <Slider aria-label="密码生成数量" min={1} max={30} value={count} onChange={(value) => onCountChange(Number(value))} />
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <Checkbox checked={useUpper} onChange={(event) => onUseUpperChange(event.target.checked)}>
              大写字母
            </Checkbox>
            <Checkbox checked={useLower} onChange={(event) => onUseLowerChange(event.target.checked)}>
              小写字母
            </Checkbox>
            <Checkbox checked={useNumbers} onChange={(event) => onUseNumbersChange(event.target.checked)}>
              数字
            </Checkbox>
            <Checkbox checked={useSymbols} onChange={(event) => onUseSymbolsChange(event.target.checked)}>
              符号
            </Checkbox>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onGenerate} style={{ flex: 1 }}>
              生成密码
            </Button>
            <Button aria-label="清空" title="清空" icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={14}>
          <ToolTextResult label="密码结果" value={output} copied={copied} onCopy={onCopy} rows={12} placeholder="生成结果会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

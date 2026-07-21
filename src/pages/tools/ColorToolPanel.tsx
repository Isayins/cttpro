import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";

type ColorToolPanelProps = {
  input: string;
  swatch: string;
  output: string;
  copied: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onConvert: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function ColorToolPanel({
  input,
  swatch,
  output,
  copied,
  error,
  onInputChange,
  onConvert,
  onClear,
  onCopy,
}: ColorToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="颜色转换失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <label className="mb-2 block text-sm font-medium text-gray-700">颜色值</label>
          <Input aria-label="颜色值" value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="#336699 或 rgb(51, 102, 153)" />
          <div className="mt-4 flex items-center gap-3">
            <span className="h-12 w-12 rounded-lg border border-slate-200" style={{ backgroundColor: swatch }} />
            <span className="font-mono text-sm text-slate-500">{swatch}</span>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onConvert} style={{ flex: 1 }}>
              转换颜色
            </Button>
            <Button aria-label="清空" title="清空" icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={14}>
          <ToolTextResult label="转换结果" value={output} copied={copied} onCopy={onCopy} rows={10} placeholder="HEX、RGB、HSL 会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

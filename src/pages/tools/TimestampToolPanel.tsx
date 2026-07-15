import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";

type TimestampToolPanelProps = {
  input: string;
  output: string;
  copied: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onConvert: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function TimestampToolPanel({
  input,
  output,
  copied,
  error,
  onInputChange,
  onConvert,
  onClear,
  onCopy,
}: TimestampToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="时间转换失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <label className="mb-2 block text-sm font-medium text-gray-700">输入时间戳或日期</label>
          <Input value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="例如 1713268800000 或 2026-04-24 15:00:00" />
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onConvert} style={{ flex: 1 }}>
              开始转换
            </Button>
            <Button icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <ToolTextResult label="输出" value={output} copied={copied} onCopy={onCopy} rows={7} placeholder="转换结果会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

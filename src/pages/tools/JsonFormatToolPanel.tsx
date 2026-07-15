import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";

const { TextArea } = Input;

type JsonFormatToolPanelProps = {
  input: string;
  output: string;
  copied: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onFormat: (pretty: boolean) => void;
  onClear: () => void;
  onCopy: () => void;
};

export function JsonFormatToolPanel({
  input,
  output,
  copied,
  error,
  onInputChange,
  onFormat,
  onClear,
  onCopy,
}: JsonFormatToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="JSON 处理失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <label className="mb-2 block text-sm font-medium text-gray-700">输入</label>
          <TextArea rows={10} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder='{"name":"demo"}' />
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={() => onFormat(true)} style={{ flex: 1 }}>
              格式化
            </Button>
            <Button onClick={() => onFormat(false)} style={{ flex: 1 }}>
              压缩
            </Button>
            <Button icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <ToolTextResult label="输出" value={output} copied={copied} onCopy={onCopy} rows={10} placeholder="处理结果会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

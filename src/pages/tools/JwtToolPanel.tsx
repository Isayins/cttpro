import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";

const { TextArea } = Input;

type JwtToolPanelProps = {
  input: string;
  output: string;
  copied: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onParse: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function JwtToolPanel({ input, output, copied, error, onInputChange, onParse, onClear, onCopy }: JwtToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="JWT 解析失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <label className="mb-2 block text-sm font-medium text-gray-700">JWT Token</label>
          <TextArea aria-label="JWT Token" rows={8} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="粘贴 Bearer Token 或 JWT 字符串" />
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onParse} style={{ flex: 1 }}>
              解析 Token
            </Button>
            <Button aria-label="清空" title="清空" icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <ToolTextResult
            label="解析结果"
            value={output}
            copied={copied}
            onCopy={onCopy}
            rows={12}
            placeholder="Header、Payload 和时间字段会显示在这里"
          />
        </Col>
      </Row>
    </div>
  );
}

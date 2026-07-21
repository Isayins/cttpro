import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";

const { TextArea } = Input;

type JsonTypesToolPanelProps = {
  input: string;
  rootName: string;
  output: string;
  copied: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onRootNameChange: (value: string) => void;
  onGenerate: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function JsonTypesToolPanel({
  input,
  rootName,
  output,
  copied,
  error,
  onInputChange,
  onRootNameChange,
  onGenerate,
  onClear,
  onCopy,
}: JsonTypesToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="类型生成失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <label className="mb-2 block text-sm font-medium text-gray-700">根类型名</label>
          <Input aria-label="根类型名" value={rootName} onChange={(event) => onRootNameChange(event.target.value)} placeholder="例如 ApiResponse / UserProfile" />
          <label className="mb-2 mt-4 block text-sm font-medium text-gray-700">JSON 示例</label>
          <TextArea aria-label="JSON 示例" rows={10} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder='{"id":1,"name":"Alice","tags":["admin"]}' />
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onGenerate} style={{ flex: 1 }}>
              生成 TypeScript 类型
            </Button>
            <Button aria-label="清空" title="清空" icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <ToolTextResult label="TypeScript 输出" value={output} copied={copied} onCopy={onCopy} rows={14} placeholder="interface / type 会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

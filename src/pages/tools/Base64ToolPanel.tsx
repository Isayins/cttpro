import { DeleteOutlined, WarningOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";
import type { CodecMode } from "./types";

const { TextArea } = Input;

type Base64ToolPanelProps = {
  input: string;
  mode: CodecMode;
  output: string;
  copied: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onModeChange: (value: CodecMode) => void;
  onConvert: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function Base64ToolPanel({
  input,
  mode,
  output,
  copied,
  error,
  onInputChange,
  onModeChange,
  onConvert,
  onClear,
  onCopy,
}: Base64ToolPanelProps) {
  return (
    <div className="space-y-6">
      {error ? <Alert type="error" showIcon icon={<WarningOutlined />} message="Base64 转换失败" description={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="mb-3 flex gap-2">
            <Button type={mode === "encode" ? "primary" : "default"} onClick={() => onModeChange("encode")}>
              编码
            </Button>
            <Button type={mode === "decode" ? "primary" : "default"} onClick={() => onModeChange("decode")}>
              解码
            </Button>
          </div>
          <TextArea aria-label="Base64 输入" rows={8} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="输入原文或 Base64 字符串" />
          <div className="mt-4 flex gap-2">
            <Button type="primary" onClick={onConvert} style={{ flex: 1 }}>
              执行转换
            </Button>
            <Button aria-label="清空" title="清空" icon={<DeleteOutlined />} onClick={onClear} />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <ToolTextResult label="输出" value={output} copied={copied} onCopy={onCopy} rows={8} placeholder="转换结果会显示在这里" />
        </Col>
      </Row>
    </div>
  );
}

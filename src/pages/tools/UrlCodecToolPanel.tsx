import { DeleteOutlined } from "@ant-design/icons";
import { Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";
import type { CodecMode } from "./types";

const { TextArea } = Input;

type UrlCodecToolPanelProps = {
  input: string;
  mode: CodecMode;
  output: string;
  copied: boolean;
  onInputChange: (value: string) => void;
  onModeChange: (value: CodecMode) => void;
  onConvert: () => void;
  onClear: () => void;
  onCopy: () => void;
};

export function UrlCodecToolPanel({
  input,
  mode,
  output,
  copied,
  onInputChange,
  onModeChange,
  onConvert,
  onClear,
  onCopy,
}: UrlCodecToolPanelProps) {
  return (
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
        <TextArea rows={6} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="输入 URL 或待处理字符串" />
        <div className="mt-4 flex gap-2">
          <Button type="primary" onClick={onConvert} style={{ flex: 1 }}>
            执行转换
          </Button>
          <Button icon={<DeleteOutlined />} onClick={onClear} />
        </div>
      </Col>
      <Col xs={24} lg={12}>
        <ToolTextResult label="输出" value={output} copied={copied} onCopy={onCopy} rows={6} placeholder="转换结果会显示在这里" />
      </Col>
    </Row>
  );
}

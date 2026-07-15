import { DeleteOutlined } from "@ant-design/icons";
import { Button, Col, Input, Row } from "antd";

import { ToolTextResult } from "./ToolResultOutput";
import type { CodecMode } from "./types";

const { TextArea } = Input;

type HtmlEntityToolPanelProps = {
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

export function HtmlEntityToolPanel({
  input,
  mode,
  output,
  copied,
  onInputChange,
  onModeChange,
  onConvert,
  onClear,
  onCopy,
}: HtmlEntityToolPanelProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <div className="mb-3 flex gap-2">
          <Button type={mode === "encode" ? "primary" : "default"} onClick={() => onModeChange("encode")}>
            转义
          </Button>
          <Button type={mode === "decode" ? "primary" : "default"} onClick={() => onModeChange("decode")}>
            还原
          </Button>
        </div>
        <TextArea rows={8} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder="<div class=&quot;demo&quot;>hello</div>" />
        <div className="mt-4 flex gap-2">
          <Button type="primary" onClick={onConvert} style={{ flex: 1 }}>
            执行转换
          </Button>
          <Button icon={<DeleteOutlined />} onClick={onClear} />
        </div>
      </Col>
      <Col xs={24} lg={12}>
        <ToolTextResult label="输出" value={output} copied={copied} onCopy={onCopy} rows={8} placeholder="转换结果会显示在这里" />
      </Col>
    </Row>
  );
}
